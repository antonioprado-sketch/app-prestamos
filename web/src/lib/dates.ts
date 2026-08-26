const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function partsFor(date: Date, timeZone: string | undefined) {
  const fmt = new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { weekday: get('weekday'), day: get('day'), month: get('month'), year: get('year') };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Formatea una fecha como "viernes 13/Nov/2026". Acepta Date o ISO string.
// Las cadenas de solo fecha (YYYY-MM-DD, p. ej. fechas de calendario de un
// cronograma) se interpretan como medianoche UTC para no correr el día por
// la zona horaria local (ver calculator-dates.ts).
export function formatShortDate(value: Date | string): string {
  const isCalendar = typeof value === 'string' && DATE_ONLY_RE.test(value);
  const date = isCalendar ? new Date(`${value}T00:00:00Z`) : new Date(value);
  const p = partsFor(date, isCalendar ? 'UTC' : undefined);
  return `${p.weekday} ${p.day}/${capitalize(p.month)}/${p.year}`;
}

// Igual que formatShortDate pero con hora: "viernes 13/Nov/2026, 14:30".
export function formatShortDateTime(value: Date | string): string {
  const date = new Date(value);
  const p = partsFor(date, undefined);
  const time = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${p.weekday} ${p.day}/${capitalize(p.month)}/${p.year}, ${time}`;
}
