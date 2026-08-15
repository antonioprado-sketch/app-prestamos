import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessRulesService } from '../configuration/business-rules.service';
import { todayInMexicoCity } from '../loans/loan-quote';
import { calculateLoanPenalty } from '../loans/loan-penalty';

const DISBURSED_STATUSES = ['APPROVED', 'ACTIVE', 'LIQUIDATED'] as const;
const OPEN_PORTFOLIO_STATUSES = ['APPROVED', 'ACTIVE'] as const;

export interface FinancialKpis {
  capitalColocado: number;
  capitalCobrado: number;
  capitalPendiente: number;
  carteraVencida: number;
  morosidadPct: number;
  tasaRecuperacionPct: number;
  multasAcumuladas: number;
  multasCobradas: number;
  loansByStatus: Record<string, number>;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class BiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessRules: BusinessRulesService,
  ) {}

  async getFinancialKpis(): Promise<FinancialKpis> {
    const [openLoans, paymentTotals, colocadoTotal, statusGroups, rules] =
      await Promise.all([
        this.prisma.loan.findMany({
          where: { status: { in: [...OPEN_PORTFOLIO_STATUSES] } },
          include: { schedule: true },
        }),
        this.prisma.payment.aggregate({
          _sum: { amount: true, penaltyApplied: true },
        }),
        this.prisma.loan.aggregate({
          where: { status: { in: [...DISBURSED_STATUSES] } },
          _sum: { amount: true },
        }),
        this.prisma.loan.groupBy({ by: ['status'], _count: true }),
        this.businessRules.get(),
      ]);

    const today = todayInMexicoCity();
    let capitalPendiente = 0;
    let carteraVencida = 0;
    let multasAcumuladas = 0;

    for (const loan of openLoans) {
      for (const entry of loan.schedule) {
        const remaining = Number(entry.amount) - Number(entry.paidAmount);
        if (remaining > 0) capitalPendiente += remaining;
      }

      const penalty = calculateLoanPenalty(
        loan.schedule.map((entry) => ({
          seq: entry.seq,
          dueDate: entry.dueDate,
          status: entry.status,
        })),
        today,
        rules.penaltyPerDay,
      );
      multasAcumuladas += penalty.totalPenalty;

      for (const overdue of penalty.overdueInstallments) {
        const entry = loan.schedule.find((s) => s.seq === overdue.seq);
        if (entry) {
          carteraVencida += Number(entry.amount) - Number(entry.paidAmount);
        }
      }
    }

    const capitalColocado = Number(colocadoTotal._sum.amount ?? 0);
    const capitalCobrado = Number(paymentTotals._sum.amount ?? 0);
    const multasCobradas = Number(paymentTotals._sum.penaltyApplied ?? 0);

    const loansByStatus: Record<string, number> = {};
    for (const group of statusGroups) {
      loansByStatus[group.status] = group._count;
    }

    return {
      capitalColocado: round2(capitalColocado),
      capitalCobrado: round2(capitalCobrado),
      capitalPendiente: round2(capitalPendiente),
      carteraVencida: round2(carteraVencida),
      morosidadPct:
        capitalPendiente > 0
          ? round2((carteraVencida / capitalPendiente) * 100)
          : 0,
      tasaRecuperacionPct:
        capitalColocado > 0
          ? round2((capitalCobrado / capitalColocado) * 100)
          : 0,
      multasAcumuladas: round2(multasAcumuladas),
      multasCobradas: round2(multasCobradas),
      loansByStatus,
    };
  }
}
