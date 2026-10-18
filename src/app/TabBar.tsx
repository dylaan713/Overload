import { CalendarDays, Dumbbell, TrendingUp, type LucideIcon } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import type { Tab } from "../state/uiStore";
import styles from "./TabBar.module.css";

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "log", label: "Log", Icon: Dumbbell },
  { id: "progress", label: "Progress", Icon: TrendingUp },
  { id: "history", label: "History", Icon: CalendarDays },
];

export const tabId = (t: Tab) => `tab-${t}`;
export const panelId = "tab-panel";

/** iOS bottom tab bar, above the home indicator. Material only while content scrolls under it. */
export function TabBar({ tab, onChange, scrolled }: { tab: Tab; onChange: (t: Tab) => void; scrolled: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(e: KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + TABS.length) % TABS.length;
    refs.current[next]?.focus();
    onChange(TABS[next]!.id);
  }
  return (
    <nav className={styles.bar} data-scrolled={scrolled || undefined}>
      <div role="tablist" aria-label="Sections" className={styles.list}>
        {TABS.map(({ id, label, Icon }, i) => (
          <button
            key={id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={tabId(id)}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={panelId}
            tabIndex={tab === id ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <Icon aria-hidden="true" size={24} strokeWidth={tab === id ? 2.4 : 1.8} />
            <span className={styles.label}>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
