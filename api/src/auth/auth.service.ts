import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from './tokens.service';
import { validatePassword } from './password.policy';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { BlacklistService } from '../blacklist/blacklist.service';
import type { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly blacklist: BlacklistService,
  ) {}

  async register(
    dto: { phone: string; email?: string; password: string },
    ip: string,
    ua: string,
  ) {
    const policyError = validatePassword(dto.password);
    if (policyError) throw new BadRequestException(policyError);
    if (await this.blacklist.isBlacklisted(dto.phone)) {
      throw new ForbiddenException(
        'Este número de teléfono está en la lista negra',
      );
    }
    const exists = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (exists) throw new ConflictException('El teléfono ya está registrado');
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        email: dto.email,
        passwordHash,
        role: 'CLIENT',
        customer: { create: { isNewCustomer: true } },
      },
    });
    await this.audit.log({
      userPhone: dto.phone,
      action: 'register',
      entity: 'user',
      entityId: dto.phone,
      ip,
      userAgent: ua,
    });
    return { user: this.publicUser(user) };
  }

  async login(phone: string, password: string, ip: string, ua: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user)
      throw new UnauthorizedException('Teléfono o contraseña incorrectos');
    if (
      user.status === 'BLOCKED' &&
      user.blockedUntil &&
      user.blockedUntil > new Date()
    ) {
      throw new UnauthorizedException('Cuenta bloqueada temporalmente');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      const attempts = user.failedAttempts + 1;
      const blockedUntil =
        attempts >= 5 ? new Date(Date.now() + 15 * 60000) : null;
      await this.prisma.user.update({
        where: { phone },
        data: {
          failedAttempts: attempts,
          blockedUntil,
          status: blockedUntil ? 'BLOCKED' : user.status,
        },
      });
      throw new UnauthorizedException('Teléfono o contraseña incorrectos');
    }
    await this.prisma.user.update({
      where: { phone },
      data: { failedAttempts: 0, blockedUntil: null, status: 'ACTIVE' },
    });
    const { accessToken, refreshToken } = await this.tokens.issue(
      phone,
      ip,
      ua,
    );
    await this.audit.log({
      userPhone: phone,
      action: 'login',
      entity: 'user',
      entityId: phone,
      ip,
      userAgent: ua,
    });
    return {
      accessToken,
      refreshToken,
      mustChangePassword: user.mustChangePassword,
      user: this.publicUser(user),
    };
  }

  async refresh(raw: string, ip: string, ua: string) {
    return this.tokens.rotate(raw, ip, ua);
  }

  async logout(raw: string) {
    await this.tokens.revoke(raw);
  }

  async me(phone: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { customer: true },
    });
    if (!user) throw new UnauthorizedException('Sesión inválida');
    return { user: this.publicUser(user), customer: user.customer };
  }

  async changePassword(
    phone: string,
    current: string,
    next: string,
    ip: string,
    ua: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !(await argon2.verify(user.passwordHash, current))) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }
    const policyError = validatePassword(next);
    if (policyError) throw new BadRequestException(policyError);
    if (await argon2.verify(user.passwordHash, next)) {
      throw new BadRequestException('La nueva contraseña debe ser diferente');
    }
    const passwordHash = await argon2.hash(next, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { phone },
      data: { passwordHash, mustChangePassword: false },
    });
    await this.tokens.revokeAllForUser(phone);
    await this.audit.log({
      userPhone: phone,
      action: 'change_password',
      entity: 'user',
      entityId: phone,
      ip,
      userAgent: ua,
    });
    return this.tokens.issue(phone, ip, ua);
  }

  async forgotPassword(phone: string, ip: string, ua: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) return; // no revelar existencia
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.configuration.upsert({
      where: { key: `reset_code:${phone}` },
      create: {
        key: `reset_code:${phone}`,
        value: { code, expiresAt: Date.now() + 15 * 60000 },
      },
      update: { value: { code, expiresAt: Date.now() + 15 * 60000 } },
    });
    if (user.email) {
      await this.email.send(
        user.email,
        'Código de recuperación',
        `Tu código es <b>${code}</b>. Vence en 15 minutos.`,
      );
    }
    await this.audit.log({
      userPhone: phone,
      action: 'forgot_password',
      entity: 'user',
      entityId: phone,
      ip,
      userAgent: ua,
    });
  }

  async resetPassword(
    phone: string,
    code: string,
    next: string,
    ip: string,
    ua: string,
  ) {
    const cfg = await this.prisma.configuration.findUnique({
      where: { key: `reset_code:${phone}` },
    });
    const data = cfg?.value as { code: string; expiresAt: number } | null;
    if (!data || data.code !== code || data.expiresAt < Date.now()) {
      throw new BadRequestException('Código inválido o expirado');
    }
    const policyError = validatePassword(next);
    if (policyError) throw new BadRequestException(policyError);
    const passwordHash = await argon2.hash(next, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { phone },
      data: { passwordHash, mustChangePassword: false },
    });
    await this.prisma.configuration
      .delete({ where: { key: `reset_code:${phone}` } })
      .catch(() => undefined);
    await this.tokens.revokeAllForUser(phone);
    await this.audit.log({
      userPhone: phone,
      action: 'reset_password',
      entity: 'user',
      entityId: phone,
      ip,
      userAgent: ua,
    });
    return { ok: true };
  }

  private publicUser(
    u: Pick<User, 'phone' | 'email' | 'role' | 'mustChangePassword'>,
  ) {
    return {
      phone: u.phone,
      email: u.email,
      role: u.role,
      mustChangePassword: u.mustChangePassword,
    };
  }
}
