import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
}

@Injectable()
export class ScoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessRules: BusinessRulesService,
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
    );
  }

  async getAll(): Promise<CustomerScore[]> {
    const customers = await this.prisma.customer.findMany();
    const rules = await this.businessRules.get();
    return Promise.all(
      customers.map((c) =>
        this.computeScore(c.phone, this.customerName(c), rules),
      ),
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
      level: calculateScoreLevel(
        maxDaysLate,
        rules.yellowMaxDays,
        rules.orangeMaxDays,
      ),
      maxDaysLate,
    };
  }
}
