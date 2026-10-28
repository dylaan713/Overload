import { useRef, useState } from "react";
import { backupFilename, downloadText, oldDataFilename } from "../../app/download";
import { capitalize, plural, shortDate } from "../../app/format";
import { framesLine, resetFrames } from "../../app/frames";
import { readFileText } from "../../app/readFile";
import { exportBackup, parseBackup } from "../../data/backup";
import { dumpLegacyRaw } from "../../data/boot";
import { DataError } from "../../data/normalize";
import { changedEquipmentSteps, convertUnits, phaseOf } from "../../domain/settings";
import type { StoreDoc, Style, ThemePref, Unit } from "../../domain/types";
import { useApp, useKv, useUi } from "../../state/context";
import { Button } from "../../ui/Button";
import { Field, Input, fieldErrorId } from "../../ui/Field";
import { ListGroup, ListItem, ListRow } from "../../ui/ListRow";
import { Segmented } from "../../ui/Segmented";
import { useSheetNav, type SheetView } from "../../ui/SheetStack";
import { libraryView } from "../exercises/LibraryView";
import { equipmentStepsView } from "./EquipmentStepsView";
import { styleRulesView } from "./StyleRulesView";
import styles from "./Settings.module.css";

export function SettingsRoot() {
  return (
    <div className={styles.view}>
      <TrainingSection />
      <ExercisesSection />
      <UnitsSection />
      <EquipmentSection />
      <AppearanceSection />
      <DataSection />
    </div>
  );
}

export const settingsView = (): SheetView => ({ id: "settings", title: "Settings", render: () => <SettingsRoot /> });

function TrainingSection() {
  const settings = useApp((s) => s.doc.settings);
  const today = useApp((s) => s.today)();
  const startPhase = useApp((s) => s.startPhase);
  const setPhaseStart = useApp((s) => s.setPhaseStart);
  const nav = useSheetNav();
  const phase = phaseOf(settings, today);
  const [error, setError] = useState<string | null>(null);
  return (
    <ListGroup title="Training">
      <ListItem>
        <Segmented<Style>
          label="Style"
          value={phase.style}
          options={[{ value: "strength", label: "Strength" }, { value: "hypertrophy", label: "Hypertrophy" }]}
          onChange={(s) => {
            setError(null);
            void startPhase(s);
          }}
        />
        <p className={styles.caption}>{`${capitalize(phase.style)} since ${shortDate(phase.startDate)}`}</p>
        <Field label="Started" htmlFor="phase-start" error={error}>
          <Input
            id="phase-start"
            type="date"
            max={today}
            value={phase.startDate}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? fieldErrorId("phase-start") : undefined}
            onChange={async (e) => setError(await setPhaseStart(phase.id, e.target.value))}
          />
        </Field>
      </ListItem>
      <ListRow label="Style rules" detail="Reps, effort, rest" onPress={() => nav.push(styleRulesView())} />
    </ListGroup>
  );
}

function ExercisesSection() {
  const count = useApp((s) => s.doc.exercises.filter((e) => !e.archived).length);
  const nav = useSheetNav();
  return (
    <ListGroup title="Exercises">
      <ListRow label="Exercise library" detail={plural(count, "exercise")} onPress={() => nav.push(libraryView())} />
    </ListGroup>
  );
}

function UnitsSection() {
  const doc = useApp((s) => s.doc);
  const setUnit = useApp((s) => s.setUnit);
  const [pending, setPending] = useState<{ unit: Unit; sets: number; steps: number; overrides: number } | null>(null);

  function choose(unit: Unit) {
    if (unit === doc.settings.unit) return setPending(null);
    const sets = convertUnits(doc, unit).changedSets;
    const steps = changedEquipmentSteps(doc.settings);
    const overrides = doc.exercises.filter((e) => e.step !== null).length;
    if (sets === 0 && steps === 0 && overrides === 0) void setUnit(unit);
    else setPending({ unit, sets, steps, overrides });
  }

  return (
    <ListGroup title="Units">
      <ListItem>
        <Segmented<Unit> label="Units" value={doc.settings.unit} options={[{ value: "lb", label: "lb" }, { value: "kg", label: "kg" }]} onChange={choose} />
        {pending && (
          <div className={styles.confirm}>
            <p>
              {pending.sets > 0
                ? `Convert ${plural(pending.sets, "logged set")} to ${pending.unit}? Switching back restores the exact numbers.`
                : `Switch to ${pending.unit}?`}
              {pending.steps > 0
                ? ` ${plural(pending.steps, "changed equipment step")} will reset to ${pending.unit} defaults.`
                : pending.sets > 0 && ` Equipment steps reset to ${pending.unit} defaults.`}
              {pending.overrides > 0 && ` ${plural(pending.overrides, "custom step")} will be cleared.`}
            </p>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (await setUnit(pending.unit)) setPending(null);
                }}
              >
                {pending.sets > 0 ? "Convert" : "Switch"}
              </Button>
            </div>
          </div>
        )}
      </ListItem>
    </ListGroup>
  );
}

function EquipmentSection() {
  const nav = useSheetNav();
  return (
    <ListGroup title="Gym">
      <ListRow label="Equipment steps" detail="Per gym" onPress={() => nav.push(equipmentStepsView())} />
    </ListGroup>
  );
}

function AppearanceSection() {
  const theme = useApp((s) => s.doc.settings.theme);
  const updateSettings = useApp((s) => s.updateSettings);
  return (
    <ListGroup title="Appearance">
      <ListItem>
        <Segmented<ThemePref>
          label="Appearance"
          value={theme}
          options={[{ value: "system", label: "System" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" }]}
          onChange={(t) => void updateSettings((s) => ({ ...s, theme: t }))}
        />
      </ListItem>
    </ListGroup>
  );
}

function DataSection() {
  const doc = useApp((s) => s.doc);
  const hasLegacy = useApp((s) => s.hasLegacy);
  const replaceDoc = useApp((s) => s.replaceDoc);
  const showToast = useUi((s) => s.showToast);
  const kv = useKv();
  const input = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<StoreDoc | null>(null);
  const [frames, setFrames] = useState(framesLine); // TEMP (wave 3)

  async function onFile(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    setIncoming(null);
    try {
      setIncoming(parseBackup(await readFileText(file), () => {}));
    } catch (e) {
      setImportError(e instanceof DataError ? e.message : "Couldn't read that file");
    }
    if (input.current) input.current.value = ""; // picking the same file again still fires change
  }

  return (
    <ListGroup title="Data & backup" footer="Everything stays on this device. Export a backup to keep a copy.">
      {/* TEMP (wave 3): how the animations actually run on the phone. Remove with src/app/frames.ts. */}
      <ListItem>
        <p className={styles.caption}>{frames}</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setFrames(framesLine())}>Read frames</Button>
          <Button variant="secondary" onClick={() => { resetFrames(); setFrames(framesLine()); }}>Reset</Button>
        </div>
      </ListItem>
      <ListItem>
        <Button variant="secondary" block onClick={() => downloadText(backupFilename(), exportBackup(doc))}>Export backup</Button>
        <Button variant="secondary" block onClick={() => input.current?.click()}>Import backup</Button>
        <input ref={input} data-testid="import-file" type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        {importError && <p role="alert" className={styles.error}>{importError}</p>}
        {incoming && (
          <div className={styles.confirm}>
            <p>{`Replace your data with this backup? It has ${plural(incoming.exercises.length, "exercise")} and ${plural(incoming.sessions.length, "session")}.`}</p>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => setIncoming(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (await replaceDoc(incoming)) {
                    setIncoming(null);
                    showToast({ text: "Backup imported" });
                  }
                }}
              >
                Replace
              </Button>
            </div>
          </div>
        )}
        {hasLegacy && (
          <>
            <Button variant="secondary" block onClick={async () => downloadText(oldDataFilename(), JSON.stringify(await dumpLegacyRaw(kv), null, 2))}>
              Download old app data
            </Button>
            <p className={styles.caption}>Your workouts from the previous version, as a file.</p>
          </>
        )}
      </ListItem>
    </ListGroup>
  );
}
