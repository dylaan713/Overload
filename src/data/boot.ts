import type { StoreDoc } from "../domain/types";
import type { KeyValueStore } from "./kv";
import { LEGACY_KEYS } from "./legacy";
import { emptyDoc, loadDoc, saveDoc } from "./store";

export interface BootResult {
  kind: "v2" | "fresh";
  doc: StoreDoc;
  warnings: string[];
}

/**
 * v2 present → use it (a corrupt v2 throws and is never overwritten).
 * Else start empty, whatever legacy keys exist: the new app doesn't import old history.
 * `persist:false` is a dry run: nothing is written.
 */
export async function bootStore(kv: KeyValueStore, opts: { persist?: boolean } = {}): Promise<BootResult> {
  const persist = opts.persist ?? true;
  const warnings: string[] = [];
  const warn = (m: string) => void warnings.push(m);

  const existing = await loadDoc(kv, warn);
  if (existing) return { kind: "v2", doc: existing, warnings };

  const doc = emptyDoc();
  if (persist) await saveDoc(kv, doc);
  return { kind: "fresh", doc, warnings };
}

/** Raw legacy strings, for the "Download old app data" export. */
export async function dumpLegacyRaw(kv: KeyValueStore): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of LEGACY_KEYS) {
    const raw = await kv.get(key);
    if (raw !== null) out[key] = raw;
  }
  return out;
}

export async function hasLegacyData(kv: KeyValueStore): Promise<boolean> {
  return Object.keys(await dumpLegacyRaw(kv)).length > 0;
}
