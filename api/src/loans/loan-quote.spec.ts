import { calculateQuote, QuoteError, todayInMexicoCity } from './loan-quote';

// Fechas calculadas relativas a "hoy" (nunca hardcodeadas) — evita que este
// archivo vuelva a "rotar" cuando pase la fecha, como ya pasó dos veces.
function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

function nextWeekday(targetDay: number): string {
  const date = new Date(todayInMexicoCity());
  while (date.getUTCDay() !== targetDay) date.setUTCDate(date.getUTCDate() + 1);
  return toIso(date);
}

function isLastDayOfMonth(date: Date): boolean {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.getUTCDate() === 1;
}

function nextQuincenaOpening(): string {
  const date = new Date(todayInMexicoCity());
  while (date.getUTCDate() !== 15 && !isLastDayOfMonth(date)) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return toIso(date);
}

const nextMonday = nextWeekday(1);
const nextFriday = nextWeekday(5);
const nextQuincena = nextQuincenaOpening();

describe('calculateQuote — semanal', () => {
  it('calcula total, cuota y 20 fechas empezando en apertura+7 días', () => {
    const result = calculateQuote({
      amount: 1000,
      model: 'WEEKLY',
      openingDate: nextMonday,
      maxAmount: null,
    });
    expect(result.total).toBe(1400);
    expect(result.payment).toBe(70);
    expect(result.lastPayment).toBe(70);
    expect(result.schedule).toHaveLength(20);
    expect(result.schedule[0].dueDate).toBe(addDays(nextMonday, 7));
    expect(result.schedule[19].dueDate).toBe(addDays(nextMonday, 20 * 7));
  });

  it('absorbe el residuo de redondeo en la última cuota', () => {
    const result = calculateQuote({
      amount: 71.44,
      model: 'WEEKLY',
      openingDate: nextMonday,
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
      openingDate: nextMonday,
      maxAmount: null,
    });
    const sum = result.schedule.reduce((acc, s) => acc + s.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(result.total);
  });

  it('rechaza fecha de apertura que no es lunes ni viernes', () => {
    const notMondayNorFriday = addDays(nextMonday, 1); // martes
    expect(() =>
      calculateQuote({
        amount: 1000,
        model: 'WEEKLY',
        openingDate: notMondayNorFriday,
        maxAmount: null,
      }),
    ).toThrow(QuoteError);
  });

  it('acepta viernes como apertura', () => {
    const result = calculateQuote({
      amount: 1000,
      model: 'WEEKLY',
      openingDate: nextFriday,
      maxAmount: null,
    });
    expect(result.schedule[0].dueDate).toBe(addDays(nextFriday, 7));
  });
});

describe('calculateQuote — quincenal', () => {
  it('calcula total, cuota y 10 fechas alternando día 15 / último día del mes', () => {
    const result = calculateQuote({
      amount: 1000,
      model: 'BIWEEKLY',
      openingDate: nextQuincena,
      maxAmount: null,
    });
    expect(result.total).toBe(1400);
    expect(result.payment).toBe(140);
    expect(result.lastPayment).toBe(140);
    expect(result.schedule).toHaveLength(10);

    // Cada fecha es día 15 o último día del mes, estrictamente ascendente.
    let previous = new Date(0);
    for (const entry of result.schedule) {
      const [y, m, d] = entry.dueDate.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      expect(d === 15 || isLastDayOfMonth(date)).toBe(true);
      expect(date.getTime()).toBeGreaterThan(previous.getTime());
      previous = date;
    }
  });

  it('acepta el último día del mes como apertura', () => {
    const [y, m, d] = nextQuincena.split('-').map(Number);
    // nextQuincena puede caer en día 15; el último día de ESE mes sigue siendo
    // una apertura válida (día 15 y último día del mes son ambos aceptados).
    const lastDayOfMonth = toIso(new Date(Date.UTC(y, m, 0)));
    const openingDate = d === 15 ? lastDayOfMonth : nextQuincena;
    const [oy, om] = openingDate.split('-').map(Number);
    const firstDue = toIso(new Date(Date.UTC(oy, om, 15)));

    const result = calculateQuote({
      amount: 1000,
      model: 'BIWEEKLY',
      openingDate,
      maxAmount: null,
    });
    expect(result.schedule[0].dueDate).toBe(firstDue);
    expect(result.schedule).toHaveLength(10);
  });

  it('rechaza fecha de apertura que no es día 15 ni último día del mes', () => {
    const d = Number(nextQuincena.split('-')[2]);
    const invalidDay =
      d === 15 ? addDays(nextQuincena, 1) : addDays(nextQuincena, -1);
    expect(() =>
      calculateQuote({
        amount: 1000,
        model: 'BIWEEKLY',
        openingDate: invalidDay,
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
        openingDate: nextMonday,
        maxAmount: null,
      }),
    ).toThrow(QuoteError);
    expect(() =>
      calculateQuote({
        amount: -100,
        model: 'WEEKLY',
        openingDate: nextMonday,
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
        openingDate: nextMonday,
        maxAmount: 3000,
      }),
    ).toThrow(QuoteError);
  });

  it('permite monto igual al máximo', () => {
    expect(() =>
      calculateQuote({
        amount: 3000,
        model: 'WEEKLY',
        openingDate: nextMonday,
        maxAmount: 3000,
      }),
    ).not.toThrow();
  });

  it('sin máximo (maxAmount null) no limita el monto', () => {
    expect(() =>
      calculateQuote({
        amount: 50000,
        model: 'WEEKLY',
        openingDate: nextMonday,
        maxAmount: null,
      }),
    ).not.toThrow();
  });

  it('nunca expone la tasa de interés en el resultado', () => {
    const result = calculateQuote({
      amount: 1000,
      model: 'WEEKLY',
      openingDate: nextMonday,
      maxAmount: null,
    });
    expect(JSON.stringify(result)).not.toMatch(/0\.4|40%|rate/i);
  });
});
