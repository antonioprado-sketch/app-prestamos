import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { generateTempPassword } from '../common/generate-temp-password';

export interface CollectorResult {
  id: string;
  phone: string;
  name: string;
  active: boolean;
}

export interface CreatedCollectorResult extends CollectorResult {
  tempPassword: string;
}

@Injectable()
export class AdminCollectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    adminPhone: string,
    input: { phone: string; name: string },
    ip: string,
    ua: string,
  ): Promise<CreatedCollectorResult> {
    const existing = await this.prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese teléfono');
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
    });

    const user = await this.prisma.user.create({
      data: {
        phone: input.phone,
        passwordHash,
        role: 'COLLECTOR',
        mustChangePassword: true,
        collector: { create: { name: input.name } },
      },
      include: { collector: true },
    });

    await this.audit.log({
      userPhone: adminPhone,
      action: 'collector_created',
      entity: 'collector',
      entityId: String(user.collector!.id),
      newValue: { phone: input.phone, name: input.name },
      ip,
      userAgent: ua,
    });

    return {
      id: String(user.collector!.id),
      phone: user.phone,
      name: user.collector!.name,
      active: user.collector!.active,
      tempPassword,
    };
  }

  async findAll(): Promise<CollectorResult[]> {
    const collectors = await this.prisma.collector.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return collectors.map((c) => ({
      id: String(c.id),
      phone: c.phone,
      name: c.name,
      active: c.active,
    }));
  }
}
