import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BusinessRulesService } from '../configuration/business-rules.service';
import { BusinessRules } from '../configuration/business-rules.constants';
import { todayInMexicoCity } from '../loans/loan-quote';
import { calculateLoanPenalty } from '../loans/loan-penalty';
import { calculateScoreLevel, ScoreLevel } from './score-calculation';

const SCORED_LOAN_STATUSES = ['APPROVED', 'ACTIVE'] as const;

export interface CustomerScore {
  customerPhone: string;
  customerName: string | null;
  level: ScoreLevel;
  maxDaysLate: number;
  isManualOverride: boolean;
}

@Injectable()
export class ScoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessRules: BusinessRulesService,
    private readonly audit: AuditService,
  ) {}

  async getForCustomer(phone: string): Promise<CustomerScore> {
    const customer = await this.prisma.customer.findUnique({
      where: { phone },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    const rules = await this.businessRules.get();
    return this.computeScore(
      customer.phone,
      this.customerName(customer),
      rules,
      customer.scoreOverride,
    );
  }

  async getAll(): Promise<CustomerScore[]> {
    const customers = await this.prisma.customer.findMany();
    const rules = await this.businessRules.get();
    return Promise.all(
      customers.map((c) =>
        this.computeScore(
          c.phone,
          this.customerName(c),
          rules,
          c.scoreOverride,
        ),
      ),
    );
  }

  async setOverride(
    actorPhone: string,
    targetPhone: string,
    level: ScoreLevel | null,
    ip: string,
    ua: string,
  ): Promise<CustomerScore> {
    const customer = await this.prisma.customer.findUnique({
      where: { phone: targetPhone },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const updated = await this.prisma.customer.update({
      where: { phone: targetPhone },
      data: { scoreOverride: level },
    });

    await this.audit.log({
      userPhone: actorPhone,
      action: 'score_manually_adjusted',
      entity: 'customer',
      entityId: targetPhone,
      prevValue: { scoreOverride: customer.scoreOverride },
      newValue: { scoreOverride: level },
      ip,
      userAgent: ua,
    });

    const rules = await this.businessRules.get();
    return this.computeScore(
      updated.phone,
      this.customerName(updated),
      rules,
      updated.scoreOverride,
    );
  }

  private customerName(customer: {
    nombres: string | null;
    apellidos: string | null;
  }): string | null {
    const name = [customer.nombres, customer.apellidos]
      .filter(Boolean)
      .join(' ');
    return name || null;
  }

  private async computeScore(
    phone: string,
    customerName: string | null,
    rules: BusinessRules,
    scoreOverride: ScoreLevel | null,
  ): Promise<CustomerScore> {
    const loans = await this.prisma.loan.findMany({
      where: {
        customerPhone: phone,
        status: { in: [...SCORED_LOAN_STATUSES] },
      },
      include: { schedule: true },
    });

    const today = todayInMexicoCity();
    let maxDaysLate = 0;
    for (const loan of loans) {
      const penalty = calculateLoanPenalty(
        loan.schedule.map((s) => ({
          seq: s.seq,
          dueDate: s.dueDate,
          status: s.status,
        })),
        today,
        rules.penaltyPerDay,
      );
      for (const installment of penalty.overdueInstallments) {
        if (installment.daysLate > maxDaysLate) {
          maxDaysLate = installment.daysLate;
        }
      }
    }

    return {
      customerPhone: phone,
      customerName,
      level:
        scoreOverride ??
        calculateScoreLevel(
          maxDaysLate,
          rules.yellowMaxDays,
          rules.orangeMaxDays,
        ),
      maxDaysLate,
      isManualOverride: scoreOverride !== null,
    };
  }
}
