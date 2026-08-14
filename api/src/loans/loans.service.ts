import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { AuditService } from '../audit/audit.service';
import { calculateQuote, QuoteInput, QuoteResult } from './loan-quote';

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

export interface LoanDraftResult extends QuoteResult {
  id: string;
  folio: string;
  status: string;
}

function generateFolio(): string {
  const suffix = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `ppni-${suffix}`;
}

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigurationService,
    private readonly audit: AuditService,
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

  async create(
    phone: string,
    input: CreateLoanInput,
    ip: string,
    ua: string,
  ): Promise<LoanDraftResult> {
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

        return { ...quote, id: String(loan.id), folio, status: loan.status };
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
}
