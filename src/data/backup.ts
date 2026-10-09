import type { StoreDoc } from "../domain/types";
import type { KeyValueStore } from "./kv";
import { legacyToDoc } from "./migrate";
import { DataError, validateDoc, type Warn } from "./normalize";
import { saveDoc } from "./store";

export function exportBackup(doc: StoreDoc, now: Date = new Date()): string {
  return JSON.stringify({ app: "overload", version: 2, exportedAt: now.toISOString(), ...doc }, null, 2);
}

/** Accepts v1 (legacy shape) and v2 files. Pure: validates, never writes. */
export function parseBackup(text: string, warn: Warn): StoreDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DataError("Backup file is not valid JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw) || (raw as { app?: unknown }).app !== "overload") {
    throw new DataError("Not an Overload backup file");
  }
  const file = raw as Record<string, unknown>;
  if (file.version === 1) return legacyToDoc(file, warn);
  if (file.version === 2) return validateDoc(file, warn);
  throw new DataError(`Unsupported backup version: ${String(file.version)}`);
}

/** Parse and validate fully first; the store is only written if the whole file is valid. */
export async function importBackup(kv: KeyValueStore, text: string, warn: Warn): Promise<StoreDoc> {
  const doc = parseBackup(text, warn);
  await saveDoc(kv, doc);
  return doc;
}
