// Fechas en hora local: toISOString() usa UTC y en Colombia (UTC−5)
// adelanta el día y el mes desde las 7 p. m.

const pad = (value: number) => String(value).padStart(2, '0');

/** Hoy en formato 'YYYY-MM-DD' */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Mes actual en formato 'YYYY-MM' */
export function currentMonthKey(now = new Date()): string {
  return todayIso(now).slice(0, 7);
}

export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Meses entre `from` y `to` (positivo si `to` es posterior) */
export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

/** `count` meses consecutivos que terminan en `endKey`, del más antiguo al más reciente */
export function monthRange(endKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(endKey, i - count + 1));
}

const LONG_MONTH = new Intl.DateTimeFormat('es-CO', { month: 'long' });
const SHORT_MONTH = new Intl.DateTimeFormat('es-CO', { month: 'short' });

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** '2026-09' → 'Septiembre' */
export function monthName(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return capitalize(LONG_MONTH.format(new Date(year, month - 1, 1)));
}

/** '2026-09' → 'Septiembre 2026' (long) o 'Sept 26' (short, para ejes) */
export function formatMonthLabel(key: string, style: 'long' | 'short' = 'long'): string {
  const [year, month] = key.split('-').map(Number);
  if (style === 'long') return `${monthName(key)} ${year}`;
  const short = SHORT_MONTH.format(new Date(year, month - 1, 1)).replace('.', '');
  return `${capitalize(short)} ${String(year).slice(2)}`;
}
