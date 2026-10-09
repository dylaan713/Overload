import { DEFAULT_SETTINGS } from "../domain/settings";
import type { StoreDoc } from "../domain/types";
import type { KeyValueStore } from "./kv";
import { DataError, validateDoc, type Warn } from "./normalize";

export const V2_KEY = "overload.v2";

export function emptyDoc(): StoreDoc {
  return { schemaVersion: 2, exercises: [], sessions: [], customGroups: [], settings: structuredClone(DEFAULT_SETTINGS), programs: [] };
}

export async function loadDoc(kv: KeyValueStore, warn: Warn): Promise<StoreDoc | null> {
  const raw = await kv.get(V2_KEY);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DataError(`${V2_KEY} is not valid JSON`, V2_KEY);
  }
  return validateDoc(parsed, warn);
}

// One write of the whole document: a failure leaves the previous value intact.
export async function saveDoc(kv: KeyValueStore, doc: StoreDoc): Promise<void> {
  await kv.set(V2_KEY, JSON.stringify(doc));
}
