/**
 * Converts a value to a JS number if it is a pure integer or decimal string,
 * otherwise returns it as a trimmed string (or '' for nullish).
 *
 * This ensures Excel/Sheets treats numeric cells as numbers (SUM, AVG, etc.)
 * rather than text (COUNT only). Values like "7 1/4", "S4a", or "4 7/8""
 * contain non-numeric characters and are left as strings.
 *
 * Examples:
 *   "3"     → 3
 *   "10"    → 10
 *   "4.5"   → 4.5
 *   "7 1/4" → "7 1/4"
 *   "S4a"   → "S4a"
 *   ""      → ""
 *   null    → ""
 */
export function toExcelNumber(val: string | number | undefined | null): string | number {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') return val;
  const t = String(val).trim();
  if (t === '') return '';
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
}
