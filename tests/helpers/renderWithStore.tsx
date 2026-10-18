import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryKV } from "../../src/data/kv";
import type { StoreDoc } from "../../src/domain/types";
import { createAppStore } from "../../src/state/appStore";
import { StoreProvider } from "../../src/state/context";
import { createUiStore } from "../../src/state/uiStore";
import { MotionRoot } from "../../src/ui/motion";
import { doc as buildDoc } from "./build";
import { seedDoc, type MemoryKV } from "./seed";

/** Renders UI over real stores on an in-memory KV (default: an empty v2 doc), booted unless init: false. */
export async function renderWithStore(
  ui: ReactElement,
  opts: { doc?: StoreDoc; legacy?: Record<string, string>; kv?: MemoryKV; init?: boolean; today?: string; now?: () => number } = {},
) {
  const kv = opts.kv ?? (opts.legacy ? createMemoryKV(opts.legacy) : seedDoc(opts.doc ?? buildDoc({})));
  const app = createAppStore(kv, opts.today ? { today: () => opts.today! } : {});
  const uiStore = createUiStore(kv, opts.now ? { now: opts.now } : {});
  if (opts.init !== false) {
    await uiStore.getState().hydrate();
    await app.getState().init();
  }
  const user = userEvent.setup();
  const result = render(
    <MotionRoot>
      <StoreProvider value={{ app, ui: uiStore, kv }}>{ui}</StoreProvider>
    </MotionRoot>,
  );
  return { ...result, kv, app, uiStore, user };
}
