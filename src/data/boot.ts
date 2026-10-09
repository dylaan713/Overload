import type { StoreDoc } from "../domain/types";
import type { KeyValueStore } from "./kv";
import { LEGACY_KEYS, legacyToDoc, readLegacy } from "./migrate";
import { emptyDoc, loadDoc, saveDoc } from "./store";

export interface BootResult {
  kind: "v2" | "migrated" | "fresh";
  doc: StoreDoc;
  warnings: string[];
}

/**
 * v2 present → use it (legacy ignored; a corrupt v2 throws rather than falling
 * back, so older legacy data can never overwrite newer v2 data).
 * Else legacy present → migrate. Else fresh.
 * `persist:false` is a dry run: nothing is written.
 */
export async function bootStore(kv: KeyValueStore, opts: { persist?: boolean } = {}): Promise<BootResult> {
  const persist = opts.persist ?? true;
  const warnings: string[] = [];
  const warn = (m: string) => void warnings.push(m);

  const existing = await loadDoc(kv, warn);
  if (existing) return { kind: "v2", doc: existing, warnings };

  const legacy = await readLegacy(kv);
  if (!legacy) {
    const doc = emptyDoc();
    if (persist) await saveDoc(kv, doc);
    return { kind: "fresh", doc, warnings };
  }
  const doc = legacyToDoc(legacy, warn);
  if (persist) await saveDoc(kv, doc);
  return { kind: "migrated", doc, warnings };
}

/** Raw legacy strings, for the "export what's there" escape hatch on a failed boot. */
export async function dumpLegacyRaw(kv: KeyValueStore): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of LEGACY_KEYS) {
    const raw = await kv.get(key);
    if (raw !== null) out[key] = raw;
  }
  return out;
}
