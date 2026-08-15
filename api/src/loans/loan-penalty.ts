export interface PenaltyScheduleEntry {
  seq: number;
  dueDate: Date;
  status: string;
}

export interface PenaltyInstallment {
  seq: number;
  dueDate: string;
  daysLate: number;
  penalty: number;
}

export interface PenaltyResult {
  totalPenalty: number;
  overdueInstallments: PenaltyInstallment[];
}

const MS_PER_DAY = 86400000;

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function calculateLoanPenalty(
  schedule: PenaltyScheduleEntry[],
  today: Date,
  penaltyPerDay: number,
): PenaltyResult {
  const overdueInstallments = schedule
    .filter((entry) => entry.status !== 'PAID')
    .map((entry) => ({
      entry,
      daysLate: Math.floor(
        (today.getTime() - entry.dueDate.getTime()) / MS_PER_DAY,
      ),
    }))
    .filter(({ daysLate }) => daysLate > 0)
    .map(({ entry, daysLate }) => ({
      seq: entry.seq,
      dueDate: toDateString(entry.dueDate),
      daysLate,
      penalty: daysLate * penaltyPerDay,
    }));

  const totalPenalty = overdueInstallments.reduce(
    (sum, installment) => sum + installment.penalty,
    0,
  );

  return { totalPenalty, overdueInstallments };
}
