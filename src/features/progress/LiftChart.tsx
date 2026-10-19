import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Metric, SeriesPoint } from "../../domain/progress";
import { shortDate } from "../../app/format";
import styles from "./LiftChart.module.css";

const W = 320;
const H = 160;
const PAD = { top: 12, right: 12, bottom: 22, left: 36 };
const GRID = 3;

/**
 * A lift's line over the chosen range. Drag across it (or use ←/→) to read any day; the readout tracks the finger
 * 1:1 with no animation in between. Phase starts are vertical marks; test days are filled dots.
 */
export function LiftChart({ points, unit, metric }: { points: SeriesPoint[]; unit: string; metric: Metric }) {
  const [index, setIndex] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const at = Math.min(index ?? points.length - 1, points.length - 1);
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || hi || 1) * 0.05;
  const min = lo - pad;
  const max = hi + pad;
  const x = (i: number) => PAD.left + (points.length === 1 ? (W - PAD.left - PAD.right) / 2 : (i / (points.length - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom);
  const label = metric === "reps" ? "Reps" : "Est. 1RM";
  const valueUnit = metric === "reps" ? "reps" : unit;
  const text = (p: SeriesPoint) => `${shortDate(p.date)} · ${p.value} ${valueUnit}${p.test ? " · Test day" : ""}`;

  const nearest = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const vx = ((clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - vx) < Math.abs(x(best) - vx)) best = i;
    setIndex(best);
  };
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    nearest(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) nearest(e.clientX);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    setIndex(Math.max(0, Math.min(points.length - 1, at + step)));
  };

  const current = points[at]!;
  const ticks = Array.from({ length: GRID }, (_, i) => min + ((i + 0.5) / GRID) * (max - min));
  return (
    <div className={styles.chart}>
      <p className={styles.readout} aria-hidden="true">
        <span className={styles.value}>{current.value}</span> {valueUnit}
        <span className={styles.when}> · {shortDate(current.date)}{current.test ? " · Test day" : ""}</span>
      </p>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={points.length - 1}
        aria-valuenow={at}
        aria-valuetext={text(current)}
        onKeyDown={onKeyDown}
        className={styles.track}
      >
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className={styles.svg}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => {}}
        >
          {ticks.map((t) => (
            <g key={t} aria-hidden="true">
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={styles.grid} />
              <text x={PAD.left - 6} y={y(t)} className={styles.tick} textAnchor="end" dominantBaseline="middle">{Math.round(t)}</text>
            </g>
          ))}
          {points.map((p, i) => p.phaseStart && (
            <g key={`phase-${p.date}`} aria-label="New phase" role="img">
              <line x1={x(i)} x2={x(i)} y1={PAD.top} y2={H - PAD.bottom} className={styles.phase} />
            </g>
          ))}
          <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} className={styles.line} />
          {points.map((p, i) => (
            <circle
              key={p.date}
              data-point
              cx={x(i)}
              cy={y(p.value)}
              r={i === at ? 4.5 : 3}
              className={p.test ? styles.test : styles.dot}
              {...(p.test ? { role: "img", "aria-label": `Test day, ${text(p)}` } : { "aria-hidden": true })}
            />
          ))}
          <line x1={x(at)} x2={x(at)} y1={PAD.top} y2={H - PAD.bottom} className={styles.cursor} aria-hidden="true" />
          <text x={PAD.left} y={H - 6} className={styles.tick} aria-hidden="true">{shortDate(points[0]!.date)}</text>
          <text x={W - PAD.right} y={H - 6} className={styles.tick} textAnchor="end" aria-hidden="true">{shortDate(points.at(-1)!.date)}</text>
        </svg>
      </div>
    </div>
  );
}
