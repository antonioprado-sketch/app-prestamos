import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issue(phone: string, ip?: string, userAgent?: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: phone },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as StringValue,
      },
    );
    const raw = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const days = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
    await this.prisma.refreshToken.create({
      data: {
        userPhone: phone,
        tokenHash,
        expiresAt: new Date(Date.now() + days * 86400000),
        ip,
        userAgent,
      },
    });
    return { accessToken, refreshToken: raw };
  }

  async rotate(raw: string, ip?: string, userAgent?: string) {
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issue(record.userPhone, ip, userAgent);
  }

  async revoke(raw: string) {
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(phone: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userPhone: phone, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
