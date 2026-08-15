export interface PaymentScheduleEntry {
  seq: number;
  amount: number;
  paidAmount: number;
}

export interface ScheduleUpdate {
  seq: number;
  newPaidAmount: number;
  newStatus: 'PARTIAL' | 'PAID';
}

export interface PaymentApplicationResult {
  penaltyApplied: number;
  scheduleUpdates: ScheduleUpdate[];
  fullyPaidOff: boolean;
}

export class PaymentAmountExceedsOutstandingError extends Error {}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function applyPayment(
  schedule: PaymentScheduleEntry[],
  outstandingPenalty: number,
  amount: number,
): PaymentApplicationResult {
  const scheduleOutstanding = schedule.reduce(
    (sum, entry) => sum + round2(entry.amount - entry.paidAmount),
    0,
  );
  const totalOutstanding = round2(outstandingPenalty + scheduleOutstanding);

  if (amount > totalOutstanding) {
    throw new PaymentAmountExceedsOutstandingError(
      `El pago excede lo pendiente ($${totalOutstanding.toFixed(2)})`,
    );
  }

  let remaining = amount;
  const penaltyApplied = round2(Math.min(remaining, outstandingPenalty));
  remaining = round2(remaining - penaltyApplied);

  const scheduleUpdates: ScheduleUpdate[] = [];
  const sorted = [...schedule].sort((a, b) => a.seq - b.seq);

  for (const entry of sorted) {
    if (remaining <= 0) break;
    const due = round2(entry.amount - entry.paidAmount);
    if (due <= 0) continue;

    const applied = round2(Math.min(remaining, due));
    const newPaidAmount = round2(entry.paidAmount + applied);
    remaining = round2(remaining - applied);

    scheduleUpdates.push({
      seq: entry.seq,
      newPaidAmount,
      newStatus: newPaidAmount >= entry.amount ? 'PAID' : 'PARTIAL',
    });
  }

  const updateBySeq = new Map(scheduleUpdates.map((u) => [u.seq, u]));
  const allScheduleFullyPaid = sorted.every((entry) => {
    const update = updateBySeq.get(entry.seq);
    return update
      ? update.newStatus === 'PAID'
      : entry.paidAmount >= entry.amount;
  });
  const fullyPaidOff =
    allScheduleFullyPaid && round2(outstandingPenalty - penaltyApplied) <= 0;

  return { penaltyApplied, scheduleUpdates, fullyPaidOff };
}
