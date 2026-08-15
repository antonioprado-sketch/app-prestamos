import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminLoanResult,
  ADMIN_LOAN_INCLUDE,
  toAdminLoanResult,
} from '../admin/admin-loans.service';

@Injectable()
export class CollectorLoansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAssigned(collectorPhone: string): Promise<AdminLoanResult[]> {
    const collectorId = await this.resolveCollectorId(collectorPhone);
    const loans = await this.prisma.loan.findMany({
      where: { collectorId },
      include: ADMIN_LOAN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return loans.map(toAdminLoanResult);
  }

  async findOne(collectorPhone: string, id: string): Promise<AdminLoanResult> {
    const collectorId = await this.resolveCollectorId(collectorPhone);
    if (!/^\d+$/.test(id))
      throw new NotFoundException('Préstamo no encontrado');

    const loan = await this.prisma.loan.findUnique({
      where: { id: BigInt(id) },
      include: ADMIN_LOAN_INCLUDE,
    });
    if (!loan || loan.collectorId !== collectorId) {
      throw new NotFoundException('Préstamo no encontrado');
    }
    return toAdminLoanResult(loan);
  }

  private async resolveCollectorId(phone: string): Promise<bigint> {
    const collector = await this.prisma.collector.findUnique({
      where: { phone },
    });
    if (!collector) throw new NotFoundException('Cobrador no encontrado');
    return collector.id;
  }
}
