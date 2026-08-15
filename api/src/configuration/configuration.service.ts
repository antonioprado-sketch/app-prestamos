import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  async getNumber(key: string, fallback: number): Promise<number> {
    const row = await this.prisma.configuration.findUnique({ where: { key } });
    if (!row) return fallback;
    const value = Number(row.value);
    return Number.isFinite(value) ? value : fallback;
  }

  async set(key: string, value: number, updatedBy: string): Promise<void> {
    await this.prisma.configuration.upsert({
      where: { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    });
  }
}
