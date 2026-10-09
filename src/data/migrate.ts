import type { StoreDoc } from "../domain/types";
import type { KeyValueStore } from "./kv";
import { DataError, validateDoc, type Warn } from "./normalize";

export const LEGACY_KEYS = ["exercises", "sessions", "customGroups", "settings"] as const;

/** Parsed legacy values by key, or null when no legacy key exists. Never writes. */
export async function readLegacy(kv: KeyValueStore): Promise<Record<string, unknown> | null> {
  const out: Record<string, unknown> = {};
  let any = false;
  for (const key of LEGACY_KEYS) {
    const raw = await kv.get(key);
    if (raw === null) continue;
    any = true;
    try {
      out[key] = JSON.parse(raw);
    } catch {
      throw new DataError(`Legacy key "${key}" is not valid JSON`, key);
    }
  }
  return any ? out : null;
}

/** Shared by migration and v1-backup import. Missing keys become empty/default. */
export function legacyToDoc(legacy: Record<string, unknown>, warn: Warn): StoreDoc {
  return validateDoc(
    {
      schemaVersion: 2,
      exercises: legacy.exercises ?? [],
      sessions: legacy.sessions ?? [],
      customGroups: legacy.customGroups ?? [],
      settings: legacy.settings,
      programs: [],
    },
    warn,
  );
}
