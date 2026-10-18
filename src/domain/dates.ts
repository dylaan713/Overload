// Local calendar dates as "YYYY-MM-DD". All arithmetic uses local Date parts, never UTC,
// so a late-evening workout never lands on tomorrow.

const pad = (n: number) => String(n).padStart(2, "0");

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function todayYmd(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return todayYmd(d);
}

/** b − a in whole days. Rounded so a DST hour doesn't shave off a day. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

/** The Sunday on or before `date`. */
export function weekStart(date: string): string {
  return addDays(date, -parse(date).getDay());
}
