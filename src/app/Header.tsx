import { Settings } from "lucide-react";
import type { Ref } from "react";
import { IconButton } from "../ui/IconButton";
import styles from "./Header.module.css";

/**
 * Floating chrome over the scrolling content. The small title appears only once the large title has scrolled
 * under it, and the material shows only while content is underneath (no hairline otherwise).
 */
export function Header({ title, compact, scrolled, onSettings, gearRef }: {
  title: string;
  compact: boolean;
  scrolled: boolean;
  onSettings: () => void;
  gearRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <header className={styles.header} data-scrolled={scrolled || undefined}>
      <span />
      <span className={styles.title} data-visible={compact || undefined} aria-hidden="true">
        {title}
      </span>
      <IconButton ref={gearRef} label="Settings" onClick={onSettings} className={styles.gear}>
        <Settings aria-hidden="true" size={22} />
      </IconButton>
    </header>
  );
}
