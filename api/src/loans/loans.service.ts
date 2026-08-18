import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { BusinessRulesService } from '../configuration/business-rules.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { BlacklistService } from '../blacklist/blacklist.service';
import {
  calculateQuote,
  QuoteInput,
  QuoteResult,
  QuoteScheduleEntry,
  todayInMexicoCity,
} from './loan-quote';
import { calculateLoanPenalty, PenaltyResult } from './loan-penalty';
import { renderPagarePdf } from './pagare';
import { decodeSignaturePng } from '../documents/document-validation';

const NEW_CLIENT_MAX_AMOUNT_KEY = 'loans.new_client_max_amount';
const NEW_CLIENT_MAX_AMOUNT_DEFAULT = 3000;
const ACTIVE_LOAN_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'REQUIRES_CORRECTION',
  'APPROVED',
  'ACTIVE',
] as const;
const MAX_FOLIO_ATTEMPTS = 10;

export class ActiveLoanExistsError extends Error {}

export interface CreateLoanInput {
  amount: number;
  model: QuoteInput['model'];
  openingDate: string;
}

export interface LoanScheduleEntryWithStatus extends QuoteScheduleEntry {
  status: string;
  paidAmount: number;
}

export interface LoanDraftResult extends Omit<QuoteResult, 'schedule'> {
  id: string;
  folio: string;
  status: string;
  adminNote: string | null;
  schedule: LoanScheduleEntryWithStatus[];
}

function generateFolio(): string {
  const suffix = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `ppni-${suffix}`;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type LoanWithSchedule = Prisma.LoanGetPayload<{
  include: { schedule: true };
}>;

export function toLoanDraftResult(loan: LoanWithSchedule): LoanDraftResult {
  const schedule = loan.schedule
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map((entry) => ({
      seq: entry.seq,
      dueDate: toDateString(entry.dueDate),
      amount: Number(entry.amount),
      status: entry.status,
      paidAmount: Number(entry.paidAmount),
    }));

  return {
    id: String(loan.id),
    folio: loan.folio,
    status: loan.status,
    adminNote: loan.adminNote,
    amount: Number(loan.amount),
    model: loan.model,
    openingDate: toDateString(loan.openingDate),
    total: Number(loan.totalToPay),
    payment: schedule[0]?.amount ?? 0,
    lastPayment: schedule[schedule.length - 1]?.amount ?? 0,
    schedule,
  };
}

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigurationService,
    private readonly businessRules: BusinessRulesService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly blacklist: BlacklistService,
  ) {}

  async resolveMaxAmount(phone: string | undefined): Promise<number | null> {
    const newClientMax = await this.config.getNumber(
      NEW_CLIENT_MAX_AMOUNT_KEY,
      NEW_CLIENT_MAX_AMOUNT_DEFAULT,
    );

    if (!phone) return newClientMax;

    const customer = await this.prisma.customer.findUnique({
      where: { phone },
      select: { isNewCustomer: true },
    });
    if (!customer || customer.isNewCustomer) return newClientMax;
    return null;
  }

  async quote(
    input: CreateLoanInput,
    phone: string | undefined,
  ): Promise<QuoteResult> {
    const maxAmount = await this.resolveMaxAmount(phone);
    return calculateQuote({ ...input, maxAmount });
  }

  async quoteLimit(
    phone: string | undefined,
  ): Promise<{ maxAmount: number | null }> {
    return { maxAmount: await this.resolveMaxAmount(phone) };
  }

  async create(
    phone: string,
    input: CreateLoanInput,
    ip: string,
    ua: string,
  ): Promise<LoanDraftResult> {
    if (await this.blacklist.isBlacklisted(phone)) {
      throw new ForbiddenException(
        'No puedes solicitar un préstamo: tu número está en la lista negra',
      );
    }
    const quote = await this.quote(input, phone);

    const existing = await this.prisma.loan.findFirst({
      where: {
        customerPhone: phone,
        status: { in: [...ACTIVE_LOAN_STATUSES] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ActiveLoanExistsError(
        'Ya tienes una solicitud de préstamo en curso',
      );
    }

    let attempt = 0;
    for (;;) {
      attempt++;
      const folio = generateFolio();
      try {
        const loan = await this.prisma.$transaction(async (tx) => {
          const created = await tx.loan.create({
            data: {
              folio,
              customerPhone: phone,
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
          userPhone: phone,
          action: 'loan_draft_created',
          entity: 'loan',
          entityId: String(loan.id),
          newValue: { folio, amount: quote.amount, model: quote.model },
          ip,
          userAgent: ua,
        });

        return {
          ...quote,
          schedule: quote.schedule.map((entry) => ({
            ...entry,
            status: 'PENDING',
            paidAmount: 0,
          })),
          id: String(loan.id),
          folio,
          status: loan.status,
          adminNote: null,
        };
      } catch (err) {
        const isFolioCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          (err.meta?.target as string[] | undefined)?.includes('folio');
        if (isFolioCollision && attempt < MAX_FOLIO_ATTEMPTS) continue;
        throw err;
      }
    }
  }

  async findMyLoans(phone: string): Promise<LoanDraftResult[]> {
    const loans = await this.prisma.loan.findMany({
      where: { customerPhone: phone },
      include: { schedule: true },
      orderBy: { createdAt: 'desc' },
    });
    return loans.map(toLoanDraftResult);
  }

  async findOne(phone: string, id: string): Promise<LoanDraftResult> {
    if (!/^\d+$/.test(id))
      throw new NotFoundException('Préstamo no encontrado');
    const loan = await this.prisma.loan.findUnique({
      where: { id: BigInt(id) },
      include: { schedule: true },
    });
    if (!loan || loan.customerPhone !== phone) {
      throw new NotFoundException('Préstamo no encontrado');
    }
    return toLoanDraftResult(loan);
  }

  async getPenalty(phone: string, loanId: string): Promise<PenaltyResult> {
    if (!/^\d+$/.test(loanId))
      throw new NotFoundException('Préstamo no encontrado');
    const loan = await this.prisma.loan.findUnique({
      where: { id: BigInt(loanId) },
      include: { schedule: true },
    });
    if (!loan || loan.customerPhone !== phone) {
      throw new NotFoundException('Préstamo no encontrado');
    }
    const { penaltyPerDay } = await this.businessRules.get();
    return calculateLoanPenalty(
      loan.schedule.map((entry) => ({
        seq: entry.seq,
        dueDate: entry.dueDate,
        status: entry.status,
      })),
      todayInMexicoCity(),
      penaltyPerDay,
    );
  }

  async signPagare(
    phone: string,
    loanId: string,
    input: { signature: string; fullName: string },
    ip: string,
    ua: string,
  ): Promise<{ documentId: string; status: string }> {
    if (!/^\d+$/.test(loanId))
      throw new NotFoundException('Préstamo no encontrado');
    const loan = await this.prisma.loan.findUnique({
      where: { id: BigInt(loanId) },
      include: { schedule: { orderBy: { seq: 'asc' } } },
    });
    if (!loan || loan.customerPhone !== phone) {
      throw new NotFoundException('Préstamo no encontrado');
    }
    if (loan.status !== 'DRAFT' && loan.status !== 'REQUIRES_CORRECTION') {
      throw new ConflictException(
        'Este préstamo ya no admite la firma del pagaré',
      );
    }

    const customer = await this.prisma.customer.findUnique({
      where: { phone },
    });
    if (!customer?.onboardingComplete) {
      throw new BadRequestException(
        'Completa tus datos antes de firmar el pagaré',
      );
    }

    const signatureBuffer = decodeSignaturePng(input.signature);

    const pdfBuffer = await renderPagarePdf({
      folio: loan.folio,
      fullName: input.fullName,
      nombres: customer.nombres,
      apellidos: customer.apellidos,
      calle: customer.calle,
      numero: customer.numero,
      colonia: customer.colonia,
      cp: customer.cp,
      ciudad: customer.ciudad,
      estado: customer.estado,
      aval: customer.aval,
      avalPhone: customer.avalPhone,
      amount: Number(loan.amount),
      total: Number(loan.totalToPay),
      model: loan.model,
      schedule: loan.schedule.map((s) => ({
        seq: s.seq,
        dueDate: toDateString(s.dueDate),
        amount: Number(s.amount),
      })),
      signature: signatureBuffer,
      signedAt: new Date(),
      ip,
    });

    const checksum = createHash('sha256').update(pdfBuffer).digest('hex');
    const storageKey = `customers/${phone}/pagare/${Date.now()}-${randomBytes(6).toString('hex')}.pdf`;
    await this.storage.putObject(storageKey, pdfBuffer, 'application/pdf');

    const [document] = await this.prisma.$transaction([
      this.prisma.document.create({
        data: {
          customerPhone: phone,
          loanId: loan.id,
          type: 'PAGARE',
          storageKey,
          mime: 'application/pdf',
          sizeBytes: pdfBuffer.length,
          checksum,
          uploadedBy: phone,
        },
      }),
      this.prisma.loan.update({
        where: { id: loan.id },
        data: { status: 'SUBMITTED', adminNote: null },
      }),
    ]);

    await this.audit.log({
      userPhone: phone,
      action: 'pagare_signed',
      entity: 'loan',
      entityId: String(loan.id),
      newValue: { documentId: String(document.id), fullName: input.fullName },
      ip,
      userAgent: ua,
    });

    return { documentId: String(document.id), status: 'SUBMITTED' };
  }
}
