import { ChevronLeft, ChevronRight } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotionConfig } from "motion/react";
import { useRef } from "react";
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

/** "2026-10" → its weeks as rows of 7 dates (null outside the month), Sunday first. */
function weeksOf(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y!, m! - 1, 1).getDay();
  const days = new Date(y!, m!, 0).getDate();
  const cells = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => ymd(y!, m!, i + 1))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/**
 * A month grid. Training days are tinted with a dot and tappable; today is outlined. The grid follows a sideways
 * drag 1:1 and, on release, springs on to the next/previous month or back (a flick carries a little bounce).
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
  const width = () => box.current?.offsetWidth || 320;
  const title = dateOf(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const go = async (delta: 1 | -1, velocity = 0) => {
    if (reduced) {
      await animate(fade, 0, FADE);
      onMonth(delta);
      x.set(0);
      await animate(fade, 1, FADE);
      return;
    }
    const spring = Math.abs(velocity) > FLICK ? SPRING.momentum : SPRING.default;
    await animate(x, -delta * width(), { ...spring, velocity });
    onMonth(delta);
    x.set(delta * width());
    await animate(x, 0, SPRING.default);
  };

  const drag = useAxisDrag({
    axis: "x",
    value: x,
    onStart: () => x.stop(),
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
        <h2 className={styles.month}>{title}</h2>
        <IconButton label="Next month" onClick={() => void go(1)}><ChevronRight size={20} aria-hidden="true" /></IconButton>
      </div>
      <div ref={box} className={styles.viewport} {...drag}>
        <motion.div role="grid" aria-label={title} className={styles.grid} style={{ x, opacity: fade }}>
          <div role="row" className={styles.row}>
            {WEEKDAYS.map((w) => <span key={w} role="columnheader" aria-label={w} className={styles.weekday}>{w.slice(0, 2)}</span>)}
          </div>
          {weeksOf(month).map((week, i) => (
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
        </motion.div>
      </div>
    </div>
  );
}
