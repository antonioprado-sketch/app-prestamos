import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { todayInMexicoCity } from '../loans/loan-quote';
import { calculateLoanPenalty } from '../loans/loan-penalty';
import { LoanDraftResult, toLoanDraftResult } from '../loans/loans.service';
import {
  applyPayment,
  PaymentAmountExceedsOutstandingError,
} from './payment-application';

const PAYABLE_STATUSES = ['APPROVED', 'ACTIVE'] as const;

export interface RegisterPaymentInput {
  amount: number;
  idempotencyKey: string;
  notes?: string;
}

export interface RegisterPaymentResult {
  paymentId: string;
  amount: number;
  penaltyApplied: number;
  principalApplied: number;
  alreadyProcessed: boolean;
  loan: LoanDraftResult;
}

export interface PaymentSummary {
  id: string;
  amount: number;
  penaltyApplied: number;
  receivedAt: string;
  notes: string | null;
  createdBy: string;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async register(
    actorPhone: string,
    loanId: string,
    input: RegisterPaymentInput,
    ip: string,
    ua: string,
  ): Promise<RegisterPaymentResult> {
    const actor = await this.getActorContext(actorPhone);

    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (String(existing.loanId) !== loanId) {
        throw new ConflictException(
          'idempotencyKey ya fue usado para otro préstamo',
        );
      }
      const loan = await this.loadLoanWithSchedule(loanId);
      return {
        paymentId: String(existing.id),
        amount: Number(existing.amount),
        penaltyApplied: Number(existing.penaltyApplied),
        principalApplied: round2(
          Number(existing.amount) - Number(existing.penaltyApplied),
        ),
        alreadyProcessed: true,
        loan: toLoanDraftResult(loan),
      };
    }

    const loan = await this.loadLoanWithSchedule(loanId);
    if (!PAYABLE_STATUSES.includes(loan.status as never)) {
      throw new ConflictException(
        'Este préstamo no admite pagos en su estado actual',
      );
    }
    if (
      actor.role === 'COLLECTOR' &&
      String(loan.collectorId ?? '') !== actor.collectorId
    ) {
      throw new ForbiddenException('No tienes asignado este préstamo');
    }

    const outstandingPenalty = Math.max(
      0,
      round2(
        calculateLoanPenalty(
          loan.schedule.map((s) => ({
            seq: s.seq,
            dueDate: s.dueDate,
            status: s.status,
          })),
          todayInMexicoCity(),
        ).totalPenalty - Number(loan.penaltyPaid),
      ),
    );

    let application;
    try {
      application = applyPayment(
        loan.schedule.map((s) => ({
          seq: s.seq,
          amount: Number(s.amount),
          paidAmount: Number(s.paidAmount),
        })),
        outstandingPenalty,
        input.amount,
      );
    } catch (err) {
      if (err instanceof PaymentAmountExceedsOutstandingError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const newPenaltyPaid = round2(
      Number(loan.penaltyPaid) + application.penaltyApplied,
    );
    const newStatus = application.fullyPaidOff
      ? 'LIQUIDATED'
      : loan.status === 'APPROVED'
        ? 'ACTIVE'
        : loan.status;

    const { payment, updatedLoan } = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.payment.create({
          data: {
            loanId: loan.id,
            amount: input.amount,
            penaltyApplied: application.penaltyApplied,
            idempotencyKey: input.idempotencyKey,
            notes: input.notes,
            createdBy: actorPhone,
          },
        });

        for (const update of application.scheduleUpdates) {
          await tx.loanSchedule.updateMany({
            where: { loanId: loan.id, seq: update.seq },
            data: {
              paidAmount: update.newPaidAmount,
              status: update.newStatus,
            },
          });
        }

        const updated = await tx.loan.update({
          where: { id: loan.id },
          data: {
            penaltyPaid: newPenaltyPaid,
            status: newStatus,
            liquidatedAt: application.fullyPaidOff
              ? new Date()
              : loan.liquidatedAt,
          },
          include: { schedule: true },
        });

        return { payment: created, updatedLoan: updated };
      },
    );

    await this.audit.log({
      userPhone: actorPhone,
      action: 'payment_registered',
      entity: 'loan',
      entityId: String(loan.id),
      newValue: {
        amount: input.amount,
        penaltyApplied: application.penaltyApplied,
        scheduleUpdates: application.scheduleUpdates,
        newStatus,
      },
      ip,
      userAgent: ua,
    });

    return {
      paymentId: String(payment.id),
      amount: input.amount,
      penaltyApplied: application.penaltyApplied,
      principalApplied: round2(input.amount - application.penaltyApplied),
      alreadyProcessed: false,
      loan: toLoanDraftResult(updatedLoan),
    };
  }

  async findForLoan(
    actorPhone: string,
    loanId: string,
  ): Promise<PaymentSummary[]> {
    const actor = await this.getActorContext(actorPhone);
    const loan = await this.loadLoanWithSchedule(loanId);

    if (actor.role === 'CLIENT' && loan.customerPhone !== actorPhone) {
      throw new NotFoundException('Préstamo no encontrado');
    }
    if (
      actor.role === 'COLLECTOR' &&
      String(loan.collectorId ?? '') !== actor.collectorId
    ) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    const payments = await this.prisma.payment.findMany({
      where: { loanId: loan.id },
      orderBy: { receivedAt: 'asc' },
    });

    return payments.map((p) => ({
      id: String(p.id),
      amount: Number(p.amount),
      penaltyApplied: Number(p.penaltyApplied),
      receivedAt: p.receivedAt.toISOString(),
      notes: p.notes,
      createdBy: p.createdBy,
    }));
  }

  private async loadLoanWithSchedule(loanId: string) {
    if (!/^\d+$/.test(loanId))
      throw new NotFoundException('Préstamo no encontrado');
    const loan = await this.prisma.loan.findUnique({
      where: { id: BigInt(loanId) },
      include: { schedule: true },
    });
    if (!loan) throw new NotFoundException('Préstamo no encontrado');
    return loan;
  }

  private async getActorContext(
    phone: string,
  ): Promise<{ role: string; collectorId: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { collector: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return {
      role: user.role,
      collectorId: user.collector ? String(user.collector.id) : null,
    };
  }
}
