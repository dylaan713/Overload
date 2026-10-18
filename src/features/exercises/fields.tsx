import { capitalize } from "../../app/format";
import { equipmentLabel } from "../../domain/library";
import { MUSCLE_LABEL } from "../../domain/library/muscles";
import { EQUIPMENT, MUSCLES, type Equipment, type Muscle } from "../../domain/types";
import { ChipGroup } from "../../ui/ChipGroup";
import { Field, Select } from "../../ui/Field";

// Pieces shared by "New exercise" and the exercise detail view.

export const muscleOptions = (disabled: Muscle[] = []) =>
  MUSCLES.map((m) => ({ value: m, label: MUSCLE_LABEL[m], disabled: disabled.includes(m) }));

export function MuscleFields({ primary, secondary, onPrimary, onSecondary, error }: {
  primary: Muscle[];
  secondary: Muscle[];
  onPrimary: (m: Muscle[]) => void;
  onSecondary: (m: Muscle[]) => void;
  error?: string | null;
}) {
  return (
    <>
      <ChipGroup label="Muscles worked" options={muscleOptions()} value={primary} onChange={onPrimary} error={error} />
      <ChipGroup label="Also works" options={muscleOptions(primary)} value={secondary.filter((m) => !primary.includes(m))} onChange={onSecondary} />
    </>
  );
}

export function EquipmentSelect({ value, onChange, error }: { value: Equipment | ""; onChange: (e: Equipment) => void; error?: string | null }) {
  return (
    <Field label="Equipment" htmlFor="equipment" error={error}>
      <Select id="equipment" value={value} onChange={(e) => onChange(e.target.value as Equipment)}>
        {value === "" && <option value="">Choose equipment</option>}
        {EQUIPMENT.map((e) => (
          <option key={e} value={e}>{capitalize(equipmentLabel(e))}</option>
        ))}
      </Select>
    </Field>
  );
}
