import { describe, expect, it } from 'vitest';
import { formatShortDate, formatShortDateTime } from './dates';

describe('formatShortDate', () => {
  it('Vie 13/Nov/2026 para una fecha de calendario (sin zona horaria)', () => {
    expect(formatShortDate('2026-11-13')).toBe('vie 13/Nov/2026');
  });

  it('usa el día correcto sin correrlo por la zona horaria local (UTC-6)', () => {
    expect(formatShortDate('2026-11-16')).toBe('lun 16/Nov/2026');
  });

  it('acepta un objeto Date', () => {
    const date = new Date('2026-11-13T12:00:00.000Z');
    expect(formatShortDate(date)).toMatch(/13\/Nov\/2026$/);
  });

  it('acepta un ISO string con hora y respeta la fecha', () => {
    expect(formatShortDate('2026-11-13T18:30:00.000Z')).toMatch(/13\/Nov\/2026$/);
  });

  it('meses de un dígito se paddean a 2 dígitos', () => {
    expect(formatShortDate('2026-03-04')).toBe('mié 04/Mar/2026');
  });
});

describe('formatShortDateTime', () => {
  it('incluye la hora tras la fecha', () => {
    expect(formatShortDateTime('2026-11-13T14:30:00.000Z')).toMatch(
      /13\/Nov\/2026, \d{2}:\d{2}$/,
    );
  });
});