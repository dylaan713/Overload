import type { ReactNode } from "react";
import styles from "./Pill.module.css";

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "accent"; children: ReactNode }) {
  return <span className={[styles.pill, styles[tone]].join(" ")}>{children}</span>;
}
