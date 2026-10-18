import { useId } from "react";
import styles from "./ChipGroup.module.css";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

// Multi-select toggle chips (muscle pickers). onChange always receives the selection in options order.
export function ChipGroup<T extends string>({ label, options, value, onChange, error }: {
  label: string;
  options: ChipOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  error?: string | null;
}) {
  const id = useId();
  const toggle = (v: T) => {
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    onChange(options.map((o) => o.value).filter((o) => next.includes(o)));
  };
  return (
    <div className={styles.wrap}>
      <span id={id} className={styles.label}>{label}</span>
      <div role="group" aria-labelledby={id} className={styles.chips}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={styles.chip}
            aria-pressed={value.includes(o.value)}
            disabled={o.disabled}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
  );
}
