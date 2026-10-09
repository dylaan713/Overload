import { DEFAULT_SETTINGS, mergeSettings } from "../domain/settings";
import type { Block, Exercise, Program, Session, SetEntry, Settings, StoreDoc, TypeSettings } from "../domain/types";

export class DataError extends Error {
  constructor(message: string, readonly where?: string) {
    super(message);
    this.name = "DataError";
  }
}
export type Warn = (message: string) => void;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function reqString(v: unknown, label: string): string {
  if (typeof v === "string" && v.length > 0) return v;
  throw new DataError(`${label} must be a non-empty string`);
}

function reqArray(v: unknown, label: string): unknown[] {
  if (Array.isArray(v)) return v;
  throw new DataError(`${label} must be an array`);
}

function normalizeSet(raw: unknown, where: string): SetEntry {
  if (!isObj(raw)) throw new DataError(`${where}: set must be an object`);
  const weight = toNumber(raw.weight);
  const reps = toNumber(raw.reps);
  if (weight === null || weight < 0) throw new DataError(`${where}: invalid weight ${JSON.stringify(raw.weight)}`);
  if (reps === null || reps < 0) throw new DataError(`${where}: invalid reps ${JSON.stringify(raw.reps)}`);
  const out = { ...raw, weight, reps, warmup: Boolean(raw.warmup) } as SetEntry;
  if (raw.rpe != null) {
    const rpe = toNumber(raw.rpe);
    if (rpe === null || rpe < 1 || rpe > 10) throw new DataError(`${where}: invalid rpe ${JSON.stringify(raw.rpe)}`);
    out.rpe = rpe;
  }
  return out;
}

function normalizeBlock(raw: unknown, where: string): Block {
  if (!isObj(raw)) throw new DataError(`${where}: block must be an object`);
  const id = reqString(raw.id, `${where}.id`);
  const exerciseId = reqString(raw.exerciseId, `${where}.exerciseId`);
  const sets = reqArray(raw.sets, `${where}.sets`).map((s, i) => normalizeSet(s, `${where}.sets[${i}]`));
  return { ...raw, id, exerciseId, sets } as Block;
}

export function normalizeExercises(raw: unknown, warn: Warn): Exercise[] {
  return reqArray(raw, "exercises").map((e, i) => {
    if (!isObj(e)) throw new DataError(`exercises[${i}] must be an object`);
    const id = reqString(e.id, `exercises[${i}].id`);
    const name = reqString(e.name, `exercises[${i}].name`);
    let type = e.type;
    if (type !== "compound" && type !== "isolation") {
      warn(`Exercise "${name}" has invalid type ${JSON.stringify(type)}; using "compound"`);
      type = "compound";
    }
    const muscleGroup = typeof e.muscleGroup === "string" ? e.muscleGroup : "";
    return { ...e, id, name, type, muscleGroup } as Exercise;
  });
}

export function normalizeSessions(raw: unknown, warn: Warn): Session[] {
  const seenDates = new Set<string>();
  return reqArray(raw, "sessions").map((s, i) => {
    if (!isObj(s)) throw new DataError(`sessions[${i}] must be an object`);
    const id = reqString(s.id, `sessions[${i}].id`);
    if (typeof s.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
      throw new DataError(`sessions[${i}] has invalid date ${JSON.stringify(s.date)}`);
    }
    if (seenDates.has(s.date)) warn(`More than one session on ${s.date}`);
    seenDates.add(s.date);
    const name = typeof s.name === "string" ? s.name : "";
    const blocks = reqArray(s.blocks, `sessions[${i}].blocks`).map((b, j) => normalizeBlock(b, `sessions[${i}].blocks[${j}]`));
    return { ...s, id, date: s.date, name, blocks } as Session;
  });
}

export function normalizeCustomGroups(raw: unknown): string[] {
  const list = reqArray(raw, "customGroups");
  list.forEach((g, i) => {
    if (typeof g !== "string") throw new DataError(`customGroups[${i}] must be a string`);
  });
  return list as string[];
}

function num(v: unknown, fallback: number, label: string, warn: Warn): number {
  const n = toNumber(v);
  if (n === null) {
    warn(`settings.${label} is invalid; using default ${fallback}`);
    return fallback;
  }
  return n;
}

function normalizeTypeSettings(raw: TypeSettings, def: TypeSettings, label: string, warn: Warn): TypeSettings {
  return {
    ...raw,
    sets: num(raw.sets, def.sets, `${label}.sets`, warn),
    repBottom: num(raw.repBottom, def.repBottom, `${label}.repBottom`, warn),
    repTop: num(raw.repTop, def.repTop, `${label}.repTop`, warn),
    warmupSets: num(raw.warmupSets, def.warmupSets, `${label}.warmupSets`, warn),
  };
}

export function normalizeSettings(raw: unknown, warn: Warn): Settings {
  const m = mergeSettings(raw);
  if (m.unit !== "lb" && m.unit !== "kg") warn(`settings.unit ${JSON.stringify(m.unit)} is invalid; using "lb"`);
  return {
    ...m,
    unit: m.unit === "kg" ? "kg" : "lb",
    increment: num(m.increment, DEFAULT_SETTINGS.increment, "increment", warn),
    compound: normalizeTypeSettings(m.compound, DEFAULT_SETTINGS.compound, "compound", warn),
    isolation: normalizeTypeSettings(m.isolation, DEFAULT_SETTINGS.isolation, "isolation", warn),
    restTimer: { ...m.restTimer, defaultSeconds: num(m.restTimer.defaultSeconds, DEFAULT_SETTINGS.restTimer.defaultSeconds, "restTimer.defaultSeconds", warn) },
  };
}

export function validateDoc(raw: unknown, warn: Warn): StoreDoc {
  if (!isObj(raw)) throw new DataError("Store document must be an object");
  if (raw.schemaVersion !== 2) throw new DataError(`Unsupported schemaVersion: ${String(raw.schemaVersion)}`);
  const exercises = normalizeExercises(raw.exercises, warn);
  const sessions = normalizeSessions(raw.sessions, warn);
  const customGroups = normalizeCustomGroups(raw.customGroups);
  const settings = normalizeSettings(raw.settings, warn);
  const programs = Array.isArray(raw.programs) ? (raw.programs as Program[]) : [];
  const ids = new Set(exercises.map((e) => e.id));
  for (const s of sessions) {
    for (const b of s.blocks) {
      if (!ids.has(b.exerciseId)) warn(`Orphan block ${b.id} in session ${s.date}: unknown exercise ${b.exerciseId}`);
    }
  }
  return { schemaVersion: 2, exercises, sessions, customGroups, settings, programs };
}
