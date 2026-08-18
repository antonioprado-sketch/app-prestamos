import { describe, expect, it } from 'vitest';
import { nextValidDates, todayInMexicoCity } from './calculator-dates';

const esShort = new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: 'UTC' });
const monthShort = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' });

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

describe('nextValidDates', () => {
  it('semanal: devuelve solo lunes o viernes, desde hoy o el futuro', () => {
    const chips = nextValidDates('WEEKLY', 5);
    expect(chips).toHaveLength(5);
    const today = todayInMexicoCity();
    for (const chip of chips) {
      expect(chip.full >= today).toBe(true);
      const dow = weekdayOf(chip.full);
      expect([1, 5]).toContain(dow);
    }
  });

  it('el día y mes del chip corresponden a la fecha real en calendario (UTC)', () => {
    const chips = nextValidDates('WEEKLY', 5);
    for (const chip of chips) {
      const [y, m, d] = chip.full.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      const label = esShort.format(date);
      expect(chip.day).toBe(label.charAt(0).toUpperCase() + label.slice(1));
      expect(chip.dayNum).toBe(d);
      const monthLabel = monthShort.format(date);
      expect(chip.month).toBe(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1));
    }
  });

  it('quincenal: devuelve día 15 o el último día del mes', () => {
    const chips = nextValidDates('BIWEEKLY', 4);
    expect(chips).toHaveLength(4);
    const today = todayInMexicoCity();
    for (const chip of chips) {
      expect(chip.full >= today).toBe(true);
      const [y, m, d] = chip.full.split('-').map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      expect([15, last]).toContain(d);
    }
  });

  it('la primera fecha semanal es el próximo lunes o viernes a partir de hoy', () => {
    const [first] = nextValidDates('WEEKLY', 1);
    const today = todayInMexicoCity();
    let probe = today;
    while (weekdayOf(probe) !== 1 && weekdayOf(probe) !== 5) {
      const [y, m, d] = probe.split('-').map(Number);
      const next = new Date(Date.UTC(y, m - 1, d + 1));
      probe = next.toISOString().slice(0, 10);
    }
    expect(first.full).toBe(probe);
  });
});