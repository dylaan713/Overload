import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import styles from "./Field.module.css";

/** Id of a Field's error text; the control sets `aria-describedby` to it so VoiceOver reads the reason. */
export const fieldErrorId = (htmlFor: string) => `${htmlFor}-error`;

export function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string | null; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.label}>{label}</label>
      {children}
      {error && <p id={fieldErrorId(htmlFor)} role="alert" className={styles.error}>{error}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[styles.control, className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={[styles.control, className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}
