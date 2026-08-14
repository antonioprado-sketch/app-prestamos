import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(args: {
    userPhone?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    prevValue?: unknown;
    newValue?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userPhone: args.userPhone ?? null,
        action: args.action,
        entity: args.entity,
        entityId: args.entityId ?? null,
        prevValue:
          args.prevValue === undefined ? undefined : (args.prevValue as object),
        newValue:
          args.newValue === undefined ? undefined : (args.newValue as object),
        ip: args.ip ?? null,
        userAgent: args.userAgent ?? null,
      },
    });
  }
}
