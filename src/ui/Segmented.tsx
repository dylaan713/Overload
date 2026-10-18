import { useId, useRef, type KeyboardEvent } from "react";
import { LayoutGroup, motion } from "motion/react";
import { SPRING } from "./motion";
import styles from "./Segmented.module.css";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

// iOS segmented control. The thumb is one shared-layout element, so it slides from wherever it is
// (even mid-slide) to the new option on a spring.
export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T | null;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.findIndex((o) => o.value === value);
  const focusable = current === -1 ? 0 : current;

  function onKeyDown(e: KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next]!.value);
  }

  return (
    <LayoutGroup id={id}>
      <div role="radiogroup" aria-label={label} className={styles.group}>
        {options.map((o, i) => {
          const checked = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={i === focusable ? 0 : -1}
              className={styles.option}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {checked && <motion.span layoutId="thumb" className={styles.thumb} transition={SPRING.snappy} />}
              <span className={styles.label}>{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
