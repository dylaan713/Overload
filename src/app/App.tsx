import { useEffect, useState } from "react";
import { dumpRaw } from "../data/boot";
import type { KeyValueStore } from "../data/kv";
import { todayYmd } from "../domain/dates";
import { createAppStore } from "../state/appStore";
import { StoreProvider, useApp, useKv } from "../state/context";
import { createUiStore, watchHidden } from "../state/uiStore";
import { MotionRoot } from "../ui/motion";
import { downloadText } from "./download";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorScreen } from "./ErrorScreen";
import { Shell } from "./Shell";
import styles from "./ErrorScreen.module.css";

/** Saves everything stored on the device, as-is. Never writes. */
export const downloadRaw = async (kv: KeyValueStore) =>
  downloadText(`overload-raw-data-${todayYmd()}.json`, JSON.stringify(await dumpRaw(kv), null, 2));

export function App({ kv }: { kv: KeyValueStore }) {
  const [stores] = useState(() => ({ app: createAppStore(kv), ui: createUiStore(kv), kv }));
  useEffect(() => {
    // Both are idempotent, so StrictMode's double effects still boot once.
    void stores.ui.getState().hydrate();
    void stores.app.getState().init();
  }, [stores]);
  useEffect(() => watchHidden(stores.ui), [stores]);
  return (
    <MotionRoot>
      <ErrorBoundary onDownloadRaw={() => void downloadRaw(kv)}>
        <StoreProvider value={stores}>
          <Root />
        </StoreProvider>
      </ErrorBoundary>
    </MotionRoot>
  );
}

function Root() {
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const kv = useKv();
  if (status === "loading") {
    return (
      <main className={styles.screen} aria-busy="true">
        <p className={styles.body}>Loading…</p>
      </main>
    );
  }
  if (status === "error") {
    return (
      <ErrorScreen
        message={error ?? "Unknown error"}
        onDownloadRaw={() => void downloadRaw(kv)}
      />
    );
  }
  return <Shell />;
}
