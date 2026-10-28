import { ChevronLeft, ChevronRight } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotionConfig } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { FLICK, commitOnRelease, rubberband } from "../../ui/gesture";
import { IconButton } from "../../ui/IconButton";
import { FADE, SPRING } from "../../ui/motion";
import { useAxisDrag } from "../../ui/useAxisDrag";
import styles from "./History.module.css";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const dateOf = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
const dayLabel = (s: string) => dateOf(s).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const monthTitle = (month: string) => dateOf(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

/** The month `delta` months from this one, as YYYY-MM. */
function shift(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(y!, m! - 1 + delta, 1);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}`;
}

/** "2026-10" → its weeks as rows of 7 dates (null outside the month), Sunday first. */
function weeksOf(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y!, m! - 1, 1).getDay();
  const days = new Date(y!, m!, 0).getDate();
  const cells = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => ymd(y!, m!, i + 1))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/** One month's grid. Keyed by its month, so the one you swiped to is moved into place, not rebuilt. */
function MonthGrid({ month, days, today, selected, onSelect, current }: {
  month: string;
  days: Set<string>;
  today: string;
  selected: string | null;
  onSelect(date: string): void;
  /** The month on screen; the two beside it are out of reach until they are. */
  current: boolean;
}) {
  const weeks = useMemo(() => weeksOf(month), [month]);
  return (
    <div
      role="grid"
      aria-label={monthTitle(month)}
      className={styles.grid}
      aria-hidden={!current || undefined}
      inert={!current}
    >
      <div role="row" className={styles.row}>
        {WEEKDAYS.map((w) => <span key={w} role="columnheader" aria-label={w} className={styles.weekday}>{w.slice(0, 2)}</span>)}
      </div>
      {weeks.map((week, i) => (
        <div key={i} role="row" className={styles.row}>
          {week.map((d, j) => (
            <span
              key={d ?? `blank-${j}`}
              role="gridcell"
              className={styles.cell}
              aria-label={d && !days.has(d) ? `${dayLabel(d)}, no workout` : undefined}
            >
              {d && (days.has(d) ? (
                <button
                  type="button"
                  className={styles.day}
                  data-trained
                  data-today={d === today || undefined}
                  aria-pressed={d === selected}
                  aria-label={`${dayLabel(d)}, workout`}
                  onClick={() => onSelect(d)}
                >
                  {Number(d.slice(8))}
                  <span data-dot className={styles.dot} aria-hidden="true" />
                </button>
              ) : (
                <span className={styles.day} data-today={d === today || undefined}>
                  {Number(d.slice(8))}
                </span>
              ))}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * A month calendar. Training days are tinted with a dot and tappable; today is outlined.
 *
 * The month either side is mounted and sits against it, so a sideways drag moves all three 1:1 and the month
 * you're pulling in is under your finger from the first pixel (apple-design §2). A release springs the track
 * one month over — one spring, carrying the finger's velocity, with no bounce to show the empty space past
 * the last panel — and the month changes as the spring lands; the track is re-centred before the next paint.
 */
export function Calendar({ month, days, today, selected, onSelect, onMonth }: {
  month: string; // YYYY-MM
  days: Set<string>;
  today: string;
  selected: string | null;
  onSelect(date: string): void;
  onMonth(delta: 1 | -1): void;
}) {
  const reduced = useReducedMotionConfig() ?? false;
  const x = useMotionValue(0);
  const fade = useMotionValue(1);
  const box = useRef<HTMLDivElement>(null);
  // Measured per gesture and on resize, never per frame.
  const span = useRef(0);
  const measure = () => {
    span.current = box.current?.offsetWidth ?? 0;
  };
  const width = () => span.current || 320;
  const months = useMemo(() => [shift(month, -1), month, shift(month, 1)], [month]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // The new month is rendered in the middle: re-centre the track before the browser paints it.
  useLayoutEffect(() => {
    x.set(0);
  }, [month, x]);

  const go = async (delta: 1 | -1, velocity = 0) => {
    if (reduced) {
      await animate(fade, 0, FADE);
      onMonth(delta);
      await animate(fade, 1, FADE);
      return;
    }
    // No bounce on the way: an overshoot would swing past the last mounted month and show nothing.
    await animate(x, -delta * width(), { ...SPRING.default, velocity });
    onMonth(delta);
  };

  const drag = useAxisDrag({
    axis: "x",
    value: x,
    onStart: () => {
      measure();
      x.stop();
    },
    map: (raw) => (reduced ? rubberband(raw, width()) : raw),
    onRelease(raw, velocity) {
      if (!reduced && commitOnRelease(-raw, -velocity, width())) void go(1, velocity);
      else if (!reduced && commitOnRelease(raw, velocity, width())) void go(-1, velocity);
      else void animate(x, 0, Math.abs(velocity) > FLICK ? SPRING.momentum : SPRING.default);
    },
  });

  return (
    <div className={styles.calendar}>
      <div className={styles.monthBar}>
        <IconButton label="Previous month" onClick={() => void go(-1)}><ChevronLeft size={20} aria-hidden="true" /></IconButton>
        <h2 className={styles.month}>{monthTitle(month)}</h2>
        <IconButton label="Next month" onClick={() => void go(1)}><ChevronRight size={20} aria-hidden="true" /></IconButton>
      </div>
      <div ref={box} className={styles.viewport} {...drag}>
        <motion.div className={styles.track} style={{ x, opacity: fade }}>
          {months.map((m) => (
            <MonthGrid key={m} month={m} days={days} today={today} selected={selected} onSelect={onSelect} current={m === month} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
