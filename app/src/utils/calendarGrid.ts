/** Local calendar date key for bucketing due dates (no timezone conversion beyond JS Date local fields). */
export function dateToLocalKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO due string → local YYYY-MM-DD. Invalid dates yield empty string. */
export function dueDateLocalKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return dateToLocalKey(d);
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return dateToLocalKey(a) === dateToLocalKey(b);
}

/** First moment of local calendar day (month 0–11). */
export function localDay(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day);
}

/** Sunday-first week: 6 rows × 7 columns, `null` = outside current month. */
export function getCalendarMonthGrid(visibleMonth: Date): (Date | null)[][] {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length < 42) {
    cells.push(null);
  }
  const rows: (Date | null)[][] = [];
  for (let r = 0; r < 6; r++) {
    rows.push(cells.slice(r * 7, r * 7 + 7));
  }
  return rows;
}

export function addMonths(d: Date, delta: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  return next;
}

export function monthTitle(d: Date): string {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}
