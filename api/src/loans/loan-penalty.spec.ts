import { calculateLoanPenalty } from './loan-penalty';

const PENALTY_PER_DAY = 50;

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe('calculateLoanPenalty', () => {
  const today = utcDate('2026-08-20');

  it('devuelve 0 si no hay cuotas vencidas', () => {
    const result = calculateLoanPenalty(
      [{ seq: 1, dueDate: utcDate('2026-08-27'), status: 'PENDING' }],
      today,
      PENALTY_PER_DAY,
    );
    expect(result.totalPenalty).toBe(0);
    expect(result.overdueInstallments).toHaveLength(0);
  });

  it('no cobra multa el mismo día del vencimiento (plazo corre hasta 23:59:59)', () => {
    const result = calculateLoanPenalty(
      [{ seq: 1, dueDate: today, status: 'PENDING' }],
      today,
      PENALTY_PER_DAY,
    );
    expect(result.totalPenalty).toBe(0);
  });

  it('cobra 1 día de multa si venció ayer', () => {
    const result = calculateLoanPenalty(
      [{ seq: 1, dueDate: utcDate('2026-08-19'), status: 'PENDING' }],
      today,
      PENALTY_PER_DAY,
    );
    expect(result.totalPenalty).toBe(PENALTY_PER_DAY);
    expect(result.overdueInstallments).toEqual([
      { seq: 1, dueDate: '2026-08-19', daysLate: 1, penalty: 50 },
    ]);
  });

  it('acumula $50 por cada día de atraso', () => {
    const result = calculateLoanPenalty(
      [{ seq: 1, dueDate: utcDate('2026-08-17'), status: 'PENDING' }],
      today,
      PENALTY_PER_DAY,
    );
    expect(result.totalPenalty).toBe(3 * PENALTY_PER_DAY);
  });

  it('no cobra multa a una cuota PAID sin importar la fecha', () => {
    const result = calculateLoanPenalty(
      [{ seq: 1, dueDate: utcDate('2026-08-10'), status: 'PAID' }],
      today,
      PENALTY_PER_DAY,
    );
    expect(result.totalPenalty).toBe(0);
  });

  it('sigue cobrando multa plana a una cuota PARTIAL vencida', () => {
    const result = calculateLoanPenalty(
      [{ seq: 1, dueDate: utcDate('2026-08-19'), status: 'PARTIAL' }],
      today,
      PENALTY_PER_DAY,
    );
    expect(result.totalPenalty).toBe(PENALTY_PER_DAY);
  });

  it('suma la multa de varias cuotas vencidas', () => {
    const result = calculateLoanPenalty(
      [
        { seq: 1, dueDate: utcDate('2026-08-19'), status: 'PENDING' }, // 1 día
        { seq: 2, dueDate: utcDate('2026-08-17'), status: 'PARTIAL' }, // 3 días
        { seq: 3, dueDate: utcDate('2026-08-27'), status: 'PENDING' }, // futura
        { seq: 4, dueDate: utcDate('2026-08-10'), status: 'PAID' }, // pagada
      ],
      today,
      PENALTY_PER_DAY,
    );
    expect(result.totalPenalty).toBe(1 * 50 + 3 * 50);
    expect(result.overdueInstallments.map((i) => i.seq)).toEqual([1, 2]);
  });

  it('usa el monto por día configurado en vez del valor fijo', () => {
    const result = calculateLoanPenalty(
      [{ seq: 1, dueDate: utcDate('2026-08-19'), status: 'PENDING' }],
      today,
      100,
    );
    expect(result.totalPenalty).toBe(100);
    expect(result.overdueInstallments[0].penalty).toBe(100);
  });
});
