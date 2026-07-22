import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Award,
  Dumbbell,
  X,
  Flame,
  Trash2,
  Pencil,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Settings,
  Timer,
  RotateCcw,
} from "lucide-react";
import { storage } from "./storage";

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Legs", "Arms", "Core"];

/* ---------------- settings ---------------- */

const DEFAULT_SETTINGS = {
  unit: "lb", // "lb" | "kg"
  increment: 5, // amount added on an increase, in the current unit
  compound: { sets: 2, repBottom: 6, repTop: 8, warmupSets: 2 },
  isolation: { sets: 2, repBottom: 8, repTop: 10, warmupSets: 1 },
  restTimer: { defaultSeconds: 120, sound: true, vibrate: true },
  theme: "ember",
};

// Merge stored settings over defaults so older/partial saves don't break.
function mergeSettings(stored) {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    compound: { ...DEFAULT_SETTINGS.compound, ...(stored.compound || {}) },
    isolation: { ...DEFAULT_SETTINGS.isolation, ...(stored.isolation || {}) },
    restTimer: { ...DEFAULT_SETTINGS.restTimer, ...(stored.restTimer || {}) },
  };
}

function plateIncrement(unit) {
  return unit === "kg" ? 2.5 : 5;
}

/* ---------------- themes ---------------- */

const THEMES = {
  ember: {
    label: "Ember",
    vars: {
      "--bg": "#1C1B19",
      "--surface": "#242220",
      "--surface2": "#2C2926",
      "--border": "#3A362F",
      "--text": "#EDEAE2",
      "--text-dim": "#9B948A",
      "--accent": "#C4451F",
      "--accent-dim": "#7A3220",
      "--accent2": "#6E8172",
      "--accent2-dim": "#46503E",
      "--gold": "#D6A23C",
      "--danger": "#B23A3A",
    },
  },
  slate: {
    label: "Slate",
    vars: {
      "--bg": "#14171C",
      "--surface": "#1B1F26",
      "--surface2": "#232833",
      "--border": "#333A47",
      "--text": "#E6EAF0",
      "--text-dim": "#8A94A6",
      "--accent": "#3B82F6",
      "--accent-dim": "#1E3A5F",
      "--accent2": "#5EAD8E",
      "--accent2-dim": "#274C3E",
      "--gold": "#E0B341",
      "--danger": "#E05252",
    },
  },
  violet: {
    label: "Violet",
    vars: {
      "--bg": "#17141F",
      "--surface": "#1E1B29",
      "--surface2": "#272235",
      "--border": "#3A3350",
      "--text": "#ECE8F5",
      "--text-dim": "#9990B0",
      "--accent": "#8B5CF6",
      "--accent-dim": "#3F2D6B",
      "--accent2": "#4FBFA8",
      "--accent2-dim": "#234E45",
      "--gold": "#E0B341",
      "--danger": "#E05252",
    },
  },
  paper: {
    label: "Paper (light)",
    vars: {
      "--bg": "#F4F1EA",
      "--surface": "#FFFFFF",
      "--surface2": "#ECE7DD",
      "--border": "#D8D0C2",
      "--text": "#22201C",
      "--text-dim": "#6E675C",
      "--accent": "#C4451F",
      "--accent-dim": "#F0D9CE",
      "--accent2": "#4E7A5E",
      "--accent2-dim": "#DCE7DE",
      "--gold": "#B8842A",
      "--danger": "#B23A3A",
    },
  },
};

function themeVarsCss(themeKey) {
  const theme = THEMES[themeKey] || THEMES.ember;
  return Object.entries(theme.vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n          ");
}

/* ---------------- helpers ---------------- */

function allMuscleGroups(exercises, customGroups = []) {
  const used = exercises.map((e) => e.muscleGroup).filter(Boolean);
  return Array.from(new Set([...MUSCLE_GROUPS, ...customGroups, ...used]));
}

function groupByMuscle(exercises) {
  const map = {};
  exercises.forEach((e) => {
    const g = e.muscleGroup || "Other";
    map[g] = map[g] || [];
    map[g].push(e);
  });
  return map;
}

function groupByMuscleFull(allGroups, exercises) {
  const map = {};
  allGroups.forEach((g) => (map[g] = []));
  exercises.forEach((e) => {
    const g = e.muscleGroup || "Other";
    map[g] = map[g] || [];
    map[g].push(e);
  });
  return map;
}

const uid = () => Math.random().toString(36).slice(2, 10);
// Build a YYYY-MM-DD string from local calendar parts (NOT UTC), so an evening
// workout files under the correct local day and matches the History calendar.
function ymd(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
const todayStr = () => {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth(), d.getDate());
};
const fmtDate = (d) => {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtShort = (d) => {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function topBottom(type, settings) {
  const s = settings[type] || settings.compound;
  return { top: s.repTop, bottom: s.repBottom };
}

// Epley estimated 1-rep max. Combines weight AND reps into one strength number
// so rep gains (not just heavier loads) show up as progress on the chart.
function e1rm(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function getSuggestedTargetWeight(exercise, entriesDesc, settings) {
  const suggestion = getSuggestion(exercise, entriesDesc, settings);
  if (suggestion.status === "increase") return suggestion.to;
  if (suggestion.status === "decrease") return suggestion.to;
  if (suggestion.status === "stall") return suggestion.to;
  if (suggestion.status === "add-reps") return suggestion.weight;
  return null;
}

// Even-percentage warm-up ramp. The count comes from settings; weights and reps
// are calculated from the target working weight so the user only picks "how many".
function getWarmupSets(type, targetWeight, settings) {
  const count = settings[type]?.warmupSets ?? 0;
  if (!count || count <= 0 || !targetWeight || targetWeight <= 0) return [];
  const round = plateIncrement(settings.unit);
  const START_PCT = 0.45;
  const END_PCT = 0.9;
  const START_REPS = 8;
  const END_REPS = 3;

  const sets = [];
  for (let i = 0; i < count; i++) {
    // t goes 0..1 across the sets; a single set sits at a sensible ~60%.
    const t = count === 1 ? 0.33 : i / (count - 1);
    const pct = START_PCT + (END_PCT - START_PCT) * t;
    const reps = Math.round(START_REPS + (END_REPS - START_REPS) * t);
    const weight = Math.round((targetWeight * pct) / round) * round;
    sets.push({ weight, reps });
  }
  // Drop anything that rounds to nothing or meets/exceeds the working weight.
  return sets.filter((s) => s.weight > 0 && s.weight < targetWeight);
}

// Coaching tuning.
const STALL_SESSIONS = 3; // same top weight, no rep gain, this many sessions → deload
const BLOWOUT_MARGIN = 3; // reps past the top of the range that earn a double jump
const DELOAD_PCT = 0.9; // deload target = 90% of the stalled weight

// Best working-set reps at a given weight in a session's entry, or 0 if none.
function bestRepsAtWeight(entry, weight) {
  const reps = entry.sets.filter((s) => !s.warmup && s.weight === weight).map((s) => s.reps);
  return reps.length ? Math.max(...reps) : 0;
}

// Double progression: earn reps up to the top of the range, then add weight and
// reset. Reads recent history so it can also spot blowouts (big jump) and stalls
// (deload). Precedence: increase → decrease (too heavy) → stall → add reps.
function getSuggestion(exercise, entriesDesc, settings) {
  if (!entriesDesc.length) return { status: "no-data" };
  const last = entriesDesc[0];
  const working = last.sets.filter((s) => !s.warmup);
  if (!working.length) return { status: "no-working-sets", last };
  const { top, bottom } = topBottom(exercise.type, settings);
  const needed = settings[exercise.type]?.sets ?? 2;
  const increment = settings.increment;
  const round = plateIncrement(settings.unit);

  const byWeight = {};
  working.forEach((s) => {
    byWeight[s.weight] = byWeight[s.weight] || [];
    byWeight[s.weight].push(s.reps);
  });

  let increaseWeight = null;
  Object.entries(byWeight).forEach(([w, repsArr]) => {
    const countTop = repsArr.filter((r) => r >= top).length;
    if (countTop >= needed) increaseWeight = Math.max(increaseWeight || 0, Number(w));
  });

  if (increaseWeight != null) {
    // Blowout: crushed every set at that weight by top + margin → double the jump.
    const repsAtInc = byWeight[increaseWeight] || [];
    const big = repsAtInc.length >= needed && repsAtInc.every((r) => r >= top + BLOWOUT_MARGIN);
    const to = increaseWeight + (big ? 2 : 1) * increment;
    return { status: "increase", from: increaseWeight, to, resetReps: bottom, needed, big, date: last.date };
  }

  const mainWeight = Math.max(...working.map((s) => s.weight));
  const setsAtMain = working.filter((s) => s.weight === mainWeight);
  const bestReps = Math.max(...setsAtMain.map((s) => s.reps));

  // Fell below the target range even on your best set here — the weight's too
  // heavy. Drop a step and rebuild reps from the bottom of the range.
  if (bestReps < bottom) {
    const to = Math.max(round, mainWeight - increment);
    return { status: "decrease", from: mainWeight, to, bottom, bestReps, date: last.date };
  }

  // Stall: same top weight for STALL_SESSIONS straight with no rep improvement.
  // Count the consecutive most-recent sessions whose top working weight matches.
  const run = [];
  for (const entry of entriesDesc) {
    const w = entry.sets.filter((s) => !s.warmup);
    if (!w.length) continue; // ignore warm-up-only days
    if (Math.max(...w.map((s) => s.weight)) !== mainWeight) break;
    run.push(entry);
  }
  if (run.length >= STALL_SESSIONS) {
    const oldestBest = bestRepsAtWeight(run[STALL_SESSIONS - 1], mainWeight);
    if (bestReps <= oldestBest) {
      const to = Math.max(round, Math.round((mainWeight * DELOAD_PCT) / round) * round);
      return { status: "stall", weight: mainWeight, to, sessions: run.length, date: last.date };
    }
  }

  // In range but not at the top yet — coach reps at the top working weight, with
  // a concrete per-set target (bump the lowest sub-top set by one).
  const progress = setsAtMain.filter((s) => s.reps >= top).length;
  const targetReps = Math.min(top, bestReps + 1);
  const lastReps = setsAtMain.map((s) => s.reps);
  const targetSets = [...lastReps];
  let bumpIdx = -1;
  let bumpVal = Infinity;
  targetSets.forEach((r, i) => {
    if (r < top && r < bumpVal) {
      bumpVal = r;
      bumpIdx = i;
    }
  });
  if (bumpIdx >= 0) targetSets[bumpIdx] = Math.min(top, targetSets[bumpIdx] + 1);
  return { status: "add-reps", weight: mainWeight, sets: setsAtMain, bestReps, targetReps, top, progress, needed, lastReps, targetSets, date: last.date };
}

// Catches render errors anywhere below it so a crash shows a recoverable screen
// instead of a blank page. All data lives in localStorage, so a reload recovers.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Overload crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Something broke
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 16 }}>
            Your logged data is safe — it's stored on this device. Reload to get back in.
          </div>
          <button onClick={() => window.location.reload()} style={{ ...primaryBtnStyle, width: "100%" }}>
            Reload
          </button>
          <pre style={{ marginTop: 16, textAlign: "left", fontSize: 11, color: "var(--text-dim)", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)" }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [exercises, setExercises] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [customGroups, setCustomGroups] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("log");
  const [logDate, setLogDate] = useState(todayStr());

  useEffect(() => {
    (async () => {
      try {
        const ex = await storage.get("exercises");
        setExercises(ex ? JSON.parse(ex.value) : []);
      } catch {
        setExercises([]);
      }
      try {
        const se = await storage.get("sessions");
        setSessions(se ? JSON.parse(se.value) : []);
      } catch {
        setSessions([]);
      }
      try {
        const cg = await storage.get("customGroups");
        setCustomGroups(cg ? JSON.parse(cg.value) : []);
      } catch {
        setCustomGroups([]);
      }
      try {
        const st = await storage.get("settings");
        setSettings(st ? mergeSettings(JSON.parse(st.value)) : DEFAULT_SETTINGS);
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
      setLoaded(true);
    })();
  }, []);

  async function persistExercises(list) {
    setExercises(list);
    await storage.set("exercises", JSON.stringify(list));
  }
  async function persistSessions(list) {
    setSessions(list);
    await storage.set("sessions", JSON.stringify(list));
  }
  async function persistCustomGroups(list) {
    setCustomGroups(list);
    await storage.set("customGroups", JSON.stringify(list));
  }
  async function persistSettings(next) {
    setSettings(next);
    await storage.set("settings", JSON.stringify(next));
  }
  function addGroup(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = allMuscleGroups(exercises, customGroups).map((g) => g.toLowerCase());
    if (existing.includes(trimmed.toLowerCase())) return;
    persistCustomGroups([...customGroups, trimmed]);
  }

  function deleteExercise(id) {
    persistExercises(exercises.filter((e) => e.id !== id));
    const nextSessions = sessions
      .map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.exerciseId !== id) }))
      .filter((s) => s.blocks.length > 0);
    persistSessions(nextSessions);
  }
  function updateExercise(id, updates) {
    persistExercises(exercises.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }

  const flatEntries = useMemo(() => {
    return sessions.flatMap((s) =>
      s.blocks.map((b) => ({ id: b.id, date: s.date, sessionName: s.name, exerciseId: b.exerciseId, sets: b.sets }))
    );
  }, [sessions]);

  const entriesByExercise = useMemo(() => {
    const map = {};
    exercises.forEach((e) => (map[e.id] = []));
    flatEntries.forEach((entry) => {
      if (!map[entry.exerciseId]) map[entry.exerciseId] = [];
      map[entry.exerciseId].push(entry);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.date < b.date ? 1 : -1)));
    return map;
  }, [exercises, flatEntries]);

  function editWorkoutOnDate(date) {
    setLogDate(date);
    setTab("log");
  }

  // Download a full backup so history survives a phone reinstall (localStorage is
  // cleared on uninstall). Everything is on-device; this file is the user's copy.
  function exportData() {
    const payload = {
      app: "overload",
      version: 1,
      exportedAt: new Date().toISOString(),
      exercises,
      sessions,
      customGroups,
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `overload-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importData(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    if (typeof data !== "object" || data === null) throw new Error("Not a valid backup file");
    if (Array.isArray(data.exercises)) await persistExercises(data.exercises);
    if (Array.isArray(data.sessions)) await persistSessions(data.sessions);
    if (Array.isArray(data.customGroups)) await persistCustomGroups(data.customGroups);
    if (data.settings) await persistSettings(mergeSettings(data.settings));
  }

  if (!loaded) {
    return (
      <Shell theme={settings.theme}>
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          loading log...
        </div>
      </Shell>
    );
  }

  return (
    <Shell theme={settings.theme}>
      <ErrorBoundary>
      <Header tab={tab} setTab={setTab} />
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          paddingTop: 20,
          paddingBottom: "calc(60px + env(safe-area-inset-bottom))",
          paddingLeft: "max(16px, env(safe-area-inset-left))",
          paddingRight: "max(16px, env(safe-area-inset-right))",
        }}
      >
        {tab === "log" && (
          <LogTab
            exercises={exercises}
            sessions={sessions}
            entriesByExercise={entriesByExercise}
            persistExercises={persistExercises}
            persistSessions={persistSessions}
            deleteExercise={deleteExercise}
            updateExercise={updateExercise}
            customGroups={customGroups}
            addGroup={addGroup}
            settings={settings}
            date={logDate}
            setDate={setLogDate}
            onOpenSettings={() => setTab("settings")}
          />
        )}
        {tab === "stats" && <StatsTab exercises={exercises} entriesByExercise={entriesByExercise} settings={settings} />}
        {tab === "history" && (
          <HistoryTab exercises={exercises} sessions={sessions} onEditWorkout={editWorkoutOnDate} settings={settings} />
        )}
        {tab === "settings" && <SettingsTab settings={settings} persistSettings={persistSettings} onExport={exportData} onImport={importData} />}
      </div>
      </ErrorBoundary>
    </Shell>
  );
}

function Shell({ theme, children }) {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100%", color: "var(--text)", fontFamily: "var(--font-body)" }}>
      <style>{`
        :root {
          ${themeVarsCss(theme)}
          --font-display: 'Oswald', sans-serif;
          --font-body: 'Work Sans', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
        }
        * { box-sizing: border-box; }
        input, select, button { font-family: var(--font-body); }
        input:focus, select:focus, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
        ::-webkit-scrollbar { width: 0; height: 0; background: transparent; }
        .plateRow { display: flex; gap: 4px; }
        .plate { width: 22px; height: 14px; border-radius: 3px; border: 2px solid var(--border); background: transparent; }
        .plate.filled { background: var(--accent); border-color: var(--accent); }
      `}</style>
      {children}
    </div>
  );
}

function Header({ tab, setTab }) {
  // Settings lives as a gear in the title row; the remaining tabs fill the width
  // evenly (no horizontal scroll), so the section names stay put.
  const tabs = [
    { id: "log", label: "Log" },
    { id: "stats", label: "Stats" },
    { id: "history", label: "History" },
  ];
  return (
    <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", paddingTop: "env(safe-area-inset-top)" }}>
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          paddingTop: 18,
          paddingBottom: 0,
          paddingLeft: "max(16px, env(safe-area-inset-left))",
          paddingRight: "max(16px, env(safe-area-inset-right))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Dumbbell size={22} color="var(--accent)" />
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 1, fontWeight: 600, textTransform: "uppercase" }}>
              Overload
            </div>
          </div>
          <button
            onClick={() => setTab("settings")}
            aria-label="Settings"
            title="Settings"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 8,
              color: tab === "settings" ? "var(--accent)" : "var(--text-dim)",
            }}
          >
            <Settings size={22} />
          </button>
        </div>
        <div style={{ display: "flex" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                padding: "10px 2px",
                cursor: "pointer",
                textAlign: "center",
                color: tab === t.id ? "var(--text)" : "var(--text-dim)",
                borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                fontSize: 13,
                fontWeight: 500,
                marginBottom: -1,
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  const isCompound = type === "compound";
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        padding: "2px 6px",
        borderRadius: 4,
        color: isCompound ? "var(--accent)" : "var(--accent2)",
        border: `1px solid ${isCompound ? "var(--accent-dim)" : "var(--accent2-dim)"}`,
        background: isCompound ? "var(--accent-dim)" : "var(--accent2-dim)",
      }}
    >
      {isCompound ? "Compound" : "Isolation"}
    </span>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-dim)", border: "1px dashed var(--border)", borderRadius: 8, fontSize: 14 }}>
      {text}
    </div>
  );
}

function CollapsibleSection({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          background: "none",
          border: "none",
          padding: "6px 0",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {open ? <ChevronDown size={16} color="var(--accent2)" /> : <ChevronRight size={16} color="var(--accent2)" />}
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "var(--accent2)",
          }}
        >
          {title}
        </span>
        {typeof count === "number" && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>({count})</span>
        )}
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

/* ---------------- LOG TAB ---------------- */

function LogTab({ exercises, sessions, entriesByExercise, persistExercises, persistSessions, deleteExercise, updateExercise, customGroups, addGroup, settings, date, setDate, onOpenSettings }) {
  const [showManage, setShowManage] = useState(false);

  const existing = sessions.find((s) => s.date === date);
  // Stable fallback id per date so an unsaved day's draft keeps one id until saved.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fallbackId = useMemo(() => uid(), [date]);
  const draft = existing || { id: fallbackId, date, name: "", blocks: [] };

  const [nameInput, setNameInput] = useState(existing ? existing.name : "");
  useEffect(() => {
    const forDate = sessions.find((s) => s.date === date);
    setNameInput(forDate ? forDate.name : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const [addingExerciseId, setAddingExerciseId] = useState(exercises[0]?.id || "");
  const [showAddExercise, setShowAddExercise] = useState(exercises.length === 0);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("compound");
  const [newGroup, setNewGroup] = useState(MUSCLE_GROUPS[0]);
  const [customGroup, setCustomGroup] = useState("");
  const [useCustomGroup, setUseCustomGroup] = useState(false);
  const [sets, setSets] = useState([{ weight: "", reps: "", warmup: false }]);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const groupOptions = allMuscleGroups(exercises, customGroups);

  useEffect(() => {
    if (exercises.length && !exercises.some((e) => e.id === addingExerciseId)) {
      setAddingExerciseId(exercises[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises]);

  function upsertSession(nextDraft) {
    const others = sessions.filter((s) => s.id !== nextDraft.id && s.date !== nextDraft.date);
    if (nextDraft.blocks.length === 0) {
      persistSessions(others);
    } else {
      persistSessions([...others, nextDraft]);
    }
  }

  function handleNameChange(name) {
    setNameInput(name);
    if (draft.blocks.length > 0) {
      upsertSession({ ...draft, name });
    }
  }

  function addExercise() {
    if (!newName.trim()) return;
    const group = (useCustomGroup ? customGroup.trim() : newGroup) || "Other";
    const ex = { id: uid(), name: newName.trim(), type: newType, muscleGroup: group };
    persistExercises([...exercises, ex]);
    setAddingExerciseId(ex.id);
    setNewName("");
    setCustomGroup("");
    setUseCustomGroup(false);
    setShowAddExercise(false);
  }

  function updateSet(i, field, val) {
    const next = [...sets];
    next[i] = { ...next[i], [field]: val };
    setSets(next);
  }
  function addSetRow() {
    setSets([...sets, { weight: "", reps: "", warmup: false }]);
  }
  function removeSetRow(i) {
    setSets(sets.filter((_, idx) => idx !== i));
  }
  function resetSetEditor() {
    setSets([{ weight: "", reps: "", warmup: false }]);
    setEditingBlockId(null);
  }

  function commitBlock() {
    const exercise = exercises.find((e) => e.id === addingExerciseId);
    if (!exercise) return;
    const cleaned = sets
      .filter((s) => s.weight !== "" && s.reps !== "")
      .map((s) => ({ weight: Number(s.weight), reps: Number(s.reps), warmup: !!s.warmup }));
    if (!cleaned.length) return;

    if (editingBlockId) {
      // Replace the block being edited, keeping its id and position.
      const nextBlocks = draft.blocks.map((b) =>
        b.id === editingBlockId ? { ...b, exerciseId: exercise.id, sets: cleaned } : b
      );
      upsertSession({ ...draft, name: nameInput, blocks: nextBlocks });
    } else {
      const block = { id: uid(), exerciseId: exercise.id, sets: cleaned };
      upsertSession({ ...draft, name: nameInput, blocks: [...draft.blocks, block] });
    }
    resetSetEditor();
  }

  function editBlock(block) {
    setEditingBlockId(block.id);
    setAddingExerciseId(block.exerciseId);
    setShowAddExercise(false);
    setSets(block.sets.map((s) => ({ weight: String(s.weight), reps: String(s.reps), warmup: !!s.warmup })));
  }

  function removeBlock(blockId) {
    if (editingBlockId === blockId) resetSetEditor();
    upsertSession({ ...draft, name: nameInput, blocks: draft.blocks.filter((b) => b.id !== blockId) });
  }

  const activeExercise = exercises.find((e) => e.id === addingExerciseId);
  const priorEntries = activeExercise ? (entriesByExercise[activeExercise.id] || []).filter((e) => e.date !== date) : [];
  const suggestion = activeExercise ? getSuggestion(activeExercise, priorEntries, settings) : null;
  const targetWeight = activeExercise ? getSuggestedTargetWeight(activeExercise, priorEntries, settings) : null;
  const warmupSets = activeExercise && targetWeight ? getWarmupSets(activeExercise.type, targetWeight, settings) : [];
  const unit = settings.unit;

  // Drop the suggested warm-up ramp into the set editor, replacing any warm-up
  // rows already there but keeping the working sets the user has started filling in.
  // Always leave a fresh empty working row at the end, ready to type into.
  function addWarmupRamp() {
    const warmRows = warmupSets.map((w) => ({ weight: String(w.weight), reps: String(w.reps), warmup: true }));
    const workingRows = sets.filter((s) => !s.warmup && (s.weight !== "" || s.reps !== ""));
    setSets([...warmRows, ...workingRows, { weight: "", reps: "", warmup: false }]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <RestTimer settings={settings} onOpenSettings={onOpenSettings} />

      <Card>
        <Label>Date</Label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ ...inputStyle, WebkitAppearance: "none", appearance: "none" }}
        />
        <div style={{ height: 10 }} />
        <Label>Workout name</Label>
        <input
          placeholder="e.g. Push Day, Leg Day..."
          value={nameInput}
          onChange={(e) => handleNameChange(e.target.value)}
          style={inputStyle}
        />
      </Card>

      {draft.blocks.length > 0 && (
        <Card>
          <Label>Exercises on {fmtDate(date)}</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {draft.blocks.map((b) => {
              const ex = exercises.find((e) => e.id === b.exerciseId);
              const isEditing = editingBlockId === b.id;
              return (
                <div
                  key={b.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: 10,
                    outline: isEditing ? "1px solid var(--accent)" : "none",
                    outlineOffset: 4,
                    borderRadius: isEditing ? 4 : 0,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 14 }}>{ex ? ex.name : "(deleted exercise)"}</span>
                      {ex && <TypeBadge type={ex.type} />}
                      {ex && ex.muscleGroup && (
                        <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{ex.muscleGroup}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <button
                        onClick={() => editBlock(b)}
                        aria-label="Edit this exercise's sets"
                        title="Edit this exercise's sets"
                        style={{ background: "none", border: "none", color: isEditing ? "var(--accent)" : "var(--text-dim)", cursor: "pointer", padding: 10, display: "flex" }}
                      >
                        <Pencil size={17} />
                      </button>
                      <button onClick={() => removeBlock(b.id)} aria-label="Remove exercise" title="Remove" style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 10, display: "flex" }}>
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  <SetPills sets={b.sets} unit={unit} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Label style={{ marginBottom: 0 }}>{editingBlockId ? "Editing exercise" : "Add exercise"}</Label>
          <button onClick={() => setShowManage((v) => !v)} style={linkBtnStyle}>
            {showManage ? "Close" : "Manage exercises"}
          </button>
        </div>

        {showManage && (
          <ManageExercises
            exercises={exercises}
            deleteExercise={deleteExercise}
            updateExercise={updateExercise}
            customGroups={customGroups}
            addGroup={addGroup}
          />
        )}

        {!showManage && (
          <>
            {!editingBlockId && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ flex: 1 }} />
                <button onClick={() => setShowAddExercise((v) => !v)} style={linkBtnStyle}>
                  <Plus size={16} /> New exercise
                </button>
              </div>
            )}

            {!showAddExercise && exercises.length > 0 && (
              <ExercisePicker
                exercises={exercises}
                value={addingExerciseId}
                onChange={setAddingExerciseId}
                disabled={!!editingBlockId}
                showType
              />
            )}

            {showAddExercise && !editingBlockId && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--surface2)", padding: 12, borderRadius: 6 }}>
                <input placeholder="Exercise name (e.g. Barbell Bench Press)" value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} />
                <div style={{ display: "flex", gap: 8 }}>
                  {["compound", "isolation"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: `1px solid ${newType === t ? "var(--accent)" : "var(--border)"}`,
                        background: newType === t ? "var(--accent-dim)" : "transparent",
                        color: "var(--text)",
                        cursor: "pointer",
                        textTransform: "capitalize",
                        fontSize: 13,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                  Target failure range: {topBottom(newType, settings).bottom}–{topBottom(newType, settings).top} reps
                </div>

                {!useCustomGroup ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                      {groupOptions.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => setUseCustomGroup(true)} style={{ ...linkBtnStyle, flexShrink: 0 }}>
                      <Plus size={14} /> New group
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      placeholder="Muscle group (e.g. Forearms)"
                      value={customGroup}
                      onChange={(e) => setCustomGroup(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button onClick={() => setUseCustomGroup(false)} style={{ ...linkBtnStyle, flexShrink: 0 }}>
                      Use list
                    </button>
                  </div>
                )}

                <button onClick={addExercise} style={primaryBtnStyle}>
                  Add exercise
                </button>
              </div>
            )}

            {activeExercise && !showAddExercise && (
              <>
                {!editingBlockId && suggestion && suggestion.status !== "no-data" && (
                  <div style={{ marginTop: 12 }}>
                    <SuggestionBanner exercise={activeExercise} suggestion={suggestion} settings={settings} />
                  </div>
                )}

                {!editingBlockId && (
                  <WarmupRamp warmupSets={warmupSets} targetWeight={targetWeight} unit={unit} onAdd={addWarmupRamp} />
                )}

                <div style={{ marginTop: 18 }}>
                  <Label>Sets</Label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {sets.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input type="number" inputMode="numeric" placeholder={unit} value={s.weight} onChange={(e) => updateSet(i, "weight", e.target.value)} style={{ ...inputStyle, width: 78 }} />
                        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>×</span>
                        <input type="number" inputMode="numeric" placeholder="reps" value={s.reps} onChange={(e) => updateSet(i, "reps", e.target.value)} style={{ ...inputStyle, width: 68 }} />
                        <button
                          onClick={() => updateSet(i, "warmup", !s.warmup)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 6,
                            border: `1px solid ${s.warmup ? "var(--gold)" : "var(--border)"}`,
                            background: s.warmup ? "rgba(214,162,60,0.15)" : "transparent",
                            color: s.warmup ? "var(--gold)" : "var(--text-dim)",
                            fontSize: 13,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.warmup ? "Warm-up" : "Working"}
                        </button>
                        <button
                          onClick={() => removeSetRow(i)}
                          aria-label="Remove set"
                          title="Remove set"
                          style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 10, marginLeft: "auto", display: "flex" }}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addSetRow} style={{ ...linkBtnStyle, marginTop: 10, padding: "10px 4px" }}>
                    <Plus size={16} /> Add set
                  </button>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button onClick={commitBlock} style={{ ...primaryBtnStyle, flex: 1 }}>
                    {editingBlockId ? "Save changes" : "Add to workout"}
                  </button>
                  {editingBlockId && (
                    <button onClick={resetSetEditor} style={{ ...secondaryBtnStyle, flexShrink: 0 }}>
                      Cancel
                    </button>
                  )}
                </div>

                {!editingBlockId && priorEntries.length > 0 && (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <Label>Last · {fmtDate(priorEntries[0].date)}</Label>
                    <SetPills sets={priorEntries[0].sets} unit={unit} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function ManageExercises({ exercises, deleteExercise, updateExercise, customGroups, addGroup }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [editType, setEditType] = useState("compound");
  const [confirmId, setConfirmId] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const groupOptions = allMuscleGroups(exercises, customGroups);
  const grouped = groupByMuscleFull(groupOptions, exercises);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="Add a new muscle group (e.g. Forearms)"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => {
            addGroup(newGroupName);
            setNewGroupName("");
          }}
          style={{ ...primaryBtnStyle, flexShrink: 0, padding: "9px 14px" }}
        >
          Add
        </button>
      </div>

      {!exercises.length && Object.keys(grouped).every((g) => grouped[g].length === 0) && (
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>No exercises added yet.</div>
      )}

      {Object.entries(grouped).map(([group, exs]) => (
        <div key={group}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-dim)", marginBottom: 6 }}>
            {group}
          </div>
          {exs.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" }}>No exercises yet — it'll show up when you add one to this group.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {exs.map((ex) => (
                <div key={ex.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", padding: 8, borderRadius: 6, flexWrap: "wrap" }}>
                  {editingId === ex.id ? (
                    <>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 100 }} />
                      <select value={editGroup} onChange={(e) => setEditGroup(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 100 }}>
                        {groupOptions.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                      <select value={editType} onChange={(e) => setEditType(e.target.value)} style={{ ...inputStyle, width: 130 }}>
                        <option value="compound">Compound</option>
                        <option value="isolation">Isolation</option>
                      </select>
                      <button
                        onClick={() => {
                          updateExercise(ex.id, { name: editName.trim() || ex.name, muscleGroup: editGroup, type: editType });
                          setEditingId(null);
                        }}
                        aria-label="Save exercise"
                        title="Save"
                        style={{ background: "none", border: "none", color: "var(--accent2)", cursor: "pointer" }}
                      >
                        <Check size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 13 }}>{ex.name}</span>
                      <TypeBadge type={ex.type} />
                      <button
                        onClick={() => {
                          setEditingId(ex.id);
                          setEditName(ex.name);
                          setEditGroup(ex.muscleGroup || "Other");
                          setEditType(ex.type || "compound");
                        }}
                        aria-label={`Edit ${ex.name}`}
                        title="Edit"
                        style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
                      >
                        <Pencil size={14} />
                      </button>
                      {confirmId === ex.id ? (
                        <button
                          onClick={() => {
                            deleteExercise(ex.id);
                            setConfirmId(null);
                          }}
                          style={{ background: "var(--danger)", border: "none", borderRadius: 4, color: "#fff", fontSize: 11, padding: "4px 8px", cursor: "pointer" }}
                        >
                          Confirm delete
                        </button>
                      ) : (
                        <button onClick={() => setConfirmId(ex.id)} aria-label={`Delete ${ex.name}`} title="Delete" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SetPills({ sets }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {sets.map((s, i) => (
        <span
          key={i}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 5,
            background: s.warmup ? "transparent" : "var(--surface2)",
            border: `1px solid ${s.warmup ? "var(--border)" : "var(--accent-dim)"}`,
            color: s.warmup ? "var(--text-dim)" : "var(--text)",
          }}
        >
          {s.weight}×{s.reps}
          {s.warmup ? " (w)" : ""}
        </span>
      ))}
    </div>
  );
}

function SuggestionBanner({ exercise, suggestion, settings }) {
  const { top } = topBottom(exercise.type, settings);
  const unit = settings.unit;
  const needed = suggestion.needed ?? settings[exercise.type]?.sets;
  if (suggestion.status === "increase") {
    return (
      <div style={{ border: "1px solid var(--accent)", background: "var(--accent-dim)", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <Flame size={20} color="var(--accent)" />
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700 }}>
            {suggestion.big ? "Big jump — " : "Move up to "}{suggestion.to} {unit}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
            {suggestion.big
              ? `crushed ${suggestion.from} (top+${BLOWOUT_MARGIN}) — double jump`
              : `${top}×${needed} at ${suggestion.from} — reset to ~${suggestion.resetReps} reps`}
          </div>
        </div>
      </div>
    );
  }
  if (suggestion.status === "stall") {
    return (
      <div style={{ border: "1px solid var(--danger)", background: "rgba(200,70,70,0.12)", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <AlertTriangle size={20} color="var(--danger)" />
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700 }}>
            Deload to {suggestion.to} {unit}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
            stalled at {suggestion.weight} for {suggestion.sessions} sessions — rebuild reps
          </div>
        </div>
      </div>
    );
  }
  if (suggestion.status === "decrease") {
    return (
      <div style={{ border: "1px solid var(--gold)", background: "rgba(214,162,60,0.12)", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <TrendingDown size={20} color="var(--gold)" />
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700 }}>
            Drop to {suggestion.to} {unit}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
            under {suggestion.bottom} reps at {suggestion.from} — rebuild reps
          </div>
        </div>
      </div>
    );
  }
  if (suggestion.status === "add-reps") {
    return (
      <div style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 8, padding: 14 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700 }}>
          Aim for {suggestion.targetReps} @ {suggestion.weight} {unit}
        </div>
        {suggestion.lastReps && suggestion.lastReps.length > 0 && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)", margin: "4px 0 8px" }}>
            Last {suggestion.weight}×{suggestion.lastReps.join(",")} → {suggestion.targetSets.join(",")}
          </div>
        )}
        <div className="plateRow">
          {Array.from({ length: suggestion.needed }).map((_, i) => (
            <div key={i} className={`plate ${i < suggestion.progress ? "filled" : ""}`} />
          ))}
        </div>
      </div>
    );
  }
  return null;
}

// Warm-up ramp preview, shared by the Log and Next Up tabs. On the Log tab an
// `onAdd` handler is passed so the ramp can be dropped straight into the set editor.
function WarmupRamp({ warmupSets, targetWeight, unit, onAdd }) {
  if (!warmupSets.length) return null;
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Label style={{ marginBottom: 0 }}>Warm-up · target {targetWeight} {unit}</Label>
        {onAdd && (
          <button onClick={onAdd} style={{ ...linkBtnStyle, flexShrink: 0 }}>
            <Plus size={16} /> Add to sets
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {warmupSets.map((w, i) => (
          <span
            key={i}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 5,
              background: "transparent",
              border: "1px solid var(--gold)",
              color: "var(--gold)",
            }}
          >
            {w.weight}×{w.reps}
          </span>
        ))}
      </div>
    </div>
  );
}

// Short beep via Web Audio — no asset needed, works offline.
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => ctx.close();
  } catch {
    /* audio unavailable — ignore */
  }
}

// Manual-start rest timer: pick a preset, count down, alert (beep/vibrate) at 0.
// While running it pins to the bottom of the screen so it stays visible as you log.
function RestTimer({ settings, onOpenSettings }) {
  const rt = settings.restTimer || DEFAULT_SETTINGS.restTimer;
  const def = rt.defaultSeconds || 120;
  const [endAt, setEndAt] = useState(null); // ms timestamp the countdown ends, or null when idle
  const [remaining, setRemaining] = useState(0); // seconds left (display)
  const [duration, setDuration] = useState(def); // seconds the current run started with (for Reset)
  const [done, setDone] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (endAt == null) return;
    firedRef.current = false;
    const tick = () => {
      const secs = (endAt - Date.now()) / 1000;
      if (secs <= 0) {
        setRemaining(0);
        if (!firedRef.current) {
          firedRef.current = true;
          if (rt.vibrate && navigator.vibrate) {
            try { navigator.vibrate([200, 100, 200]); } catch { /* ignore */ }
          }
          if (rt.sound) beep();
          setDone(true);
          setEndAt(null);
        }
      } else {
        setRemaining(secs);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endAt, rt.sound, rt.vibrate]);

  // Auto-clear the "done" flash after a few seconds.
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 5000);
    return () => clearTimeout(id);
  }, [done]);

  function start(seconds) {
    setDone(false);
    setDuration(seconds);
    setRemaining(seconds);
    setEndAt(Date.now() + seconds * 1000);
  }
  function adjust(delta) {
    setEndAt((prev) => (prev == null ? prev : Math.max(Date.now(), prev + delta * 1000)));
  }
  function stop() {
    setEndAt(null);
    setRemaining(0);
    setDone(false);
  }

  const running = endAt != null;

  if (!running && !done) {
    // Presets: 1/2/3 min plus the user's custom default (deduped, sorted).
    const presets = Array.from(new Set([60, 120, 180, def])).sort((a, b) => a - b);
    return (
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Timer size={16} color="var(--accent2)" />
            <Label style={{ marginBottom: 0 }}>Rest timer</Label>
          </div>
          {onOpenSettings && (
            <button onClick={onOpenSettings} style={{ ...linkBtnStyle, flexShrink: 0 }} aria-label="Rest timer settings" title="Customize rest timer">
              <Settings size={16} /> Customize
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {presets.map((s) => (
            <button
              key={s}
              onClick={() => start(s)}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 14,
              }}
            >
              {fmtClock(s)}
            </button>
          ))}
        </div>
      </Card>
    );
  }

  const pillBtn = {
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--text)",
    cursor: "pointer",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        background: done ? "var(--accent-dim)" : "var(--surface)",
        borderTop: `1px solid ${done ? "var(--accent)" : "var(--border)"}`,
        paddingTop: 10,
        paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        paddingRight: "max(16px, env(safe-area-inset-right))",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
        <Timer size={18} color="var(--accent)" />
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, minWidth: 62 }}>
          {done ? "Done" : fmtClock(remaining)}
        </div>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {!done && (
            <>
              <button onClick={() => adjust(-15)} style={pillBtn}>−15s</button>
              <button onClick={() => adjust(15)} style={pillBtn}>+15s</button>
              <button onClick={() => start(duration)} style={pillBtn} aria-label="Reset" title="Reset">
                <RotateCcw size={14} />
              </button>
            </>
          )}
          <button onClick={stop} style={{ ...pillBtn, borderColor: "var(--accent)", color: "var(--accent)" }}>
            {done ? "Dismiss" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Shared muscle-group grouped picker (used by Log and Stats charts).
function ExercisePicker({ exercises, value, onChange, style, disabled, showType }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={style || inputStyle} disabled={disabled}>
      {Object.entries(groupByMuscle(exercises)).map(([group, exs]) => (
        <optgroup label={group} key={group}>
          {exs.map((e) => (
            <option key={e.id} value={e.id}>
              {showType ? `${e.name} — ${e.type}` : e.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/* ---------------- STATS TAB (charts + records) ---------------- */

function StatsTab({ exercises, entriesByExercise, settings }) {
  const [view, setView] = useState("charts"); // "charts" | "records"
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {[["charts", "Charts"], ["records", "Records"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              flex: 1,
              padding: "9px 10px",
              borderRadius: 6,
              border: `1px solid ${view === key ? "var(--accent)" : "var(--border)"}`,
              background: view === key ? "var(--accent-dim)" : "transparent",
              color: "var(--text)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "charts" ? (
        <ChartsView exercises={exercises} entriesByExercise={entriesByExercise} settings={settings} />
      ) : (
        <RecordsView exercises={exercises} entriesByExercise={entriesByExercise} settings={settings} />
      )}
    </div>
  );
}

function ChartsView({ exercises, entriesByExercise, settings }) {
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id || "");
  const [metric, setMetric] = useState("e1rm"); // "e1rm" | "weight"
  const unit = settings.unit;

  if (!exercises.length) return <EmptyState text="Log a workout to see charts." />;

  const activeId = exerciseId || exercises[0].id;
  const entriesAsc = [...(entriesByExercise[activeId] || [])].reverse();
  const chartData = entriesAsc.map((entry) => {
    const working = entry.sets.filter((s) => !s.warmup);
    const topSet = working.length ? working.reduce((a, b) => (b.weight > a.weight ? b : a)) : null;
    const bestE1rm = working.reduce((max, s) => Math.max(max, e1rm(s.weight, s.reps)), 0);
    return {
      date: fmtShort(entry.date),
      weight: topSet ? topSet.weight : null,
      reps: topSet ? topSet.reps : null,
      e1rm: bestE1rm || null,
    };
  });

  const activeExercise = exercises.find((e) => e.id === activeId);
  const isE1rm = metric === "e1rm";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ExercisePicker exercises={exercises} value={activeId} onChange={setExerciseId} />

      {activeExercise && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TypeBadge type={activeExercise.type} />
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
              Target {topBottom(activeExercise.type, settings).bottom}–{topBottom(activeExercise.type, settings).top} reps
            </span>
          </div>

          {chartData.length === 0 ? (
            <EmptyState text="No sessions logged yet." />
          ) : (
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Label style={{ marginBottom: 0 }}>{isE1rm ? "Est. 1RM over time" : "Top set over time"}</Label>
                <div style={{ display: "flex", gap: 4 }}>
                  {[["e1rm", "Est. 1RM"], ["weight", "Weight"]].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setMetric(key)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: `1px solid ${metric === key ? "var(--accent)" : "var(--border)"}`,
                        background: metric === key ? "var(--accent-dim)" : "transparent",
                        color: "var(--text)",
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={11} />
                    <YAxis stroke="var(--text-dim)" fontSize={11} domain={["dataMin - 5", "dataMax + 5"]} />
                    <Tooltip
                      contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", fontSize: 12 }}
                      formatter={(val, name, props) =>
                        isE1rm ? [`${val} ${unit} est.`, "1RM"] : [`${val} ${unit} × ${props.payload.reps} reps`, "Top set"]
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey={isE1rm ? "e1rm" : "weight"}
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--accent)" }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card>
            <Label>Session log</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(entriesByExercise[activeId] || []).map((entry) => (
                <div key={entry.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                    {fmtDate(entry.date)}
                    {entry.sessionName ? ` — ${entry.sessionName}` : ""}
                  </div>
                  <SetPills sets={entry.sets} unit={unit} />
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function RecordsView({ exercises, entriesByExercise, settings }) {
  const unit = settings.unit;
  if (!exercises.length) return <EmptyState text="Log sessions to build records." />;

  const grouped = groupByMuscle(exercises);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {Object.entries(grouped).map(([group, exs]) => (
        <CollapsibleSection key={group} title={group} count={exs.length}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {exs.map((ex) => {
              const entries = entriesByExercise[ex.id] || [];
              const working = entries.flatMap((e) => e.sets.filter((s) => !s.warmup).map((s) => ({ ...s, date: e.date })));
              if (!working.length) {
                return (
                  <Card key={ex.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{ex.name}</div>
                      <TypeBadge type={ex.type} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>No working sets logged yet.</div>
                  </Card>
                );
              }
              const heaviest = working.reduce((a, b) => (b.weight > a.weight ? b : a));
              const { top } = topBottom(ex.type, settings);
              const inRange = working.filter((s) => s.reps >= top);
              const bestInRange = inRange.length ? inRange.reduce((a, b) => (b.weight > a.weight ? b : a)) : null;
              const mostReps = working.reduce((a, b) => (b.reps > a.reps ? b : a));

              return (
                <Card key={ex.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{ex.name}</div>
                    <TypeBadge type={ex.type} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <StatBlock icon={<Award size={14} color="var(--accent)" />} label="Heaviest set" value={`${heaviest.weight} ${unit} × ${heaviest.reps}`} sub={fmtDate(heaviest.date)} />
                    <StatBlock
                      icon={<TrendingUp size={14} color="var(--accent2)" />}
                      label={`Best @ ${top}+ reps`}
                      value={bestInRange ? `${bestInRange.weight} ${unit} × ${bestInRange.reps}` : "—"}
                      sub={bestInRange ? fmtDate(bestInRange.date) : "Not hit yet"}
                    />
                    <StatBlock icon={<Flame size={14} color="var(--gold)" />} label="Most reps" value={`${mostReps.reps} @ ${mostReps.weight} ${unit}`} sub={fmtDate(mostReps.date)} />
                    <StatBlock
                      icon={<Dumbbell size={14} color="var(--text-dim)" />}
                      label="Sessions logged"
                      value={entries.length}
                      sub={entries.length ? fmtDate(entries[0].date) + " latest" : ""}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
}

function StatBlock({ icon, label, value, sub }) {
  return (
    <div style={{ background: "var(--surface2)", borderRadius: 6, padding: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ---------------- HISTORY TAB ---------------- */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function HistoryTab({ exercises, sessions, onEditWorkout, settings }) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(null);
  const unit = settings.unit;

  const sessionsByDate = useMemo(() => {
    const map = {};
    sessions.forEach((s) => (map[s.date] = s));
    return map;
  }, [sessions]);

  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = todayStr();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function shiftMonth(delta) {
    setSelected(null);
    setView((v) => {
      const m = v.month + delta;
      const year = v.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  const selectedSession = selected ? sessionsByDate[selected] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" style={iconBtnStyle} title="Previous month">
            <ChevronLeft size={18} />
          </button>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: 0.5, textTransform: "uppercase" }}>{monthLabel}</div>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" style={iconBtnStyle} title="Next month">
            <ChevronRight size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {WEEKDAYS.map((w) => (
            <div key={w} style={{ textAlign: "center", fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)", padding: "2px 0" }}>
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const dateStr = ymd(view.year, view.month, d);
            const has = !!sessionsByDate[dateStr];
            const isToday = dateStr === today;
            const isSelected = dateStr === selected;
            return (
              <button
                key={dateStr}
                onClick={() => setSelected(has ? (isSelected ? null : dateStr) : null)}
                disabled={!has}
                style={{
                  aspectRatio: "1 / 1",
                  border: isToday ? "1px solid var(--accent2)" : "1px solid var(--border)",
                  background: isSelected ? "var(--accent-dim)" : has ? "var(--surface2)" : "transparent",
                  borderRadius: 6,
                  color: has ? "var(--text)" : "var(--text-dim)",
                  cursor: has ? "pointer" : "default",
                  fontSize: 13,
                  fontFamily: "var(--font-mono)",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {d}
                {has && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 4,
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--accent)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {selectedSession ? (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{selectedSession.name || "Workout"}</div>
            <button onClick={() => onEditWorkout(selectedSession.date)} style={linkBtnStyle}>
              <Pencil size={13} /> Edit
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 12 }}>{fmtDate(selectedSession.date)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {selectedSession.blocks.map((b) => {
              const ex = exercises.find((e) => e.id === b.exerciseId);
              return (
                <div key={b.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 14 }}>{ex ? ex.name : "(deleted exercise)"}</span>
                    {ex && <TypeBadge type={ex.type} />}
                  </div>
                  <SetPills sets={b.sets} unit={unit} />
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "center", padding: "8px 0" }}>
          {sessions.length ? "Tap a highlighted day to see that workout." : "No workouts logged yet."}
        </div>
      )}
    </div>
  );
}

/* ---------------- SETTINGS TAB ---------------- */

function SettingsTab({ settings, persistSettings, onExport, onImport }) {
  const [importMsg, setImportMsg] = useState(null);
  function setField(patch) {
    persistSettings({ ...settings, ...patch });
  }
  function setTypeField(type, patch) {
    persistSettings({ ...settings, [type]: { ...settings[type], ...patch } });
  }
  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      await onImport(file);
      setImportMsg({ ok: true, text: "Backup imported." });
    } catch (err) {
      setImportMsg({ ok: false, text: `Import failed: ${err.message}` });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Label>Units</Label>
        <div style={{ display: "flex", gap: 8 }}>
          {["lb", "kg"].map((u) => (
            <button
              key={u}
              onClick={() => setField({ unit: u, increment: u === "kg" ? 2.5 : 5 })}
              style={{
                flex: 1,
                padding: "9px 10px",
                borderRadius: 6,
                border: `1px solid ${settings.unit === u ? "var(--accent)" : "var(--border)"}`,
                background: settings.unit === u ? "var(--accent-dim)" : "transparent",
                color: "var(--text)",
                cursor: "pointer",
                fontSize: 13,
                textTransform: "uppercase",
              }}
            >
              {u}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>
          Relabels only; won't convert logged numbers.
        </div>

        <div style={{ height: 14 }} />
        <div style={{ maxWidth: 200 }}>
          <NumberField
            label={`Increment (${settings.unit} per jump)`}
            value={settings.increment}
            min={0}
            onChange={(v) => setField({ increment: v })}
          />
        </div>
      </Card>

      {["compound", "isolation"].map((type) => (
        <Card key={type}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
            {type} rules
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <NumberField
              label="Sets to advance"
              value={settings[type].sets}
              min={1}
              onChange={(v) => setTypeField(type, { sets: v })}
            />
            <NumberField
              label="Warm-up sets"
              value={settings[type].warmupSets}
              min={0}
              onChange={(v) => setTypeField(type, { warmupSets: v })}
            />
            <NumberField
              label="Rep range — low"
              value={settings[type].repBottom}
              min={1}
              max={settings[type].repTop - 1}
              onChange={(v) => setTypeField(type, { repBottom: v })}
            />
            <NumberField
              label="Rep range — high"
              value={settings[type].repTop}
              min={settings[type].repBottom + 1}
              onChange={(v) => setTypeField(type, { repTop: v })}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 10 }}>
            {settings[type].repTop}+ × {settings[type].sets} set{settings[type].sets === 1 ? "" : "s"} → +{settings.increment} {settings.unit}.
          </div>
        </Card>
      ))}

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Timer size={16} color="var(--accent2)" />
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Rest timer
          </div>
        </div>
        <div style={{ maxWidth: 200, marginBottom: 14 }}>
          <NumberField
            label="Default (seconds)"
            value={settings.restTimer.defaultSeconds}
            min={5}
            onChange={(v) => setField({ restTimer: { ...settings.restTimer, defaultSeconds: v } })}
          />
        </div>
        <Label>Alert at zero</Label>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["sound", "Sound"],
            ["vibrate", "Vibration"],
          ].map(([key, label]) => {
            const on = !!settings.restTimer[key];
            return (
              <button
                key={key}
                onClick={() => setField({ restTimer: { ...settings.restTimer, [key]: !on } })}
                style={{
                  flex: 1,
                  padding: "9px 10px",
                  borderRadius: 6,
                  border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                  background: on ? "var(--accent-dim)" : "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {on && <Check size={13} color="var(--accent)" />}
                {label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <Label>Color theme</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {Object.entries(THEMES).map(([key, theme]) => {
            const active = settings.theme === key;
            return (
              <button
                key={key}
                onClick={() => setField({ theme: key })}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: "var(--surface2)",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", gap: 4 }}>
                  {["--bg", "--surface2", "--accent", "--accent2", "--gold"].map((v) => (
                    <span key={v} style={{ width: 18, height: 18, borderRadius: 4, background: theme.vars[v], border: "1px solid rgba(128,128,128,0.3)" }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                  {active && <Check size={13} color="var(--accent)" />}
                  {theme.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <Label>Data & backup</Label>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
          Stored on this device. Export to back up; import replaces current data.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onExport} style={primaryBtnStyle}>
            Export backup
          </button>
          <label style={{ ...secondaryBtnStyle, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            Import backup
            <input type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: "none" }} />
          </label>
        </div>
        {importMsg && (
          <div style={{ fontSize: 12, marginTop: 10, color: importMsg.ok ? "var(--accent2)" : "var(--danger)" }}>
            {importMsg.text}
          </div>
        )}
      </Card>
    </div>
  );
}

// Lets the user type freely; only commits a valid number (within min/max) on
// blur or Enter. Anything invalid — non-numeric, empty, or out of range —
// reverts to the last valid value instead of being force-clamped mid-typing.
function NumberField({ label, value, min, max, onChange }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);

  function commit() {
    const trimmed = text.trim();
    const n = Number(trimmed);
    const valid =
      trimmed !== "" &&
      Number.isFinite(n) &&
      (min == null || n >= min) &&
      (max == null || n <= max);
    if (valid) onChange(n);
    else setText(String(value)); // revert to the original number
  }

  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        style={inputStyle}
      />
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function Card({ children }) {
  return <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>{children}</div>;
}

function Label({ children, style }) {
  return (
    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-dim)", marginBottom: 8, fontFamily: "var(--font-mono)", ...style }}>
      {children}
    </div>
  );
}

const inputStyle = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "9px 10px",
  color: "var(--text)",
  fontSize: 16, // 16px prevents iOS zoom-on-focus
  width: "100%",
};

const primaryBtnStyle = {
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  padding: "12px 16px",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font-display)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const secondaryBtnStyle = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "12px 16px",
  color: "var(--text)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font-display)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const linkBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  fontSize: 14,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 8px",
};

const iconBtnStyle = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  cursor: "pointer",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
};
