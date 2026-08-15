import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  LoanDraftResult,
  LoanWithSchedule,
  toLoanDraftResult,
} from '../loans/loans.service';

const REVIEWABLE_STATUSES = ['SUBMITTED'] as const;
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
}

function toAdminLoanResult(
  loan: LoanWithSchedule & {
    customer: { nombres: string | null; apellidos: string | null };
  },
): AdminLoanResult {
  const base = toLoanDraftResult(loan);
  const customerName = [loan.customer.nombres, loan.customer.apellidos]
    .filter(Boolean)
    .join(' ');
  return {
    ...base,
    customerPhone: loan.customerPhone,
    customerName: customerName || null,
  };
}

@Injectable()
export class AdminLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(status?: string): Promise<AdminLoanResult[]> {
    if (status && !VALID_STATUS_FILTERS.includes(status as never)) {
      throw new BadRequestException('Status inválido');
    }
    const loans = await this.prisma.loan.findMany({
      where: status ? { status: status as never } : undefined,
      include: { schedule: true, customer: true },
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
      include: { schedule: true, customer: true },
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
      include: { schedule: true, customer: true },
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
      include: { schedule: true, customer: true },
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

    return toAdminLoanResult(updated);
  }

  private async loadLoan(id: string) {
    if (!/^\d+$/.test(id))
      throw new NotFoundException('Préstamo no encontrado');
    const loan = await this.prisma.loan.findUnique({
      where: { id: BigInt(id) },
      include: { schedule: true, customer: true },
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
}
