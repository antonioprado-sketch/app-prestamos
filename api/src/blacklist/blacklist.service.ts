import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BlacklistEntry {
  phone: string;
  reason: string;
  createdBy: string;
  createdAt: Date;
}

@Injectable()
export class BlacklistService {
  constructor(private readonly prisma: PrismaService) {}

  async isBlacklisted(phone: string): Promise<boolean> {
    const entry = await this.prisma.blacklist.findUnique({
      where: { phone },
      select: { phone: true },
    });
    return entry !== null;
  }

  async findAll(): Promise<BlacklistEntry[]> {
    const rows = await this.prisma.blacklist.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      phone: r.phone,
      reason: r.reason,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }));
  }

  async add(
    phone: string,
    reason: string,
    createdBy: string,
  ): Promise<BlacklistEntry> {
    const existing = await this.prisma.blacklist.findUnique({
      where: { phone },
    });
    if (existing)
      throw new ConflictException('Ese teléfono ya está en la lista negra');
    const row = await this.prisma.blacklist.create({
      data: { phone, reason, createdBy },
    });
    return {
      phone: row.phone,
      reason: row.reason,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }

  async remove(phone: string): Promise<void> {
    const existing = await this.prisma.blacklist.findUnique({
      where: { phone },
    });
    if (!existing)
      throw new NotFoundException('Ese teléfono no está en la lista negra');
    await this.prisma.blacklist.delete({ where: { phone } });
  }
}
