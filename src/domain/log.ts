import { liftHistory, type LiftSession } from "./engine/history";
import { targetsFor, type LiftTargets } from "./engine/targets";
import type { Block, Exercise, Session, SetEntry, StoreDoc } from "./types";

/** A set in the Log's day, by block and position. */
export type SetRef = { day: string; blockId: string; index: number };

/** Everything needed to put a removed set back exactly where it was. */
export type RemovedSet = {
  day: string;
  session: Session | null; // the whole session when the removal emptied it
  sessionIndex: number;
  blockIndex: number;
  block: Block; // as it was before the removal
  index: number;
  set: SetEntry;
};

/** A workout that runs past midnight stays one workout while sets keep coming. */
export const LOG_DAY_GRACE_MS = 3 * 60 * 60 * 1000;

export function logDayFor(doc: StoreDoc, today: string, now: number, last: { day: string; at: number } | null): string {
  if (last && now - last.at < LOG_DAY_GRACE_MS && sessionOn(doc, last.day)) return last.day;
  return today;
}

export const sessionOn = (doc: StoreDoc, day: string): Session | undefined => doc.sessions.find((s) => s.date === day);

export const blockFor = (doc: StoreDoc, day: string, exerciseId: string): Block | undefined =>
  sessionOn(doc, day)?.blocks.find((b) => b.exerciseId === exerciseId);

export const withoutDay = (doc: StoreDoc, day: string): StoreDoc => ({ ...doc, sessions: doc.sessions.filter((s) => s.date !== day) });

const mapSession = (doc: StoreDoc, day: string, fn: (s: Session) => Session): StoreDoc => ({
  ...doc,
  sessions: doc.sessions.map((s) => (s.date === day ? fn(s) : s)),
});

const mapBlock = (doc: StoreDoc, day: string, blockId: string, fn: (b: Block) => Block): StoreDoc =>
  mapSession(doc, day, (s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === blockId ? fn(b) : b)) }));

/** Adds a set to the exercise's block for the day, creating the session and block on the first one. */
export function appendSet(
  doc: StoreDoc,
  input: { day: string; exerciseId: string; set: SetEntry; test: boolean },
  newId: () => string,
): StoreDoc {
  const { day, exerciseId, set, test } = input;
  let d = doc;
  if (!sessionOn(d, day)) {
    const session: Session = { id: newId(), date: day, name: "", blocks: [] };
    d = { ...d, sessions: [...d.sessions, session].sort((a, b) => a.date.localeCompare(b.date)) };
  }
  const block = blockFor(d, day, exerciseId);
  if (block) return mapBlock(d, day, block.id, (b) => ({ ...b, sets: [...b.sets, set] }));
  return mapSession(d, day, (s) => ({ ...s, blocks: [...s.blocks, { id: newId(), exerciseId, test, sets: [set] }] }));
}

/** Replaces a set. A changed weight is a new number, so the unit-switch original no longer applies. */
export function replaceSet(doc: StoreDoc, ref: SetRef, set: SetEntry): StoreDoc {
  return mapBlock(doc, ref.day, ref.blockId, (b) => ({
    ...b,
    sets: b.sets.map((old, i) => {
      if (i !== ref.index) return old;
      const next: SetEntry = { weight: set.weight, reps: set.reps, warmup: set.warmup, rir: set.rir };
      return set.weight === old.weight && old.orig ? { ...next, orig: old.orig } : next;
    }),
  }));
}

/** Removes a set; an emptied block goes, and so does an emptied session. */
export function removeSet(doc: StoreDoc, ref: SetRef): { doc: StoreDoc; removed: RemovedSet } | null {
  const sessionIndex = doc.sessions.findIndex((s) => s.date === ref.day);
  const session = doc.sessions[sessionIndex];
  const blockIndex = session ? session.blocks.findIndex((b) => b.id === ref.blockId) : -1;
  const block = session?.blocks[blockIndex];
  const set = block?.sets[ref.index];
  if (!session || !block || !set) return null;

  const sets = block.sets.filter((_, i) => i !== ref.index);
  const blocks = sets.length ? session.blocks.map((b) => (b.id === block.id ? { ...b, sets } : b)) : session.blocks.filter((b) => b.id !== block.id);
  const sessions = blocks.length ? doc.sessions.map((s, i) => (i === sessionIndex ? { ...s, blocks } : s)) : doc.sessions.filter((_, i) => i !== sessionIndex);
  return {
    doc: { ...doc, sessions },
    removed: { day: ref.day, session: blocks.length ? null : session, sessionIndex, blockIndex, block, index: ref.index, set },
  };
}

const insertAt = <T,>(list: T[], i: number, item: T): T[] => [...list.slice(0, i), item, ...list.slice(i)];

/** Puts a removed set back at its position, recreating its block and session (same ids) if they went. */
export function restoreSet(doc: StoreDoc, r: RemovedSet): StoreDoc {
  let d = doc;
  if (!sessionOn(d, r.day)) {
    // The session went with this removal, or later with other removals: rebuild it (same id when we have it).
    const emptied = r.session ?? { id: `${r.block.id}-session`, date: r.day, name: "", blocks: [] };
    d = { ...d, sessions: insertAt(d.sessions, Math.min(r.sessionIndex, d.sessions.length), { ...emptied, blocks: [] }) };
  }
  // Its own block, or the exercise's block if one was started since: never two blocks for one exercise.
  const existing = sessionOn(d, r.day)!.blocks.find((b) => b.id === r.block.id) ?? blockFor(d, r.day, r.block.exerciseId);
  if (existing) return mapBlock(d, r.day, existing.id, (b) => ({ ...b, sets: insertAt(b.sets, Math.min(r.index, b.sets.length), r.set) }));
  return mapSession(d, r.day, (s) => ({
    ...s,
    blocks: insertAt(s.blocks, Math.min(r.blockIndex, s.blocks.length), { ...r.block, sets: [r.set] }),
  }));
}

export const TEST_DAY_LOCKED = "Test day is chosen before your first working set";

export function setTestFlag(doc: StoreDoc, day: string, exerciseId: string, test: boolean): StoreDoc | { error: string } {
  const block = blockFor(doc, day, exerciseId);
  if (!block) return doc;
  if (block.sets.some((s) => !s.warmup)) return { error: TEST_DAY_LOCKED };
  return mapBlock(doc, day, block.id, (b) => ({ ...b, test }));
}

/** Mirrors the engine: test day needs an external load. */
export const canTest = (ex: Exercise): boolean => ex.loadKind === "external" && ex.equipment !== "band";

/** Targets are fixed for the day: the engine never sees the Log's own day. */
export function coachFor(doc: StoreDoc, exerciseId: string, day: string, test: boolean): { targets: LiftTargets; last: LiftSession | null } {
  const before = withoutDay(doc, day);
  return { targets: targetsFor(exerciseId, before, day, { test }), last: liftHistory(before, exerciseId, day)[0] ?? null };
}

export const setCount = (targets: LiftTargets): number => targets.sets.length;

/** What the entry row starts from for the next set. */
export function prefill(targets: LiftTargets, block: Block | undefined, warmup: boolean): { weight: number | null; reps: number | null } {
  const logged = block?.sets ?? [];
  if (warmup) {
    const warmups = logged.filter((s) => s.warmup);
    const next = targets.warmups[warmups.length] ?? warmups.at(-1);
    return next ? { weight: next.weight, reps: next.reps } : { weight: null, reps: null };
  }
  const working = logged.filter((s) => !s.warmup);
  const k = working.length;
  const target = targets.sets[Math.min(k, targets.sets.length - 1)];
  const reps = target?.reps ?? working.at(-1)?.reps ?? null;
  if (targets.ladder?.length) return { weight: targets.ladder[Math.min(k, targets.ladder.length - 1)]!, reps };
  return { weight: targets.weight ?? working.at(-1)?.weight ?? null, reps };
}
