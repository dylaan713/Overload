import type { Equipment, LiftClass, LoadKind, Muscle } from "../types";

export interface LibraryExercise {
  id: string; // stable slug "<movement-slug>.<equipment>"; never reused
  movement: string;
  variant?: string;
  equipment: Equipment;
  name: string;
  aliases: string[];
  primary: Muscle[]; // 1 set each toward weekly volume
  secondary: Muscle[]; // 0.5 set each
  class: LiftClass; // hidden from the user for library entries
  loadKind: LoadKind;
}

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: "barbell", dumbbell: "dumbbell", machine: "machine", cable: "cable", smith: "Smith machine",
  "ez-bar": "EZ bar", "trap-bar": "trap bar", kettlebell: "kettlebell", bodyweight: "bodyweight", band: "band", plate: "plate",
};

// Shorthand people type when searching.
const EQUIPMENT_ALIAS: Partial<Record<Equipment, string>> = { dumbbell: "db", barbell: "bb", "ez-bar": "ez", smith: "smith" };

/** One equipment option of a movement: the equipment, or [equipment, overrides]. */
type Option = Equipment | [Equipment, { aliases?: string[]; assisted?: boolean }];

function move(
  slug: string, movement: string, cls: LiftClass, primary: Muscle[], secondary: Muscle[],
  options: Option[], aliases: string[] = [],
): LibraryExercise[] {
  return options.map((o) => {
    const [equipment, extra] = typeof o === "string" ? [o, {}] : o;
    const shorthand = EQUIPMENT_ALIAS[equipment];
    return {
      id: `${slug}.${equipment}`,
      movement,
      equipment,
      name: `${movement} (${extra.assisted ? "assisted" : EQUIPMENT_LABEL[equipment]})`,
      aliases: [...aliases, ...(extra.aliases ?? []), ...(shorthand ? [`${shorthand} ${movement.toLowerCase()}`] : [])],
      primary,
      secondary,
      class: cls,
      loadKind: extra.assisted ? "assisted" : equipment === "bodyweight" ? "bodyweight" : "external",
    };
  });
}

const assisted: Option = ["machine", { assisted: true, aliases: ["assisted"] }];

export const LIBRARY: readonly LibraryExercise[] = [
  // Chest
  ...move("bench-press", "Bench press", "compound", ["chest"], ["front-delts", "triceps"],
    ["barbell", ["dumbbell", { aliases: ["db bench", "flat db press"] }], ["machine", { aliases: ["chest press"] }], "smith"], ["flat bench"]),
  ...move("incline-bench-press", "Incline bench press", "compound", ["chest"], ["front-delts", "triceps"],
    ["barbell", ["dumbbell", { aliases: ["incline db press"] }], ["machine", { aliases: ["incline chest press"] }], "smith"], ["incline press"]),
  ...move("decline-bench-press", "Decline bench press", "compound", ["chest"], ["triceps", "front-delts"], ["barbell", "dumbbell", "machine"], ["decline press"]),
  ...move("chest-fly", "Chest fly", "isolation", ["chest"], ["front-delts"], ["dumbbell", "cable", ["machine", { aliases: ["pec deck"] }]], ["flye"]),
  ...move("incline-fly", "Incline fly", "isolation", ["chest"], ["front-delts"], ["dumbbell"], ["incline flye"]),
  ...move("cable-crossover-high", "High-to-low cable crossover", "isolation", ["chest"], [], ["cable"], ["crossover", "cable fly"]),
  ...move("cable-crossover-low", "Low-to-high cable crossover", "isolation", ["chest"], ["front-delts"], ["cable"], ["crossover", "cable fly"]),
  ...move("dip", "Dip", "compound", ["chest", "triceps"], ["front-delts"], [["bodyweight", { aliases: ["weighted dip"] }], assisted], ["chest dip"]),
  ...move("push-up", "Push-up", "compound", ["chest"], ["triceps", "front-delts"], [["bodyweight", { aliases: ["weighted push-up"] }]], ["pushup", "press-up"]),

  // Back
  ...move("deadlift", "Deadlift", "compound", ["glutes", "hamstrings", "lower-back"], ["quads", "traps", "upper-back", "forearms"],
    ["barbell", ["trap-bar", { aliases: ["hex bar deadlift"] }]], ["conventional deadlift"]),
  ...move("sumo-deadlift", "Sumo deadlift", "compound", ["glutes", "hamstrings", "adductors"], ["quads", "lower-back", "traps"], ["barbell"]),
  ...move("romanian-deadlift", "Romanian deadlift", "compound", ["hamstrings", "glutes"], ["lower-back"], ["barbell", "dumbbell"], ["rdl", "stiff-leg deadlift"]),
  ...move("single-leg-romanian-deadlift", "Single-leg Romanian deadlift", "compound", ["hamstrings", "glutes"], ["lower-back"], ["dumbbell"], ["single-leg rdl"]),
  ...move("rack-pull", "Rack pull", "compound", ["glutes", "lower-back", "traps"], ["hamstrings", "upper-back", "forearms"], ["barbell"]),
  ...move("row", "Row", "compound", ["lats", "upper-back"], ["rear-delts", "biceps", "lower-back"], [["barbell", { aliases: ["bent-over row"] }], ["machine", { aliases: ["machine row"] }]]),
  ...move("pendlay-row", "Pendlay row", "compound", ["lats", "upper-back"], ["rear-delts", "biceps", "lower-back"], ["barbell"]),
  ...move("seal-row", "Seal row", "compound", ["lats", "upper-back"], ["rear-delts", "biceps"], ["barbell"]),
  ...move("single-arm-row", "Single-arm row", "compound", ["lats", "upper-back"], ["rear-delts", "biceps"], ["dumbbell"], ["one-arm row", "db row"]),
  ...move("chest-supported-row", "Chest-supported row", "compound", ["lats", "upper-back"], ["rear-delts", "biceps"], ["dumbbell"], ["incline row"]),
  ...move("t-bar-row", "T-bar row", "compound", ["lats", "upper-back"], ["rear-delts", "biceps", "lower-back"], ["barbell"], ["landmine row"]),
  ...move("seated-cable-row", "Seated cable row", "compound", ["lats", "upper-back"], ["rear-delts", "biceps"], ["cable"], ["cable row"]),
  ...move("inverted-row", "Inverted row", "compound", ["upper-back", "lats"], ["rear-delts", "biceps"], ["bodyweight"], ["bodyweight row"]),
  ...move("pull-up", "Pull-up", "compound", ["lats"], ["biceps", "upper-back"], [["bodyweight", { aliases: ["weighted pull-up"] }], assisted], ["pullup"]),
  ...move("chin-up", "Chin-up", "compound", ["lats", "biceps"], ["upper-back"], [["bodyweight", { aliases: ["weighted chin-up"] }], assisted], ["chinup"]),
  ...move("lat-pulldown", "Lat pulldown", "compound", ["lats"], ["biceps", "upper-back"], [["cable", { aliases: ["wide-grip pulldown"] }], "machine"], ["pulldown"]),
  ...move("lat-pulldown-close", "Close-grip lat pulldown", "compound", ["lats"], ["biceps", "upper-back"], ["cable"], ["neutral-grip pulldown", "pulldown"]),
  ...move("single-arm-lat-pulldown", "Single-arm lat pulldown", "compound", ["lats"], ["biceps"], ["cable"], ["pulldown"]),
  ...move("straight-arm-pulldown", "Straight-arm pulldown", "isolation", ["lats"], [], ["cable"], ["lat pushdown"]),
  ...move("pullover", "Pullover", "isolation", ["lats"], ["chest"], ["dumbbell", "cable"]),
  ...move("shrug", "Shrug", "isolation", ["traps"], [], ["barbell", "dumbbell", "machine", "trap-bar"]),
  ...move("back-extension", "Back extension", "isolation", ["lower-back"], ["glutes", "hamstrings"], [["bodyweight", { aliases: ["weighted back extension"] }]], ["hyperextension"]),

  // Shoulders
  ...move("overhead-press", "Overhead press", "compound", ["front-delts"], ["triceps", "side-delts"],
    [["barbell", { aliases: ["military press", "standing press"] }], ["dumbbell", { aliases: ["seated db press"] }], "machine", "smith"], ["ohp", "shoulder press"]),
  ...move("arnold-press", "Arnold press", "compound", ["front-delts"], ["side-delts", "triceps"], ["dumbbell"]),
  ...move("lateral-raise", "Lateral raise", "isolation", ["side-delts"], [], ["dumbbell", "cable", "machine"], ["side raise", "lat raise"]),
  ...move("rear-delt-fly", "Rear-delt fly", "isolation", ["rear-delts"], ["upper-back"], ["dumbbell", ["machine", { aliases: ["reverse pec deck"] }], "cable"], ["reverse fly"]),
  ...move("face-pull", "Face pull", "isolation", ["rear-delts"], ["upper-back", "traps"], ["cable", "band"]),
  ...move("band-pull-apart", "Band pull-apart", "isolation", ["rear-delts"], ["upper-back"], ["band"]),
  ...move("front-raise", "Front raise", "isolation", ["front-delts"], [], ["dumbbell", "cable", "plate"]),
  ...move("upright-row", "Upright row", "compound", ["side-delts"], ["traps", "front-delts"], ["barbell", "ez-bar", "cable"]),

  // Biceps
  ...move("curl", "Curl", "isolation", ["biceps"], ["forearms"], ["barbell", "ez-bar", "dumbbell", "cable", "machine"], ["biceps curl"]),
  ...move("hammer-curl", "Hammer curl", "isolation", ["biceps"], ["forearms"], ["dumbbell", ["cable", { aliases: ["rope hammer curl"] }]]),
  ...move("preacher-curl", "Preacher curl", "isolation", ["biceps"], [], ["ez-bar", "dumbbell", "machine"]),
  ...move("incline-curl", "Incline curl", "isolation", ["biceps"], [], ["dumbbell"], ["incline dumbbell curl"]),
  ...move("concentration-curl", "Concentration curl", "isolation", ["biceps"], [], ["dumbbell"]),
  ...move("spider-curl", "Spider curl", "isolation", ["biceps"], [], ["dumbbell"]),
  ...move("bayesian-curl", "Bayesian curl", "isolation", ["biceps"], [], ["cable"], ["behind-the-body curl"]),
  ...move("reverse-curl", "Reverse curl", "isolation", ["biceps"], ["forearms"], ["ez-bar", "barbell"]),

  // Triceps
  ...move("pushdown", "Triceps pushdown", "isolation", ["triceps"], [], ["cable", "band"], ["bar pushdown"]),
  ...move("rope-pushdown", "Rope pushdown", "isolation", ["triceps"], [], ["cable"], ["triceps pushdown"]),
  ...move("single-arm-pushdown", "Single-arm pushdown", "isolation", ["triceps"], [], ["cable"], ["triceps pushdown"]),
  ...move("overhead-extension", "Overhead triceps extension", "isolation", ["triceps"], [], ["cable", "dumbbell", "ez-bar"], ["french press"]),
  ...move("skull-crusher", "Skull crusher", "isolation", ["triceps"], [], ["ez-bar", "barbell", "dumbbell"], ["lying triceps extension"]),
  ...move("close-grip-bench-press", "Close-grip bench press", "compound", ["triceps", "chest"], ["front-delts"], ["barbell", "smith"], ["cgbp"]),
  ...move("triceps-dip", "Triceps dip", "compound", ["triceps"], ["chest", "front-delts"], ["machine"], ["dip machine"]),
  ...move("kickback", "Kickback", "isolation", ["triceps"], [], ["dumbbell", "cable"], ["triceps kickback"]),
  ...move("jm-press", "JM press", "compound", ["triceps"], ["chest"], ["barbell"]),

  // Forearms
  ...move("wrist-curl", "Wrist curl", "isolation", ["forearms"], [], ["barbell", "dumbbell"]),
  ...move("reverse-wrist-curl", "Reverse wrist curl", "isolation", ["forearms"], [], ["barbell", "dumbbell"], ["wrist extension"]),
  ...move("farmers-carry", "Farmer's carry", "compound", ["forearms", "traps"], ["abs"], ["dumbbell"], ["farmers walk"]),

  // Legs
  ...move("squat", "Back squat", "compound", ["quads", "glutes"], ["adductors", "lower-back"], ["barbell", "smith"], ["squat"]),
  ...move("front-squat", "Front squat", "compound", ["quads"], ["glutes", "upper-back"], ["barbell"], ["squat"]),
  ...move("safety-bar-squat", "Safety bar squat", "compound", ["quads", "glutes"], ["upper-back", "lower-back"], ["barbell"], ["ssb squat", "squat"]),
  ...move("belt-squat", "Belt squat", "compound", ["quads", "glutes"], ["adductors"], ["machine"], ["squat"]),
  ...move("hack-squat", "Hack squat", "compound", ["quads"], ["glutes"], ["machine"], ["squat"]),
  ...move("pendulum-squat", "Pendulum squat", "compound", ["quads"], ["glutes"], ["machine"], ["squat"]),
  ...move("goblet-squat", "Goblet squat", "compound", ["quads", "glutes"], ["adductors"], ["dumbbell", "kettlebell"], ["squat"]),
  ...move("leg-press", "Leg press", "compound", ["quads", "glutes"], ["adductors"], ["machine"]),
  ...move("bulgarian-split-squat", "Bulgarian split squat", "compound", ["quads", "glutes"], ["adductors"], ["dumbbell", "barbell", "smith"], ["bss", "split squat"]),
  ...move("walking-lunge", "Walking lunge", "compound", ["quads", "glutes"], ["adductors"], ["dumbbell", "barbell"], ["lunge"]),
  ...move("reverse-lunge", "Reverse lunge", "compound", ["quads", "glutes"], ["adductors"], ["dumbbell"], ["lunge"]),
  ...move("step-up", "Step-up", "compound", ["quads", "glutes"], [], ["dumbbell", "barbell"]),
  ...move("leg-extension", "Leg extension", "isolation", ["quads"], [], ["machine"], ["quad extension"]),
  ...move("lying-leg-curl", "Lying leg curl", "isolation", ["hamstrings"], [], ["machine"], ["hamstring curl"]),
  ...move("seated-leg-curl", "Seated leg curl", "isolation", ["hamstrings"], [], ["machine"], ["hamstring curl"]),
  ...move("standing-leg-curl", "Standing leg curl", "isolation", ["hamstrings"], [], ["machine"], ["hamstring curl"]),
  ...move("hip-thrust", "Hip thrust", "compound", ["glutes"], ["hamstrings"], ["barbell", "machine", "smith"]),
  ...move("glute-bridge", "Glute bridge", "compound", ["glutes"], ["hamstrings"], ["barbell", "bodyweight"]),
  ...move("good-morning", "Good morning", "compound", ["hamstrings", "lower-back"], ["glutes"], ["barbell"]),
  ...move("kettlebell-swing", "Kettlebell swing", "compound", ["glutes", "hamstrings"], ["lower-back"], ["kettlebell"], ["kb swing"]),
  ...move("nordic-curl", "Nordic curl", "isolation", ["hamstrings"], [], ["bodyweight"], ["nordic hamstring curl"]),
  ...move("hip-adduction", "Hip adduction", "isolation", ["adductors"], [], ["machine"], ["adductor machine"]),
  ...move("hip-abduction", "Hip abduction", "isolation", ["abductors"], ["glutes"], ["machine"], ["abductor machine"]),
  ...move("standing-calf-raise", "Standing calf raise", "isolation", ["calves"], [], ["machine", "smith"], ["calf raise"]),
  ...move("seated-calf-raise", "Seated calf raise", "isolation", ["calves"], [], ["machine"], ["calf raise"]),
  ...move("leg-press-calf-raise", "Leg press calf raise", "isolation", ["calves"], [], ["machine"], ["calf raise", "calf press"]),
  ...move("single-leg-calf-raise", "Single-leg calf raise", "isolation", ["calves"], [], ["dumbbell"], ["calf raise"]),

  // Core
  ...move("crunch", "Crunch", "isolation", ["abs"], [], ["cable", "machine"], ["ab crunch"]),
  ...move("hanging-leg-raise", "Hanging leg raise", "isolation", ["abs"], ["obliques"], ["bodyweight"], ["leg raise"]),
  ...move("ab-wheel", "Ab wheel rollout", "isolation", ["abs"], ["obliques"], ["bodyweight"], ["rollout"]),
  ...move("plank", "Plank", "isolation", ["abs"], ["obliques"], ["bodyweight"]),
  ...move("pallof-press", "Pallof press", "isolation", ["obliques"], ["abs"], ["cable"], ["anti-rotation press"]),
  ...move("decline-sit-up", "Decline sit-up", "isolation", ["abs"], [], ["bodyweight"], ["sit-up"]),
  ...move("side-bend", "Side bend", "isolation", ["obliques"], [], ["dumbbell"]),
];
