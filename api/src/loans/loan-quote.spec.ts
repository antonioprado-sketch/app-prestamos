import { calculateQuote, QuoteError } from './loan-quote';

describe('calculateQuote — semanal', () => {
  it('calcula total, cuota y 20 fechas empezando en apertura+7 días', () => {
    // 2026-08-17 es lunes
    const result = calculateQuote({
      amount: 1000,
      model: 'WEEKLY',
      openingDate: '2026-08-17',
      maxAmount: null,
    });
    expect(result.total).toBe(1400);
    expect(result.payment).toBe(70);
    expect(result.lastPayment).toBe(70);
    expect(result.schedule).toHaveLength(20);
    expect(result.schedule[0].dueDate).toBe('2026-08-24');
    expect(result.schedule[19].dueDate).toBe('2027-01-04');
  });

  it('absorbe el residuo de redondeo en la última cuota', () => {
    const result = calculateQuote({
      amount: 71.44,
      model: 'WEEKLY',
      openingDate: '2026-08-17',
      maxAmount: null,
    });
    expect(result.total).toBe(100.02);
    expect(result.payment).toBe(5.0);
    expect(result.schedule[18].amount).toBe(5.0);
    expect(result.schedule[19].amount).toBe(5.02);
  });

  it('la suma de las cuotas es exactamente el total', () => {
    const result = calculateQuote({
      amount: 71.44,
      model: 'WEEKLY',
      openingDate: '2026-08-17',
      maxAmount: null,
    });
    const sum = result.schedule.reduce((acc, s) => acc + s.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(result.total);
  });

  it('rechaza fecha de apertura que no es lunes ni viernes', () => {
    expect(() =>
      calculateQuote({
        amount: 1000,
        model: 'WEEKLY',
        openingDate: '2026-08-18',
        maxAmount: null,
      }),
    ).toThrow(QuoteError);
  });

  it('acepta viernes como apertura', () => {
    // 2026-08-21 es viernes
    const result = calculateQuote({
      amount: 1000,
      model: 'WEEKLY',
      openingDate: '2026-08-21',
      maxAmount: null,
    });
    expect(result.schedule[0].dueDate).toBe('2026-08-28');
  });
});

describe('calculateQuote — quincenal', () => {
  it('calcula total, cuota y 10 fechas alternando día 15 / último día del mes', () => {
    const result = calculateQuote({
      amount: 1000,
      model: 'BIWEEKLY',
      openingDate: '2026-08-15',
      maxAmount: null,
    });
    expect(result.total).toBe(1400);
    expect(result.payment).toBe(140);
    expect(result.lastPayment).toBe(140);
    expect(result.schedule).toHaveLength(10);
    expect(result.schedule[0].dueDate).toBe('2026-08-31');
    expect(result.schedule[1].dueDate).toBe('2026-09-15');
    expect(result.schedule[9].dueDate).toBe('2027-01-15');
  });

  it('acepta el último día del mes como apertura', () => {
    const result = calculateQuote({
      amount: 1000,
      model: 'BIWEEKLY',
      openingDate: '2026-09-30',
      maxAmount: null,
    });
    expect(result.schedule[0].dueDate).toBe('2026-10-15');
  });

  it('rechaza fecha de apertura que no es día 15 ni último día del mes', () => {
    expect(() =>
      calculateQuote({
        amount: 1000,
        model: 'BIWEEKLY',
        openingDate: '2026-08-16',
        maxAmount: null,
      }),
    ).toThrow(QuoteError);
  });
});

describe('calculateQuote — validaciones generales', () => {
  it('rechaza monto en cero o negativo', () => {
    expect(() =>
      calculateQuote({
        amount: 0,
        model: 'WEEKLY',
        openingDate: '2026-08-17',
        maxAmount: null,
      }),
    ).toThrow(QuoteError);
    expect(() =>
      calculateQuote({
        amount: -100,
        model: 'WEEKLY',
        openingDate: '2026-08-17',
        maxAmount: null,
      }),
    ).toThrow(QuoteError);
  });

  it('rechaza fecha de apertura en el pasado', () => {
    expect(() =>
      calculateQuote({
        amount: 1000,
        model: 'WEEKLY',
        openingDate: '2020-01-01',
        maxAmount: null,
      }),
    ).toThrow(QuoteError);
  });

  it('rechaza monto que excede el máximo cuando se pasa un límite', () => {
    expect(() =>
      calculateQuote({
        amount: 3001,
        model: 'WEEKLY',
        openingDate: '2026-08-17',
        maxAmount: 3000,
      }),
    ).toThrow(QuoteError);
  });

  it('permite monto igual al máximo', () => {
    expect(() =>
      calculateQuote({
        amount: 3000,
        model: 'WEEKLY',
        openingDate: '2026-08-17',
        maxAmount: 3000,
      }),
    ).not.toThrow();
  });

  it('sin máximo (maxAmount null) no limita el monto', () => {
    expect(() =>
      calculateQuote({
        amount: 50000,
        model: 'WEEKLY',
        openingDate: '2026-08-17',
        maxAmount: null,
      }),
    ).not.toThrow();
  });

  it('nunca expone la tasa de interés en el resultado', () => {
    const result = calculateQuote({
      amount: 1000,
      model: 'WEEKLY',
      openingDate: '2026-08-17',
      maxAmount: null,
    });
    expect(JSON.stringify(result)).not.toMatch(/0\.4|40%|rate/i);
  });
});
