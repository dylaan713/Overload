/** "Sep 1" from a local YYYY-MM-DD. */
export function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
