import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    const phone = process.env.ADMIN_PHONE ?? 'admin';
    const password = process.env.ADMIN_PASSWORD ?? 'admin';
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) return;
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.user.create({
      data: {
        phone,
        passwordHash,
        role: 'ADMIN',
        mustChangePassword: true,
        admin: { create: {} },
      },
    });
    this.logger.log(
      `Admin inicial creado: ${phone} (debe cambiar contraseña al entrar)`,
    );
  }
}
