import { ChevronRight } from "lucide-react";
import { useId, type ReactNode } from "react";
import styles from "./ListRow.module.css";

/** An iOS grouped inset list: a titled section (a landmark region) around a rounded card of rows. */
export function ListGroup({ title, footer, children }: { title: string; footer?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.group}>
      <h2 id={id} className={styles.groupTitle}>{title}</h2>
      <div className={styles.card}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </section>
  );
}

/** A row: navigates (chevron) when it has onPress, otherwise holds its children (controls, text). */
export function ListRow({ label, detail, onPress, children }: { label: string; detail?: string; onPress?: () => void; children?: ReactNode }) {
  if (onPress) {
    return (
      <button type="button" className={[styles.row, styles.pressable].join(" ")} onClick={onPress}>
        <span className={styles.label}>{label}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
        <ChevronRight aria-hidden="true" size={18} className={styles.chevron} />
      </button>
    );
  }
  return (
    <div className={styles.row}>
      {label && <span className={styles.label}>{label}</span>}
      {children}
    </div>
  );
}

/** Free-form content inside a group card (a segmented control, a field, a confirmation). */
export function ListItem({ children }: { children: ReactNode }) {
  return <div className={styles.item}>{children}</div>;
}
