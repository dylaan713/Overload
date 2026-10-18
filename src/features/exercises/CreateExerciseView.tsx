import { useState } from "react";
import type { Equipment, LiftClass, Muscle } from "../../domain/types";
import { useApp, useUi } from "../../state/context";
import { Button } from "../../ui/Button";
import { Field, Input, fieldErrorId } from "../../ui/Field";
import { ListGroup, ListItem } from "../../ui/ListRow";
import { NumberField } from "../../ui/NumberField";
import { Segmented } from "../../ui/Segmented";
import { useSheetNav, type SheetView } from "../../ui/SheetStack";
import { EquipmentSelect, MuscleFields } from "./fields";
import { LIBRARY_VIEW_ID } from "./ids";
import styles from "./Exercises.module.css";

type Errors = Partial<Record<"name" | "equipment" | "primary" | "class", string>>;

/** "Create your own": name, equipment, muscles and compound/isolation are required; the step is optional. */
export function CreateExerciseView() {
  const settings = useApp((s) => s.doc.settings);
  const addCustom = useApp((s) => s.addCustom);
  const showToast = useUi((s) => s.showToast);
  const nav = useSheetNav();
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState<Equipment | "">("");
  const [primary, setPrimary] = useState<Muscle[]>([]);
  const [secondary, setSecondary] = useState<Muscle[]>([]);
  const [cls, setCls] = useState<LiftClass | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  async function save() {
    const next: Errors = {};
    if (!name.trim()) next.name = "Name can't be empty";
    if (!equipment) next.equipment = "Pick the equipment";
    if (primary.length === 0) next.primary = "Pick at least one muscle worked";
    if (!cls) next.class = "Pick compound or isolation";
    setErrors(next);
    if (Object.keys(next).length || !equipment || !cls) return;
    const r = await addCustom({ name, equipment, primary, secondary, class: cls, step });
    if ("id" in r) {
      nav.popTo(LIBRARY_VIEW_ID);
      showToast({ text: `Added ${name.trim()}` });
    }
  }

  // Custom exercises are never "assisted", so the default step is the equipment's own.
  const defaultStep = equipment ? settings.equipmentSteps[equipment] : null;
  return (
    <div className={styles.view}>
      <ListGroup title="Exercise">
        <ListItem>
          <Field label="Name" htmlFor="new-name" error={errors.name}>
            <Input id="new-name" value={name} aria-invalid={errors.name ? "true" : undefined} aria-describedby={errors.name ? fieldErrorId("new-name") : undefined} onChange={(e) => setName(e.target.value)} />
          </Field>
          <EquipmentSelect value={equipment} onChange={setEquipment} error={errors.equipment} />
          <Segmented<LiftClass> label="Type" value={cls} options={[{ value: "compound", label: "Compound" }, { value: "isolation", label: "Isolation" }]} onChange={setCls} />
          {errors.class && <p role="alert" className={styles.error}>{errors.class}</p>}
        </ListItem>
      </ListGroup>
      <ListGroup title="Muscles">
        <ListItem>
          <MuscleFields primary={primary} secondary={secondary} onPrimary={setPrimary} onSecondary={setSecondary} error={errors.primary} />
        </ListItem>
      </ListGroup>
      <ListGroup title="Loading" footer="Leave empty to use the equipment's step.">
        <ListItem>
          <NumberField label="Weight step" value={step} min={0.1} optional suffix={settings.unit} placeholder={defaultStep ? `Default (${defaultStep} ${settings.unit})` : undefined} onChange={setStep} />
        </ListItem>
      </ListGroup>
      <div className={styles.actions}>
        <Button variant="primary" block onClick={() => void save()}>Save</Button>
      </div>
    </div>
  );
}

export const createExerciseView = (): SheetView => ({ id: "new-exercise", title: "New exercise", render: () => <CreateExerciseView /> });
