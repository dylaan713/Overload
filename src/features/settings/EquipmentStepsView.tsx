import { capitalize } from "../../app/format";
import { equipmentLabel } from "../../domain/library";
import { EQUIPMENT } from "../../domain/types";
import { useApp } from "../../state/context";
import { ListGroup, ListItem } from "../../ui/ListRow";
import { NumberField } from "../../ui/NumberField";
import styles from "./Settings.module.css";

/** The smallest jump each kind of equipment allows in this gym. Bands are reps-only, so they aren't listed. */
export function EquipmentStepsView() {
  const steps = useApp((s) => s.doc.settings.equipmentSteps);
  const unit = useApp((s) => s.doc.settings.unit);
  const updateSettings = useApp((s) => s.updateSettings);
  return (
    <div className={styles.view}>
      <ListGroup title="Smallest jump" footer="Suggested weights always land on these steps. Each exercise can override its own.">
        <ListItem>
          {EQUIPMENT.filter((e) => e !== "band").map((e) => (
            <NumberField
              key={e}
              label={`${capitalize(equipmentLabel(e))} (${unit})`}
              value={steps[e]}
              min={0.1}
              onChange={(v) => updateSettings((s) => ({ ...s, equipmentSteps: { ...s.equipmentSteps, [e]: v! } }))}
            />
          ))}
        </ListItem>
      </ListGroup>
    </div>
  );
}

export const equipmentStepsView = () => ({ id: "equipment-steps", title: "Equipment steps", render: () => <EquipmentStepsView /> });
