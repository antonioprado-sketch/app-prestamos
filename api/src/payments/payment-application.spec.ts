import {
  applyPayment,
  PaymentAmountExceedsOutstandingError,
} from './payment-application';

describe('applyPayment', () => {
  it('rechaza un pago que excede lo pendiente (multa + cuotas)', () => {
    const schedule = [{ seq: 1, amount: 70, paidAmount: 0 }];
    expect(() => applyPayment(schedule, 0, 70.01)).toThrow(
      PaymentAmountExceedsOutstandingError,
    );
  });

  it('cubre primero la multa pendiente antes que cualquier cuota', () => {
    const schedule = [{ seq: 1, amount: 70, paidAmount: 0 }];
    const result = applyPayment(schedule, 50, 50);
    expect(result.penaltyApplied).toBe(50);
    expect(result.scheduleUpdates).toHaveLength(0);
  });

  it('aplica el resto tras la multa a la cuota vencida más antigua', () => {
    const schedule = [
      { seq: 1, amount: 70, paidAmount: 0 },
      { seq: 2, amount: 70, paidAmount: 0 },
    ];
    const result = applyPayment(schedule, 20, 90);
    expect(result.penaltyApplied).toBe(20);
    expect(result.scheduleUpdates).toEqual([
      { seq: 1, newPaidAmount: 70, newStatus: 'PAID' },
    ]);
  });

  it('deja una cuota en PARTIAL si el dinero no alcanza para cubrirla completa', () => {
    const schedule = [{ seq: 1, amount: 70, paidAmount: 0 }];
    const result = applyPayment(schedule, 0, 30);
    expect(result.scheduleUpdates).toEqual([
      { seq: 1, newPaidAmount: 30, newStatus: 'PARTIAL' },
    ]);
  });

  it('reparte el sobrante entre varias cuotas en orden de seq (vencida más antigua primero)', () => {
    const schedule = [
      { seq: 1, amount: 70, paidAmount: 0 },
      { seq: 2, amount: 70, paidAmount: 0 },
      { seq: 3, amount: 70, paidAmount: 0 },
    ];
    const result = applyPayment(schedule, 0, 150);
    expect(result.scheduleUpdates).toEqual([
      { seq: 1, newPaidAmount: 70, newStatus: 'PAID' },
      { seq: 2, newPaidAmount: 70, newStatus: 'PAID' },
      { seq: 3, newPaidAmount: 10, newStatus: 'PARTIAL' },
    ]);
  });

  it('ignora cuotas ya pagadas y sigue con la siguiente pendiente', () => {
    const schedule = [
      { seq: 1, amount: 70, paidAmount: 70 },
      { seq: 2, amount: 70, paidAmount: 0 },
    ];
    const result = applyPayment(schedule, 0, 70);
    expect(result.scheduleUpdates).toEqual([
      { seq: 2, newPaidAmount: 70, newStatus: 'PAID' },
    ]);
  });

  it('respeta un pago parcial previo en la misma cuota', () => {
    const schedule = [{ seq: 1, amount: 70, paidAmount: 40 }];
    const result = applyPayment(schedule, 0, 30);
    expect(result.scheduleUpdates).toEqual([
      { seq: 1, newPaidAmount: 70, newStatus: 'PAID' },
    ]);
  });

  it('marca fullyPaidOff cuando el pago liquida multa y todas las cuotas exactas', () => {
    const schedule = [{ seq: 1, amount: 70, paidAmount: 0 }];
    const result = applyPayment(schedule, 20, 90);
    expect(result.fullyPaidOff).toBe(true);
  });

  it('no marca fullyPaidOff si queda alguna cuota pendiente', () => {
    const schedule = [
      { seq: 1, amount: 70, paidAmount: 0 },
      { seq: 2, amount: 70, paidAmount: 0 },
    ];
    const result = applyPayment(schedule, 0, 70);
    expect(result.fullyPaidOff).toBe(false);
  });
});
