import { todayYmd } from "../domain/dates";
import { EQUIPMENT_STEPS, STYLE_DEFAULTS, defaultSettings } from "../domain/settings";
import {
  EQUIPMENT, MUSCLES,
  type Block, type ClassRules, type Equipment, type FatigueDecision, type Exercise, type Muscle, type Phase, type Program,
  type Session, type SetEntry, type Settings, type Style, type StyleRules, type ThemePref, type Unit, type StoreDoc,
} from "../domain/types";

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

function member<T extends string>(list: readonly T[], v: unknown, label: string): T {
  if (typeof v === "string" && (list as readonly string[]).includes(v)) return v as T;
  throw new DataError(`${label} is not valid: ${JSON.stringify(v)}`);
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function normalizeSet(raw: unknown, where: string, warn: Warn): SetEntry {
  if (!isObj(raw)) throw new DataError(`${where}: set must be an object`);
  const weight = toNumber(raw.weight);
  const reps = toNumber(raw.reps);
  // Only non-numeric values are unrecoverable; an odd negative is kept so it can't lock the user out.
  if (weight === null) throw new DataError(`${where}: invalid weight ${JSON.stringify(raw.weight)}`);
  if (reps === null) throw new DataError(`${where}: invalid reps ${JSON.stringify(raw.reps)}`);
  if (weight < 0) warn(`${where}: negative weight ${weight} kept`);
  if (reps < 0) warn(`${where}: negative reps ${reps} kept`);
  let rir: SetEntry["rir"] = null;
  if (raw.rir != null) {
    if (typeof raw.rir !== "number" || !Number.isInteger(raw.rir) || raw.rir < 0 || raw.rir > 4) {
      throw new DataError(`${where}.rir is not valid: ${JSON.stringify(raw.rir)}`);
    }
    rir = raw.rir as SetEntry["rir"];
  }
  return { ...raw, weight, reps, warmup: Boolean(raw.warmup), rir } as SetEntry;
}

function normalizeBlock(raw: unknown, where: string, warn: Warn): Block {
  if (!isObj(raw)) throw new DataError(`${where}: block must be an object`);
  const id = reqString(raw.id, `${where}.id`);
  const exerciseId = reqString(raw.exerciseId, `${where}.exerciseId`);
  const sets = reqArray(raw.sets, `${where}.sets`).map((s, i) => normalizeSet(s, `${where}.sets[${i}]`, warn));
  return { ...raw, id, exerciseId, test: raw.test === true, sets } as Block;
}

function muscles(raw: unknown, where: string): Muscle[] {
  return reqArray(raw, where).map((m, i) => member(MUSCLES, m, `${where}[${i}]`));
}

export function normalizeExercises(raw: unknown): Exercise[] {
  return reqArray(raw, "exercises").map((e, i) => {
    const at = `exercises[${i}]`;
    if (!isObj(e)) throw new DataError(`${at} must be an object`);
    const primary = muscles(e.primary, `${at}.primary`);
    if (primary.length === 0) throw new DataError(`${at}.primary needs at least one muscle`);
    let step: number | null = null;
    if (e.step != null) {
      if (typeof e.step !== "number" || !Number.isFinite(e.step) || e.step <= 0) {
        throw new DataError(`${at}.step must be a number above 0 or null`);
      }
      step = e.step;
    }
    if (e.libraryId != null && typeof e.libraryId !== "string") throw new DataError(`${at}.libraryId must be a string or null`);
    return {
      ...e,
      id: reqString(e.id, `${at}.id`),
      libraryId: (e.libraryId as string | undefined) ?? null,
      name: reqString(e.name, `${at}.name`),
      equipment: member(EQUIPMENT, e.equipment, `${at}.equipment`),
      primary,
      secondary: e.secondary == null ? [] : muscles(e.secondary, `${at}.secondary`),
      class: member(["compound", "isolation"] as const, e.class, `${at}.class`),
      loadKind: member(["external", "bodyweight", "assisted"] as const, e.loadKind, `${at}.loadKind`),
      step,
      archived: e.archived === true,
    } as Exercise;
  });
}

export function normalizeSessions(raw: unknown, warn: Warn): Session[] {
  const seenDates = new Set<string>();
  return reqArray(raw, "sessions").map((s, i) => {
    if (!isObj(s)) throw new DataError(`sessions[${i}] must be an object`);
    const id = reqString(s.id, `sessions[${i}].id`);
    if (!isDate(s.date)) throw new DataError(`sessions[${i}] has invalid date ${JSON.stringify(s.date)}`);
    if (seenDates.has(s.date)) warn(`More than one session on ${s.date}`);
    seenDates.add(s.date);
    const name = typeof s.name === "string" ? s.name : "";
    const blocks = reqArray(s.blocks, `sessions[${i}].blocks`).map((b, j) => normalizeBlock(b, `sessions[${i}].blocks[${j}]`, warn));
    return { ...s, id, date: s.date, name, blocks } as Session;
  });
}

// Missing fields take the default silently; present-but-garbage fields warn.
function num(v: unknown, fallback: number, label: string, warn: Warn): number {
  if (v === undefined) return fallback;
  const n = toNumber(v);
  if (n === null) {
    warn(`settings.${label} is invalid; using default ${fallback}`);
    return fallback;
  }
  return n;
}

function mergeNumbers<T extends Record<string, number>>(raw: unknown, def: T, label: string, warn: Warn): T {
  const src = isObj(raw) ? raw : {};
  const out = { ...def };
  for (const k of Object.keys(def) as (keyof T & string)[]) {
    out[k] = num(src[k], def[k], `${label}.${k}`, warn) as T[typeof k];
  }
  return out;
}

const isInt = (n: number, lo: number, hi = Infinity) => Number.isInteger(n) && n >= lo && n <= hi;

// The engine builds arrays from these and compares ranges, so impossible values fall back to the default.
function checkClass(c: ClassRules, def: ClassRules, label: string, warn: Warn): ClassRules {
  const out = { ...c };
  const reset = (keys: (keyof ClassRules)[], why: string) => {
    warn(`settings.${label}: ${why}; using defaults`);
    for (const k of keys) out[k] = def[k];
  };
  if (!isInt(out.sets, 1, 20)) reset(["sets"], `sets ${out.sets} is not a whole number from 1 to 20`);
  if (!isInt(out.repLow, 1) || !isInt(out.repHigh, 1) || out.repLow > out.repHigh) reset(["repLow", "repHigh"], `rep range ${out.repLow}–${out.repHigh} is not valid`);
  if (!isInt(out.rirLow, 0, 4) || !isInt(out.rirHigh, 0, 4) || out.rirLow > out.rirHigh) reset(["rirLow", "rirHigh"], `RIR range ${out.rirLow}–${out.rirHigh} is not valid`);
  if (!(out.restSeconds >= 0)) reset(["restSeconds"], `rest ${out.restSeconds} is negative`);
  if (!isInt(out.warmupSets, 0, 10)) reset(["warmupSets"], `warm-up sets ${out.warmupSets} is not a whole number from 0 to 10`);
  return out;
}

function normalizeStyles(raw: unknown, warn: Warn): Record<Style, StyleRules> {
  const src = isObj(raw) ? raw : {};
  const out = {} as Record<Style, StyleRules>;
  for (const style of ["strength", "hypertrophy"] as const) {
    const s = isObj(src[style]) ? src[style] : {};
    const def = STYLE_DEFAULTS[style];
    out[style] = {
      compound: checkClass(mergeNumbers<ClassRules & Record<string, number>>(s.compound, { ...def.compound }, `styles.${style}.compound`, warn), def.compound, `styles.${style}.compound`, warn),
      isolation: checkClass(mergeNumbers<ClassRules & Record<string, number>>(s.isolation, { ...def.isolation }, `styles.${style}.isolation`, warn), def.isolation, `styles.${style}.isolation`, warn),
      volume: mergeNumbers(s.volume, { ...def.volume }, `styles.${style}.volume`, warn),
    };
    const v = out[style].volume;
    if (!(v.low >= 0 && v.low <= v.high)) {
      warn(`settings.styles.${style}.volume ${v.low}–${v.high} is not valid; using defaults`);
      out[style].volume = { ...def.volume };
    }
  }
  return out;
}

function normalizePhases(raw: unknown, firstDate: string, warn: Warn): Phase[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    warn(`settings.phases is missing; starting one hypertrophy phase on ${firstDate}`);
    return defaultSettings(firstDate).phases;
  }
  return raw.map((p, i) => {
    const at = `settings.phases[${i}]`;
    if (!isObj(p)) throw new DataError(`${at} must be an object`);
    if (!isDate(p.startDate)) throw new DataError(`${at}.startDate is not valid: ${JSON.stringify(p.startDate)}`);
    return { id: reqString(p.id, `${at}.id`), style: member(["strength", "hypertrophy"] as const, p.style, `${at}.style`), startDate: p.startDate };
  });
}

// A step ≤ 0 would stall every weight suggestion; only bands are reps-only (step 0).
function normalizeSteps(raw: unknown, unit: Unit, warn: Warn): Record<Equipment, number> {
  const def = EQUIPMENT_STEPS[unit];
  const steps = mergeNumbers<Record<Equipment, number>>(raw, { ...def }, "equipmentSteps", warn);
  for (const e of Object.keys(steps) as Equipment[]) {
    const ok = e === "band" ? steps[e] >= 0 : steps[e] > 0;
    if (!ok) {
      warn(`settings.equipmentSteps.${e} ${steps[e]} must be more than 0; using default ${def[e]}`);
      steps[e] = def[e];
    }
  }
  return steps;
}

export function normalizeSettings(raw: unknown, firstDate: string, warn: Warn): Settings {
  const s = isObj(raw) ? raw : {};
  let unit: Unit = "lb";
  if (s.unit === "kg" || s.unit === "lb") unit = s.unit;
  else warn(`settings.unit ${JSON.stringify(s.unit)} is invalid; using "lb"`);
  const theme: ThemePref = s.theme === "dark" || s.theme === "light" ? s.theme : "system";
  return {
    unit,
    phases: normalizePhases(s.phases, firstDate, warn),
    styles: normalizeStyles(s.styles, warn),
    equipmentSteps: normalizeSteps(s.equipmentSteps, unit, warn),
    theme,
  };
}

export function validateDoc(raw: unknown, warn: Warn): StoreDoc {
  if (!isObj(raw)) throw new DataError("Store document must be an object");
  if (raw.schemaVersion !== 2) throw new DataError(`Unsupported schemaVersion: ${String(raw.schemaVersion)}`);
  const exercises = normalizeExercises(raw.exercises);
  const sessions = normalizeSessions(raw.sessions, warn);
  const firstDate = sessions.map((s) => s.date).sort()[0] ?? todayYmd();
  const settings = normalizeSettings(raw.settings, firstDate, warn);
  const programs = Array.isArray(raw.programs) ? (raw.programs as Program[]) : [];
  const coachingRaw = isObj(raw.coaching) ? raw.coaching : {};
  const fatigueWeeks = (Array.isArray(coachingRaw.fatigueWeeks) ? coachingRaw.fatigueWeeks : []).filter((f, i): f is FatigueDecision => {
    const ok = isObj(f) && isDate(f.weekStart) && isDate(f.decidedOn) && (f.status === "accepted" || f.status === "dismissed");
    if (!ok) warn(`coaching.fatigueWeeks[${i}] is not valid; dropped`);
    return ok;
  }).map((f) => ({ weekStart: f.weekStart, status: f.status, decidedOn: f.decidedOn }));
  const ids = new Set(exercises.map((e) => e.id));
  for (const s of sessions) {
    for (const b of s.blocks) {
      if (!ids.has(b.exerciseId)) warn(`Orphan block ${b.id} in session ${s.date}: unknown exercise ${b.exerciseId}`);
    }
  }
  return { schemaVersion: 2, exercises, sessions, settings, programs, coaching: { fatigueWeeks } };
}
