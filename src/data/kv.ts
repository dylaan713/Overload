export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

// Errors propagate (the old wrapper swallowed them, which could hide data loss).
export function createLocalStorageKV(
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): KeyValueStore {
  return {
    async get(key) {
      return storage.getItem(key);
    },
    async set(key, value) {
      storage.setItem(key, value);
    },
  };
}

export function createMemoryKV(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
    },
    dump() {
      return Object.fromEntries(data);
    },
  };
}
