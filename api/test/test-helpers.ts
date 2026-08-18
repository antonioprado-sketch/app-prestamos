import { todayInMexicoCity } from '../src/loans/loan-quote';

/** Próximo lunes o viernes (el que venga primero) — nunca en el pasado, para
 * que los e2e que solo necesitan "una fecha de apertura válida" no roten. */
export function nextWeeklyOpeningDate(): string {
  const date = new Date(todayInMexicoCity());
  while (date.getUTCDay() !== 1 && date.getUTCDay() !== 5) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}
