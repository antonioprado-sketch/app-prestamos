export interface DateChip {
  full: string;
  day: string;
  dayNum: number;
  month: string;
}

// Fecha de hoy en YYYY-MM-DD según la zona horaria de negocio.
export function todayInMexicoCity(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// El chip recibe un Date construido como medianoche UTC de una fecha de
// calendario (ver nextValidDates). Formatear el día con la zona horaria local
// del navegador (ej. America/Mexico_City, UTC-6) lo corre al día anterior
// (lunes → domingo, viernes → jueves); por eso se fuerza timeZone: 'UTC'.
function chipFor(date: Date): DateChip {
  const day = new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: 'UTC' }).format(date);
  const month = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' }).format(date);
  return {
    full: date.toISOString().slice(0, 10),
    day: day.charAt(0).toUpperCase() + day.slice(1),
    dayNum: date.getUTCDate(),
    month: month.charAt(0).toUpperCase() + month.slice(1),
  };
}

// Mismas reglas que el backend (loan-quote.ts): semanal = lunes/viernes,
// quincenal = día 15 o último día del mes; siempre hoy o en el futuro.
export function nextValidDates(model: 'WEEKLY' | 'BIWEEKLY', count: number): DateChip[] {
  const today = todayInMexicoCity();
  const cursor = new Date(`${today}T00:00:00Z`);
  const out: DateChip[] = [];
  let probe = cursor;
  while (out.length < count) {
    if (model === 'WEEKLY') {
      const dow = probe.getUTCDay();
      if (dow === 1 || dow === 5) out.push(chipFor(probe));
    } else {
      const date = probe.getUTCDate();
      const last = new Date(
        Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth() + 1, 0),
      ).getUTCDate();
      if (date === 15 || date === last) out.push(chipFor(probe));
    }
    probe = new Date(probe.getTime() + 86400000);
  }
  return out;
}