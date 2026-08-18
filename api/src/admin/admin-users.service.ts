import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { generateTempPassword } from '../common/generate-temp-password';

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
  ) {}

  async findAll(filters: {
    role?: string;
    status?: string;
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

    const users = await this.prisma.user.findMany({
      where: {
        ...(filters.role ? { role: filters.role as Role } : {}),
        ...(filters.status ? { status: filters.status as UserStatus } : {}),
      },
      include: {
        customer: { select: { nombres: true, apellidos: true } },
        collector: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map(toSummary);
  }

  async resetPassword(
    actorPhone: string,
    phone: string,
    ip: string,
    ua: string,
  ): Promise<{ tempPassword: string }> {
    if (phone === actorPhone) {
      throw new BadRequestException(
        'No puedes resetear tu propia contraseña desde aquí',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const tempPassword = generateTempPassword();
    const passwordHash = await argon2.hash(tempPassword, {
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

    return { tempPassword };
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
}
