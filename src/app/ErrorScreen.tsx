import { Button } from "../ui/Button";
import styles from "./ErrorScreen.module.css";

/** A boot failure: nothing was written, and everything stored can be saved as-is. */
export function ErrorScreen({ message, onDownloadRaw }: { message: string; onDownloadRaw: () => void }) {
  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>Couldn&apos;t read your data</h1>
      <p className={styles.body}>Nothing was changed or deleted. You can save exactly what is stored on this device.</p>
      <Button variant="primary" block onClick={onDownloadRaw}>
        Download raw data
      </Button>
      <pre className={styles.detail}>{message}</pre>
    </main>
  );
}
