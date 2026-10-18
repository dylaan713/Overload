import type { KeyValueStore } from "../data/kv";

export function App({ kv }: { kv: KeyValueStore }) {
  return <main data-storage-ready={String(Boolean(kv))}>Overload (next)</main>;
}
