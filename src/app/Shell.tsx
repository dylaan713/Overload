import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotionConfig, useTransform } from "motion/react";
import { themePreference } from "../domain/theme";
import { LogScreen } from "../features/log/LogScreen";
import { NextExerciseSheet } from "../features/log/NextExerciseView";
import { HistoryScreen } from "../features/history/HistoryScreen";
import { WorkoutSheet } from "../features/history/WorkoutSheet";
import { repeatWorkout } from "../features/history/repeat";
import { LiftSheet } from "../features/progress/LiftSheet";
import { ProgressScreen } from "../features/progress/ProgressScreen";
import { settingsView } from "../features/settings/SettingsRoot";
import { useApp, useAppStore, useUi, useUiStore } from "../state/context";
import type { Tab } from "../state/uiStore";
import { Button } from "../ui/Button";
import { SheetStack, type SheetView } from "../ui/SheetStack";
import { sheetProgress } from "../ui/sheetProgress";
import { ToastView } from "../ui/Toast";
import { Banner } from "./Banner";
import { Header } from "./Header";
import { TabBar, panelId, tabId } from "./TabBar";
import { applyTheme } from "./theme";
import styles from "./Shell.module.css";

const TITLES: Record<Tab, string> = { log: "Log", progress: "Progress", history: "History" };
const PANELS: Record<Tab, () => React.JSX.Element> = { log: LogScreen, progress: ProgressScreen, history: HistoryScreen };

/** The app frame: scrolling content under floating chrome, the Settings sheet, toasts and save errors. */
export function Shell({ settingsRoot = settingsView }: { settingsRoot?: () => SheetView }) {
  const ui = useUiStore();
  const appStore = useAppStore();
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const sheet = useUi((s) => s.sheet);
  const sheetSearch = useUi((s) => s.sheetSearch);
  const sheetArg = useUi((s) => s.sheetArg);
  const openSheet = useUi((s) => s.openSheet);
  const closeSheet = useUi((s) => s.closeSheet);
  const toast = useUi((s) => s.toast);
  const dismissToast = useUi((s) => s.dismissToast);
  const saveError = useApp((s) => s.saveError);
  const dismissSaveError = useApp((s) => s.dismissSaveError);
  const theme = useApp((s) => s.doc.settings.theme);

  const scroller = useRef<HTMLElement>(null);
  const largeTitle = useRef<HTMLHeadingElement>(null);
  const gear = useRef<HTMLButtonElement>(null);
  const [compact, setCompact] = useState(false);
  const [underTop, setUnderTop] = useState(false);
  const [underBottom, setUnderBottom] = useState(false);
  const sheetOpen = sheet !== null;
  const reduced = useReducedMotionConfig() ?? false;
  // The page tucks back behind a sheet. Transform only: no layout, no paint, no document-wide style recalc.
  const pageY = useTransform(sheetProgress, (p) => 10 * (1 - p));
  const pageScale = useTransform(sheetProgress, (p) => 0.94 + 0.06 * p);

  useLayoutEffect(() => applyTheme(themePreference(theme)), [theme]);

  // Chrome turns to material only while content is actually under it.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      setUnderTop(el.scrollTop > 0);
      setUnderBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [tab]);

  // The small title appears once the large title has gone under the header.
  useEffect(() => {
    const el = largeTitle.current;
    if (!el) return setCompact(false); // the Log tab has no large title
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCompact(!entry!.isIntersecting), { root: scroller.current, rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [tab]);

  // After the sheet is gone (and the page is no longer inert), focus goes back to what opened it, or the gear
  // if that has gone. The Sheet can't do this itself: the page is still inert when it unmounts.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !sheetOpen) {
      const to = ui.getState().focusAfterSheet;
      const el = to === "entry" ? document.querySelector<HTMLElement>("[data-entry-focus]") : to;
      (el?.isConnected ? el : gear.current)?.focus();
    }
    wasOpen.current = sheetOpen;
  }, [sheetOpen, ui]);

  const Panel = PANELS[tab];
  return (
    <>
      {/* The black the scaled page sits on. A static layer: as a 100vmax shadow it repainted every frame. */}
      {sheetOpen && !reduced && <div data-backdrop className={styles.backdrop} aria-hidden="true" />}
      <motion.div
        data-page
        className={styles.page}
        inert={sheetOpen}
        data-sheet={sheetOpen || undefined}
        style={reduced ? undefined : { y: pageY, scale: pageScale }}
      >
        <Header title={TITLES[tab]} compact={compact} scrolled={underTop} onSettings={() => openSheet("settings")} gearRef={gear} />
        <main ref={scroller} className={styles.content}>
          {/* The Log trades its large title for the workout's own header; VoiceOver still gets the heading. */}
          <h1 ref={tab === "log" ? undefined : largeTitle} className={tab === "log" ? styles.srOnly : styles.largeTitle}>{TITLES[tab]}</h1>
          <div id={panelId} role="tabpanel" aria-labelledby={tabId(tab)}>
            <Panel />
          </div>
        </main>
        <TabBar tab={tab} onChange={setTab} scrolled={underBottom} />
      </motion.div>
      {sheet === "settings" && <SheetStack root={settingsRoot()} onClose={closeSheet} />}
      {sheet === "next-exercise" && <NextExerciseSheet search={sheetSearch} onClose={closeSheet} />}
      {sheet === "lift" && sheetArg && <LiftSheet exerciseId={sheetArg} onClose={closeSheet} />}
      {sheet === "workout" && sheetArg && <WorkoutSheet date={sheetArg} onClose={closeSheet} onRepeat={(d) => repeatWorkout(appStore, ui, d)} />}
      {saveError && (
        <div className={styles.alerts}>
          <Banner tone="error" role="alert">
            <span>{saveError}</span>
            <Button variant="ghost" onClick={dismissSaveError}>Dismiss</Button>
          </Banner>
        </div>
      )}
      <ToastView toast={toast} onDismiss={dismissToast} />
    </>
  );
}
