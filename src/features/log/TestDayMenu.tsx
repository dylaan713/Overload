import { Ellipsis } from "lucide-react";
import { useId, useState } from "react";
import { TEST_DAY_LOCKED } from "../../domain/log";
import { IconButton } from "../../ui/IconButton";
import styles from "./Log.module.css";

/** Tucked-away options for the current exercise: the powerlifting test-day switch. */
export function TestDayMenu({ on, locked, onChange }: { on: boolean; locked: boolean; onChange: (on: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={styles.more}>
      <IconButton label="More options" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Ellipsis aria-hidden="true" size={22} />
      </IconButton>
      {open && (
        <div id={id} className={styles.menu}>
          <button type="button" role="switch" aria-checked={on} disabled={locked} className={styles.switchRow} onClick={() => onChange(!on)}>
            <span>Test day</span>
            <span className={styles.switch} aria-hidden="true" />
          </button>
          {locked && <p className={styles.note}>{TEST_DAY_LOCKED}</p>}
        </div>
      )}
    </div>
  );
}
