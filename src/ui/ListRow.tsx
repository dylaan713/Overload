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

/**
 * A row. With onPress it's a button (chevron unless `trailing` replaces it); otherwise it holds its children.
 * `subtitle` stacks under the label (iOS subtitle style); `detail` sits on the right (value style).
 */
export function ListRow({ label, detail, subtitle, onPress, disabled, trailing, children }: {
  label: string;
  detail?: string;
  subtitle?: string;
  onPress?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  const text = (
    <span className={styles.text}>
      <span className={styles.label}>{label}</span>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </span>
  );
  if (onPress || disabled) {
    return (
      <button type="button" className={[styles.row, styles.pressable].join(" ")} onClick={onPress} disabled={disabled}>
        {text}
        {detail && <span className={styles.detail}>{detail}</span>}
        {trailing ?? <ChevronRight aria-hidden="true" size={18} className={styles.chevron} />}
      </button>
    );
  }
  return (
    <div className={styles.row}>
      {label && text}
      {children}
    </div>
  );
}

/** Free-form content inside a group card (a segmented control, a field, a confirmation). */
export function ListItem({ children }: { children: ReactNode }) {
  return <div className={styles.item}>{children}</div>;
}
