import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessRulesService } from '../configuration/business-rules.service';
import { ScoreService } from '../score/score.service';
import { todayInMexicoCity } from '../loans/loan-quote';
import { calculateLoanPenalty } from '../loans/loan-penalty';

const MS_PER_DAY = 86400000;
const MS_PER_WEEK = MS_PER_DAY * 7;
const TREND_WEEKS = 12;

const DISBURSED_STATUSES = ['APPROVED', 'ACTIVE', 'LIQUIDATED'] as const;
const OPEN_PORTFOLIO_STATUSES = ['APPROVED', 'ACTIVE'] as const;
const ACTIVE_BORROWER_STATUSES = ['APPROVED', 'ACTIVE'] as const;
const SCORE_LEVELS = ['GREEN', 'YELLOW', 'ORANGE', 'RED'] as const;

export interface CustomerSegmentation {
  totalClientes: number;
  clientesActivos: number;
  clientesNuevos: number;
  clientesRecurrentes: number;
  porScore: Record<string, number>;
}

export interface WeeklyTrendPoint {
  weekStart: string;
  capitalCobrado: number;
}

export interface CollectorBreakdown {
  collectorId: string;
  collectorName: string;
  active: boolean;
  carteraSize: number;
  pagosRegistrados: number;
  cumplimientoPct: number;
  carteraVencida: number;
}

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
  customers: CustomerSegmentation;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class BiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessRules: BusinessRulesService,
    private readonly score: ScoreService,
  ) {}

  async getFinancialKpis(): Promise<FinancialKpis> {
    const [
      openLoans,
      paymentTotals,
      colocadoTotal,
      statusGroups,
      rules,
      customers,
    ] = await Promise.all([
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
      this.prisma.customer.findMany({
        select: { isNewCustomer: true, loans: { select: { status: true } } },
      }),
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
      customers: await this.getCustomerSegmentation(customers),
    };
  }

  private async getCustomerSegmentation(
    customers: {
      isNewCustomer: boolean;
      loans: { status: string }[];
    }[],
  ): Promise<CustomerSegmentation> {
    let clientesActivos = 0;
    let clientesNuevos = 0;
    let clientesRecurrentes = 0;

    for (const customer of customers) {
      if (customer.isNewCustomer) clientesNuevos++;
      if (
        customer.loans.some((l) =>
          (ACTIVE_BORROWER_STATUSES as readonly string[]).includes(l.status),
        )
      ) {
        clientesActivos++;
      }
      if (customer.loans.length > 1) clientesRecurrentes++;
    }

    const porScore: Record<string, number> = Object.fromEntries(
      SCORE_LEVELS.map((level) => [level, 0]),
    );
    const scores = await this.score.getAll();
    for (const s of scores) {
      porScore[s.level] = (porScore[s.level] ?? 0) + 1;
    }

    return {
      totalClientes: customers.length,
      clientesActivos,
      clientesNuevos,
      clientesRecurrentes,
      porScore,
    };
  }

  async getCollectorBreakdown(): Promise<CollectorBreakdown[]> {
    const [collectors, paymentGroups, rules] = await Promise.all([
      this.prisma.collector.findMany({
        include: {
          loans: {
            where: { status: { in: [...OPEN_PORTFOLIO_STATUSES] } },
            include: { schedule: true },
          },
        },
      }),
      this.prisma.payment.groupBy({ by: ['createdBy'], _count: true }),
      this.businessRules.get(),
    ]);

    const paymentsByPhone = new Map<string, number>();
    for (const group of paymentGroups) {
      paymentsByPhone.set(group.createdBy, group._count);
    }

    const today = todayInMexicoCity();

    return collectors.map((collector) => {
      let carteraVencida = 0;
      let loansOnTime = 0;

      for (const loan of collector.loans) {
        const penalty = calculateLoanPenalty(
          loan.schedule.map((entry) => ({
            seq: entry.seq,
            dueDate: entry.dueDate,
            status: entry.status,
          })),
          today,
          rules.penaltyPerDay,
        );
        if (penalty.overdueInstallments.length === 0) loansOnTime++;

        for (const overdue of penalty.overdueInstallments) {
          const entry = loan.schedule.find((s) => s.seq === overdue.seq);
          if (entry) {
            carteraVencida += Number(entry.amount) - Number(entry.paidAmount);
          }
        }
      }

      return {
        collectorId: String(collector.id),
        collectorName: collector.name,
        active: collector.active,
        carteraSize: collector.loans.length,
        pagosRegistrados: paymentsByPhone.get(collector.phone) ?? 0,
        cumplimientoPct:
          collector.loans.length > 0
            ? round2((loansOnTime / collector.loans.length) * 100)
            : 0,
        carteraVencida: round2(carteraVencida),
      };
    });
  }

  /** Capital cobrado por semana, últimas TREND_WEEKS semanas (lunes a domingo, hora Ciudad de México). */
  async getWeeklyTrends(): Promise<WeeklyTrendPoint[]> {
    const today = todayInMexicoCity();
    const daysSinceMonday = (today.getUTCDay() + 6) % 7;
    const currentWeekStart = new Date(
      today.getTime() - daysSinceMonday * MS_PER_DAY,
    );
    const earliestWeekStart = new Date(
      currentWeekStart.getTime() - (TREND_WEEKS - 1) * MS_PER_WEEK,
    );

    const payments = await this.prisma.payment.findMany({
      where: { receivedAt: { gte: earliestWeekStart } },
      select: { amount: true, receivedAt: true },
    });

    const buckets = new Map<string, number>();
    for (let i = 0; i < TREND_WEEKS; i++) {
      const weekStart = new Date(earliestWeekStart.getTime() + i * MS_PER_WEEK);
      buckets.set(weekStart.toISOString().slice(0, 10), 0);
    }

    for (const payment of payments) {
      const weekIndex = Math.min(
        Math.max(
          Math.floor(
            (payment.receivedAt.getTime() - earliestWeekStart.getTime()) /
              MS_PER_WEEK,
          ),
          0,
        ),
        TREND_WEEKS - 1,
      );
      const weekStart = new Date(
        earliestWeekStart.getTime() + weekIndex * MS_PER_WEEK,
      );
      const key = weekStart.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(payment.amount));
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, capitalCobrado]) => ({
        weekStart,
        capitalCobrado: round2(capitalCobrado),
      }));
  }
}
