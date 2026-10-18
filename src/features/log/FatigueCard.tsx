import { Button } from "../../ui/Button";
import styles from "./Log.module.css";

/** The engine's whole-body fatigue suggestion. Nothing changes unless it's accepted. */
export function FatigueCard({ reason, onAccept, onDismiss }: { reason: string; onAccept: () => void; onDismiss: () => void }) {
  return (
    <section aria-label="Suggestion" className={styles.card}>
      <p>{reason}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onDismiss}>Dismiss</Button>
        <Button variant="primary" onClick={onAccept}>Accept</Button>
      </div>
    </section>
  );
}
