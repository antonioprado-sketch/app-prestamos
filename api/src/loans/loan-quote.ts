export type LoanModel = 'WEEKLY' | 'BIWEEKLY';

export interface QuoteInput {
  amount: number;
  model: LoanModel;
  openingDate: string;
  maxAmount: number | null;
}

export interface QuoteScheduleEntry {
  seq: number;
  dueDate: string;
  amount: number;
}

export interface QuoteResult {
  amount: number;
  model: LoanModel;
  openingDate: string;
  total: number;
  payment: number;
  lastPayment: number;
  schedule: QuoteScheduleEntry[];
}

export class QuoteError extends Error {}

const INTEREST_FACTOR = 1.4;
const WEEKLY_INSTALLMENTS = 20;
const BIWEEKLY_INSTALLMENTS = 10;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new QuoteError('Fecha de apertura inválida');
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    throw new QuoteError('Fecha de apertura inválida');
  }
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function isLastDayOfMonth(date: Date): boolean {
  return (
    date.getUTCDate() ===
    lastDayOfMonth(date.getUTCFullYear(), date.getUTCMonth())
  );
}

function nextQuincenaDate(date: Date): Date {
  if (date.getUTCDate() === 15) {
    const last = lastDayOfMonth(date.getUTCFullYear(), date.getUTCMonth());
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), last));
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 15));
}

export function todayInMexicoCity(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parseCalendarDate(parts);
}

export function calculateQuote(input: QuoteInput): QuoteResult {
  return calculateQuoteInternal(input, false);
}

export function calculateManualQuote(
  input: Omit<QuoteInput, 'maxAmount'>,
): QuoteResult {
  return calculateQuoteInternal({ ...input, maxAmount: null }, true);
}

function calculateQuoteInternal(
  input: QuoteInput,
  allowPast: boolean,
): QuoteResult {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new QuoteError('El monto debe ser mayor a cero');
  }
  if (input.maxAmount != null && input.amount > input.maxAmount) {
    throw new QuoteError(`El monto máximo permitido es $${input.maxAmount}`);
  }

  const openingDate = parseCalendarDate(input.openingDate);
  if (!allowPast && openingDate < todayInMexicoCity()) {
    throw new QuoteError('La fecha de apertura no puede ser en el pasado');
  }

  if (input.model === 'WEEKLY') {
    const day = openingDate.getUTCDay();
    if (day !== 1 && day !== 5) {
      throw new QuoteError(
        'Para el modelo semanal la apertura debe ser lunes o viernes',
      );
    }
  } else {
    if (openingDate.getUTCDate() !== 15 && !isLastDayOfMonth(openingDate)) {
      throw new QuoteError(
        'Para el modelo quincenal la apertura debe ser el día 15 o el último día del mes',
      );
    }
  }

  const total = round2(input.amount * INTEREST_FACTOR);
  const installments =
    input.model === 'WEEKLY' ? WEEKLY_INSTALLMENTS : BIWEEKLY_INSTALLMENTS;
  const payment = round2(total / installments);
  const lastPayment = round2(total - payment * (installments - 1));

  const dueDates: Date[] = [];
  if (input.model === 'WEEKLY') {
    let cursor = addDays(openingDate, 7);
    for (let i = 0; i < installments; i++) {
      dueDates.push(cursor);
      cursor = addDays(cursor, 7);
    }
  } else {
    const minFirstDue = addDays(openingDate, 15);
    let cursor = openingDate;
    while (cursor < minFirstDue) {
      cursor = nextQuincenaDate(cursor);
    }
    for (let i = 0; i < installments; i++) {
      dueDates.push(cursor);
      cursor = nextQuincenaDate(cursor);
    }
  }

  const schedule: QuoteScheduleEntry[] = dueDates.map((dueDate, i) => ({
    seq: i + 1,
    dueDate: formatDate(dueDate),
    amount: i === installments - 1 ? lastPayment : payment,
  }));

  return {
    amount: round2(input.amount),
    model: input.model,
    openingDate: input.openingDate,
    total,
    payment,
    lastPayment,
    schedule,
  };
}
