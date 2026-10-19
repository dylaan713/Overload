import type { SeriesPoint, Trend } from "../../domain/progress";
import styles from "./Progress.module.css";

const W = 64;
const H = 20;

/** A lift's 8 weeks at a glance. Decorative: the row's text says the same thing. */
export function Sparkline({ points, trend }: { points: SeriesPoint[]; trend: Trend | null }) {
  if (points.length < 2 || trend === null) return <span className={styles.spark} aria-hidden="true" />;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo || 1;
  const xy = values.map((v, i) => `${((i / (values.length - 1)) * (W - 2) + 1).toFixed(1)},${(H - 1 - ((v - lo) / span) * (H - 2)).toFixed(1)}`);
  const tone = trend === "down" ? "down" : trend === "flat" || trend === null ? "flat" : "up";
  return (
    <svg className={styles.spark} data-tone={tone} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline points={xy.join(" ")} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
