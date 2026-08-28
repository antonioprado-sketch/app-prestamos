import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { validatePassword } from '../auth/password.policy';

const VALID_ROLES: Role[] = ['CLIENT', 'COLLECTOR', 'ADMIN'];
const VALID_STATUSES: UserStatus[] = ['ACTIVE', 'INACTIVE', 'BLOCKED'];

export interface AdminUserSummary {
  phone: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: Date;
}

type UserWithProfiles = {
  phone: string;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: Date;
  customer: { nombres: string | null; apellidos: string | null } | null;
  collector: { name: string } | null;
};

function toSummary(user: UserWithProfiles): AdminUserSummary {
  let name: string | null = null;
  if (user.collector) {
    name = user.collector.name;
  } else if (user.customer) {
    name =
      [user.customer.nombres, user.customer.apellidos]
        .filter(Boolean)
        .join(' ') || null;
  }
  return {
    phone: user.phone,
    name,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  async findAll(filters: {
    role?: string;
    status?: string;
    search?: string;
  }): Promise<AdminUserSummary[]> {
    if (filters.role && !VALID_ROLES.includes(filters.role as Role)) {
      throw new BadRequestException('role inválido');
    }
    if (
      filters.status &&
      !VALID_STATUSES.includes(filters.status as UserStatus)
    ) {
      throw new BadRequestException('status inválido');
    }
    if (filters.search && filters.search.length > 50) {
      throw new BadRequestException('search demasiado largo');
    }

    const search = filters.search?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        ...(filters.role ? { role: filters.role as Role } : {}),
        ...(filters.status ? { status: filters.status as UserStatus } : {}),
        ...(search
          ? {
              OR: [
                { phone: { contains: search } },
                { customer: { nombres: { contains: search } } },
                { customer: { apellidos: { contains: search } } },
                { collector: { name: { contains: search } } },
              ],
            }
          : {}),
      },
      include: {
        customer: { select: { nombres: true, apellidos: true } },
        collector: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: search ? 50 : undefined,
    });

    return users.map(toSummary);
  }

  async resetPassword(
    actorPhone: string,
    phone: string,
    newPassword: string,
    ip: string,
    ua: string,
  ): Promise<{ tempPassword: string; emailSent: boolean }> {
    if (phone === actorPhone) {
      throw new BadRequestException(
        'No puedes resetear tu propia contraseña desde aquí',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const policyError = validatePassword(newPassword);
    if (policyError) throw new BadRequestException(policyError);

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.user.update({
      where: { phone },
      data: {
        passwordHash,
        mustChangePassword: true,
        failedAttempts: 0,
        blockedUntil: null,
      },
    });

    await this.audit.log({
      userPhone: actorPhone,
      action: 'password_reset',
      entity: 'user',
      entityId: phone,
      ip,
      userAgent: ua,
    });

    // Enviar al correo registrado (User.email ?? Customer.email)
    let emailSent = false;
    let to: string | null = user.email;
    if (!to) {
      const customer = await this.prisma.customer.findUnique({ where: { phone }, select: { email: true } });
      to = customer?.email ?? null;
    }
    if (to) {
      const safe = newPassword.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      try {
        await this.email.send(
          to,
          'Contraseña reseteada — Prestamitos',
          `<p>Hola ${phone},</p><p>Un administrador reseteó tu contraseña. Tu nueva contraseña es: <b>${safe}</b></p><p>Debes cambiarla al entrar (mustChangePassword).</p>`,
        );
        emailSent = true;
      } catch {
        // no bloquear el reset si falla el correo
      }
    }

    return { tempPassword: newPassword, emailSent };
  }

  async changeRole(
    actorPhone: string,
    phone: string,
    role: 'CLIENT' | 'COLLECTOR',
    ip: string,
    ua: string,
  ): Promise<AdminUserSummary> {
    if (phone === actorPhone) {
      throw new BadRequestException('No puedes cambiar tu propio rol');
    }
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { customer: true, collector: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role === 'ADMIN') {
      throw new BadRequestException('No se puede cambiar el rol de un admin');
    }
    if (user.role === role) {
      throw new BadRequestException('El usuario ya tiene ese rol');
    }

    if (role === 'CLIENT') {
      // COLLECTOR -> CLIENT: un cobrador con préstamos asignados no se degrada
      // (quedarían huérfanos de collectorId) — hay que reasignarlos antes.
      const assignedLoans = await this.prisma.loan.count({
        where: { collectorId: user.collector!.id },
      });
      if (assignedLoans > 0) {
        throw new BadRequestException(
          'Este cobrador tiene préstamos asignados — reasígnalos antes de cambiarle el rol',
        );
      }
      await this.prisma.$transaction([
        this.prisma.collector.delete({ where: { phone } }),
        this.prisma.user.update({
          where: { phone },
          data: {
            role: 'CLIENT',
            ...(user.customer
              ? {}
              : { customer: { create: { isNewCustomer: true } } }),
          },
        }),
      ]);
    } else {
      // CLIENT -> COLLECTOR: se conserva el registro Customer (historial de
      // préstamos/documentos si los tuvo) — solo se agrega el perfil de cobrador.
      const name =
        [user.customer?.nombres, user.customer?.apellidos]
          .filter(Boolean)
          .join(' ') || phone;
      await this.prisma.user.update({
        where: { phone },
        data: {
          role: 'COLLECTOR',
          ...(user.collector ? {} : { collector: { create: { name } } }),
        },
      });
    }

    await this.audit.log({
      userPhone: actorPhone,
      action: 'user_role_changed',
      entity: 'user',
      entityId: phone,
      prevValue: { role: user.role },
      newValue: { role },
      ip,
      userAgent: ua,
    });

    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { phone },
      include: {
        customer: { select: { nombres: true, apellidos: true } },
        collector: { select: { name: true } },
      },
    });
    return toSummary(updated);
  }

  async deleteUser(
    actorPhone: string,
    phone: string,
    ip: string,
    ua: string,
  ): Promise<void> {
    if (phone === actorPhone) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta');
    }
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { collector: true, customer: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw new BadRequestException('No puedes eliminar al último administrador');
      }
    }
    if (user.role === 'COLLECTOR' && user.collector) {
      const assigned = await this.prisma.loan.count({ where: { collectorId: user.collector.id } });
      if (assigned > 0) {
        throw new BadRequestException(
          'Este cobrador tiene préstamos asignados — reasígnalos antes de eliminarlo',
        );
      }
    }
    const loansCount = user.customer ? await this.prisma.loan.count({ where: { customerPhone: phone } }) : 0;
    await this.prisma.user.delete({ where: { phone } });
    await this.audit.log({
      userPhone: actorPhone,
      action: 'user_deleted',
      entity: 'user',
      entityId: phone,
      prevValue: { role: user.role, status: user.status, loansCount },
      ip,
      userAgent: ua,
    });
  }
}
