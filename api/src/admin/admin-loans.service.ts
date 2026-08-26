import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessRulesService } from '../configuration/business-rules.service';
import {
  LoanDraftResult,
  LoanWithSchedule,
  toLoanDraftResult,
} from '../loans/loans.service';
import { calculateManualQuote, QuoteError } from '../loans/loan-quote';
import { calculateLoanPenalty } from '../loans/loan-penalty';
import {
  applyPayment,
  PaymentAmountExceedsOutstandingError,
} from '../payments/payment-application';

const REVIEWABLE_STATUSES = ['SUBMITTED'] as const;
const ASSIGNABLE_STATUSES = ['APPROVED', 'ACTIVE'] as const;
const VALID_STATUS_FILTERS = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'REQUIRES_CORRECTION',
  'APPROVED',
  'REJECTED',
  'ACTIVE',
  'LIQUIDATED',
  'CANCELLED',
] as const;

export interface AdminLoanResult extends LoanDraftResult {
  customerPhone: string;
  customerName: string | null;
  collectorId: string | null;
  collectorName: string | null;
}

export type LoanWithAdminRelations = LoanWithSchedule & {
  customer: { nombres: string | null; apellidos: string | null };
  collector: { id: bigint; name: string } | null;
};

export function toAdminLoanResult(
  loan: LoanWithAdminRelations,
): AdminLoanResult {
  const base = toLoanDraftResult(loan);
  const customerName = [loan.customer.nombres, loan.customer.apellidos]
    .filter(Boolean)
    .join(' ');
  return {
    ...base,
    customerPhone: loan.customerPhone,
    customerName: customerName || null,
    collectorId: loan.collector ? String(loan.collector.id) : null,
    collectorName: loan.collector?.name ?? null,
  };
}

export const ADMIN_LOAN_INCLUDE = {
  schedule: true,
  customer: true,
  collector: true,
};

@Injectable()
export class AdminLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly businessRules: BusinessRulesService,
  ) {}

  async findAll(status?: string): Promise<AdminLoanResult[]> {
    if (status && !VALID_STATUS_FILTERS.includes(status as never)) {
      throw new BadRequestException('Status inválido');
    }
    const loans = await this.prisma.loan.findMany({
      where: status ? { status: status as never } : undefined,
      include: ADMIN_LOAN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return loans.map(toAdminLoanResult);
  }

  async findOne(id: string): Promise<AdminLoanResult> {
    const loan = await this.loadLoan(id);
    return toAdminLoanResult(loan);
  }

  async approve(
    adminPhone: string,
    id: string,
    ip: string,
    ua: string,
  ): Promise<AdminLoanResult> {
    const loan = await this.loadReviewableLoan(id);

    const updated = await this.prisma.loan.update({
      where: { id: loan.id },
      data: {
        status: 'APPROVED',
        approvedBy: adminPhone,
        approvedAt: new Date(),
        adminNote: null,
      },
      include: ADMIN_LOAN_INCLUDE,
    });

    await this.audit.log({
      userPhone: adminPhone,
      action: 'loan_approved',
      entity: 'loan',
      entityId: String(loan.id),
      prevValue: { status: loan.status },
      newValue: { status: 'APPROVED' },
      ip,
      userAgent: ua,
    });

    await this.notifications
      .create({
        userPhone: loan.customerPhone,
        type: 'loan_approved',
        title: 'Tu solicitud fue aprobada',
        body: `Tu préstamo ${loan.folio} fue aprobado. Pronto un cobrador se pondrá en contacto.`,
        metadata: { loanId: String(loan.id) },
      })
      .catch(() => undefined);

    return toAdminLoanResult(updated);
  }

  async reject(
    adminPhone: string,
    id: string,
    reason: string,
    ip: string,
    ua: string,
  ): Promise<AdminLoanResult> {
    const loan = await this.loadReviewableLoan(id);

    const updated = await this.prisma.loan.update({
      where: { id: loan.id },
      data: { status: 'REJECTED', adminNote: reason },
      include: ADMIN_LOAN_INCLUDE,
    });

    await this.audit.log({
      userPhone: adminPhone,
      action: 'loan_rejected',
      entity: 'loan',
      entityId: String(loan.id),
      prevValue: { status: loan.status },
      newValue: { status: 'REJECTED', reason },
      ip,
      userAgent: ua,
    });

    await this.notifications
      .create({
        userPhone: loan.customerPhone,
        type: 'loan_rejected',
        title: 'Tu solicitud fue rechazada',
        body: reason,
        metadata: { loanId: String(loan.id) },
      })
      .catch(() => undefined);

    return toAdminLoanResult(updated);
  }

  async requestCorrection(
    adminPhone: string,
    id: string,
    reason: string,
    ip: string,
    ua: string,
  ): Promise<AdminLoanResult> {
    const loan = await this.loadReviewableLoan(id);

    const updated = await this.prisma.loan.update({
      where: { id: loan.id },
      data: { status: 'REQUIRES_CORRECTION', adminNote: reason },
      include: ADMIN_LOAN_INCLUDE,
    });

    await this.audit.log({
      userPhone: adminPhone,
      action: 'loan_correction_requested',
      entity: 'loan',
      entityId: String(loan.id),
      prevValue: { status: loan.status },
      newValue: { status: 'REQUIRES_CORRECTION', reason },
      ip,
      userAgent: ua,
    });

    await this.notifications
      .create({
        userPhone: loan.customerPhone,
        type: 'loan_requires_correction',
        title: 'Tu solicitud necesita una corrección',
        body: reason,
        metadata: { loanId: String(loan.id) },
      })
      .catch(() => undefined);

    return toAdminLoanResult(updated);
  }

  async assignCollector(
    adminPhone: string,
    id: string,
    collectorId: string,
    ip: string,
    ua: string,
  ): Promise<AdminLoanResult> {
    const loan = await this.loadAssignableLoan(id);

    const collector = await this.prisma.collector.findUnique({
      where: { id: BigInt(collectorId) },
    });
    if (!collector || !collector.active) {
      throw new NotFoundException('Cobrador no encontrado');
    }

    const updated = await this.prisma.loan.update({
      where: { id: loan.id },
      data: { collectorId: collector.id },
      include: ADMIN_LOAN_INCLUDE,
    });

    await this.audit.log({
      userPhone: adminPhone,
      action: 'loan_collector_assigned',
      entity: 'loan',
      entityId: String(loan.id),
      prevValue: {
        collectorId: loan.collectorId ? String(loan.collectorId) : null,
      },
      newValue: { collectorId },
      ip,
      userAgent: ua,
    });

    const customerName =
      [loan.customer.nombres, loan.customer.apellidos]
        .filter(Boolean)
        .join(' ') || loan.customerPhone;
    await this.notifications
      .create({
        userPhone: collector.phone,
        type: 'loan_assigned',
        title: 'Nuevo préstamo asignado',
        body: `Se te asignó el préstamo ${loan.folio} de ${customerName}.`,
        metadata: { loanId: String(loan.id) },
      })
      .catch(() => undefined);

    return toAdminLoanResult(updated);
  }

  async unassignCollector(
    adminPhone: string,
    id: string,
    ip: string,
    ua: string,
  ): Promise<AdminLoanResult> {
    const loan = await this.loadAssignableLoan(id);

    const updated = await this.prisma.loan.update({
      where: { id: loan.id },
      data: { collectorId: null },
      include: ADMIN_LOAN_INCLUDE,
    });

    await this.audit.log({
      userPhone: adminPhone,
      action: 'loan_collector_unassigned',
      entity: 'loan',
      entityId: String(loan.id),
      prevValue: {
        collectorId: loan.collectorId ? String(loan.collectorId) : null,
      },
      newValue: { collectorId: null },
      ip,
      userAgent: ua,
    });

    return toAdminLoanResult(updated);
  }

  async createManualLoan(
    adminPhone: string,
    input: { customerPhone: string; amount: number; model: 'WEEKLY' | 'BIWEEKLY'; openingDate: string },
    ip: string,
    ua: string,
  ): Promise<AdminLoanResult> {
    const customer = await this.prisma.customer.findUnique({
      where: { phone: input.customerPhone },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    if (input.amount % 500 !== 0) {
      throw new BadRequestException('El monto debe ser múltiplo de $500');
    }

    let quote;
    try {
      quote = calculateManualQuote({
        amount: input.amount,
        model: input.model,
        openingDate: input.openingDate,
      });
    } catch (err) {
      if (err instanceof QuoteError) throw new BadRequestException(err.message);
      throw err;
    }

    const existing = await this.prisma.loan.findFirst({
      where: {
        customerPhone: input.customerPhone,
        status: { in: ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'REQUIRES_CORRECTION', 'APPROVED', 'ACTIVE'] as never },
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException('El cliente ya tiene una solicitud en curso');

    const MAX_FOLIO_ATTEMPTS = 10;
    const generateFolio = () => `ppni-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    let attempt = 0;
    for (;;) {
      attempt++;
      const folio = generateFolio();
      try {
        const loan = await this.prisma.$transaction(async (tx) => {
          const created = await tx.loan.create({
            data: {
              folio,
              customerPhone: input.customerPhone,
              amount: quote.amount,
              totalToPay: quote.total,
              model: quote.model,
              status: 'DRAFT',
              openingDate: new Date(`${quote.openingDate}T00:00:00.000Z`),
            },
          });
          await tx.loanSchedule.createMany({
            data: quote.schedule.map((entry) => ({
              loanId: created.id,
              seq: entry.seq,
              dueDate: new Date(`${entry.dueDate}T00:00:00.000Z`),
              amount: entry.amount,
            })),
          });
          return created;
        });

        await this.audit.log({
          userPhone: adminPhone,
          action: 'loan_created_manual',
          entity: 'loan',
          entityId: String(loan.id),
          newValue: { folio, customerPhone: input.customerPhone, amount: quote.amount, model: quote.model, openingDate: quote.openingDate, bypassedMaxAmount: true },
          ip,
          userAgent: ua,
        });

        const full = await this.prisma.loan.findUnique({
          where: { id: loan.id },
          include: ADMIN_LOAN_INCLUDE,
        });
        return toAdminLoanResult(full!);
      } catch (err: unknown) {
        if (attempt < MAX_FOLIO_ATTEMPTS && (err as { code?: string })?.code === 'P2002') continue;
        throw err;
      }
    }
  }

  async registerHistoricalPayment(
    adminPhone: string,
    loanId: string,
    input: { amount: number; receivedAt: string; notes?: string; idempotencyKey?: string },
    ip: string,
    ua: string,
  ) {
    const loan = await this.loadLoan(loanId);
    if (!['APPROVED', 'ACTIVE'].includes(loan.status as string)) {
      throw new ConflictException('Solo se puede registrar historial en préstamos aprobados o activos');
    }
    const receivedAt = new Date(input.receivedAt);
    if (Number.isNaN(receivedAt.getTime())) throw new BadRequestException('Fecha inválida');
    if (receivedAt > new Date()) throw new BadRequestException('La fecha no puede ser futura');
    if (receivedAt < loan.openingDate) throw new BadRequestException('La fecha no puede ser anterior a la apertura');

    // validar cronológico: no puede ser anterior al último pago
    const lastPayment = await this.prisma.payment.findFirst({
      where: { loanId: loan.id },
      orderBy: { receivedAt: 'desc' },
    });
    if (lastPayment && receivedAt < lastPayment.receivedAt) {
      throw new BadRequestException('La fecha debe ser cronológica (no anterior al último abono)');
    }

    const idempotencyKey = input.idempotencyKey ?? `hist-${loan.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (String(existing.loanId) !== String(loan.id)) throw new ConflictException('idempotencyKey ya usado para otro préstamo');
      const full = await this.prisma.loan.findUnique({ where: { id: loan.id }, include: ADMIN_LOAN_INCLUDE });
      return {
        paymentId: String(existing.id),
        amount: Number(existing.amount),
        penaltyApplied: Number(existing.penaltyApplied),
        alreadyProcessed: true,
        loan: toAdminLoanResult(full!),
      };
    }

    const { penaltyPerDay } = await this.businessRules.get();
    const penaltyDate = receivedAt;
    const outstandingPenalty = Math.max(
      0,
      Math.round((calculateLoanPenalty(loan.schedule.map((s) => ({ seq: s.seq, dueDate: s.dueDate, status: s.status })), penaltyDate, penaltyPerDay).totalPenalty - Number(loan.penaltyPaid) + Number.EPSILON) * 100) / 100,
    );

    let application;
    try {
      application = applyPayment(
        loan.schedule.map((s) => ({ seq: s.seq, amount: Number(s.amount), paidAmount: Number(s.paidAmount) })),
        outstandingPenalty,
        input.amount,
      );
    } catch (err) {
      if (err instanceof PaymentAmountExceedsOutstandingError) throw new BadRequestException(err.message);
      throw err;
    }

    const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
    const newPenaltyPaid = round2(Number(loan.penaltyPaid) + application.penaltyApplied);
    const newStatus = application.fullyPaidOff ? 'LIQUIDATED' : loan.status === 'APPROVED' ? 'ACTIVE' : loan.status;

    const { payment, updatedLoan } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          loanId: loan.id,
          amount: input.amount,
          penaltyApplied: application.penaltyApplied,
          idempotencyKey,
          notes: input.notes ?? 'migración papel',
          createdBy: adminPhone,
          receivedAt,
        },
      });
      for (const u of application.scheduleUpdates) {
        await tx.loanSchedule.updateMany({
          where: { loanId: loan.id, seq: u.seq },
          data: { paidAmount: u.newPaidAmount, status: u.newStatus },
        });
      }
      const updated = await tx.loan.update({
        where: { id: loan.id },
        data: { penaltyPaid: newPenaltyPaid, status: newStatus as never, liquidatedAt: application.fullyPaidOff ? new Date() : loan.liquidatedAt },
        include: ADMIN_LOAN_INCLUDE,
      });
      return { payment: created, updatedLoan: updated };
    });

    await this.audit.log({
      userPhone: adminPhone,
      action: 'payment_historical_registered',
      entity: 'loan',
      entityId: String(loan.id),
      newValue: { amount: input.amount, receivedAt, penaltyApplied: application.penaltyApplied, newStatus },
      ip,
      userAgent: ua,
    });

    return {
      paymentId: String(payment.id),
      amount: input.amount,
      penaltyApplied: application.penaltyApplied,
      alreadyProcessed: false,
      loan: toAdminLoanResult(updatedLoan),
    };
  }

  private async loadLoan(id: string) {
    if (!/^\d+$/.test(id))
      throw new NotFoundException('Préstamo no encontrado');
    const loan = await this.prisma.loan.findUnique({
      where: { id: BigInt(id) },
      include: ADMIN_LOAN_INCLUDE,
    });
    if (!loan) throw new NotFoundException('Préstamo no encontrado');
    return loan;
  }

  private async loadReviewableLoan(id: string) {
    const loan = await this.loadLoan(id);
    if (!REVIEWABLE_STATUSES.includes(loan.status as never)) {
      throw new ConflictException(
        'Este préstamo no está en un estado que admita revisión',
      );
    }
    return loan;
  }

  private async loadAssignableLoan(id: string) {
    const loan = await this.loadLoan(id);
    if (!ASSIGNABLE_STATUSES.includes(loan.status as never)) {
      throw new ConflictException(
        'Solo se puede asignar cobrador a préstamos aprobados o activos',
      );
    }
    return loan;
  }
}
