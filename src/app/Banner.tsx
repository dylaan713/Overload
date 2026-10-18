import type { ReactNode } from "react";
import styles from "./Banner.module.css";

export function Banner({ tone = "info", role, children }: { tone?: "info" | "error"; role?: "alert"; children: ReactNode }) {
  return (
    <div role={role} className={[styles.banner, tone === "error" ? styles.error : ""].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
