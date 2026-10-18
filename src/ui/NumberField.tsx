import { useEffect, useId, useState } from "react";
import { Field, Input } from "./Field";
import styles from "./Field.module.css";

export function rangeMessage(min?: number, max?: number, integer = false): string {
  const kind = integer ? "a whole number" : "a number";
  if (min != null && max != null) return `Enter ${kind} from ${min} to ${max}`;
  if (min != null) return `Enter ${kind} ${min} or higher`;
  if (max != null) return `Enter ${kind} ${max} or lower`;
  return `Enter ${kind}`;
}

export interface NumberFieldProps {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  integer?: boolean;
  optional?: boolean; // empty commits null
  suffix?: string;
  placeholder?: string;
  onChange: (value: number | null) => void;
}

const show = (v: number | null) => (v == null ? "" : String(v));

// Lets the user type freely; commits a valid number on blur or Enter. Anything invalid
// (empty, non-numeric, out of range, a fraction where a whole number is needed) explains itself and reverts.
export function NumberField({ label, value, min, max, integer = false, optional = false, suffix, placeholder, onChange }: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(show(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(show(value));
  }, [value]);

  function commit() {
    const trimmed = text.trim();
    if (trimmed === "") {
      if (optional) {
        setError(null);
        if (value !== null) onChange(null);
      } else {
        setError(rangeMessage(min, max, integer));
        setText(show(value));
      }
      return;
    }
    const n = Number(trimmed);
    const valid = Number.isFinite(n) && (min == null || n >= min) && (max == null || n <= max) && (!integer || Number.isInteger(n));
    if (valid) {
      setError(null);
      if (n !== value) onChange(n);
    } else {
      setError(rangeMessage(min, max, integer));
      setText(show(value));
    }
  }

  const input = (
    <Input
      id={id}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      value={text}
      placeholder={placeholder}
      aria-invalid={error ? "true" : undefined}
      onChange={(e) => {
        setText(e.target.value);
        setError(null);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );

  return (
    <Field label={label} htmlFor={id} error={error}>
      {suffix ? (
        <div className={styles.withSuffix}>
          {input}
          <span className={styles.suffix}>{suffix}</span>
        </div>
      ) : (
        input
      )}
    </Field>
  );
}
