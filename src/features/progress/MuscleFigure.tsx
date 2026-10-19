import { Fragment, type KeyboardEvent } from "react";
import { MUSCLES, type Muscle } from "../../domain/types";
import { BACK, FRONT, VIEW_H, VIEW_W, type Plate } from "./figurePaths";
import styles from "./Progress.module.css";

export type Tone = "none" | "l1" | "l2" | "l3" | "over" | "down" | "flat";

// Small plates get an invisible wide stroke so a fingertip still lands on them.
const SMALL = new Set<Muscle>(["rear-delts", "side-delts", "forearms", "calves", "front-delts", "abductors", "traps"]);
const HIT_STROKE = 10;
const MIRROR = `translate(${VIEW_W},0) scale(-1,1)`;

/** One view's plates for a muscle, both halves (center plates once). */
function shapes(plates: Plate[], fill: string, hit: boolean) {
  return plates.flatMap((p, i) => {
    const halves = p.center ? [undefined] : [undefined, MIRROR];
    return halves.map((transform, h) => (
      <Fragment key={`${i}-${h}`}>
        {hit && <polygon data-hit points={p.points} transform={transform} fill="transparent" stroke="transparent" strokeWidth={HIT_STROKE} />}
        <polygon points={p.points} transform={transform} fill={fill} className={styles.plate} />
      </Fragment>
    ));
  });
}

/**
 * The front and back figure. Each muscle is one control (named for VoiceOver, Enter/Space to pick); where it shows
 * on both views, the back copy is a pointer target only, so the muscle isn't announced twice.
 */
export function MuscleFigure({ tones, labels, selected, onSelect }: {
  tones: Record<Muscle, Tone>;
  labels: Record<Muscle, string>;
  selected: Muscle | null;
  onSelect(m: Muscle): void;
}) {
  const onFront = new Set(FRONT.map((p) => p.muscle));
  const view = (plates: Plate[], name: string, front: boolean) => (
    <figure className={styles.view}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.svg} role="group" aria-label={name}>
        {shapes(plates.filter((p) => p.muscle === null), "var(--map-base)", false)}
        {MUSCLES.map((m) => {
          const mine = plates.filter((p) => p.muscle === m);
          if (mine.length === 0) return null;
          const primary = front || !onFront.has(m);
          const pick = () => onSelect(m);
          const key = (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick();
            }
          };
          return (
            <g
              key={m}
              data-muscle={m}
              className={styles.muscle}
              data-selected={selected === m || undefined}
              onClick={pick}
              {...(primary
                ? { role: "button", tabIndex: 0, "aria-label": labels[m], "aria-pressed": selected === m, onKeyDown: key }
                : { "aria-hidden": true })}
            >
              {shapes(mine, `var(--map-${tones[m]})`, SMALL.has(m))}
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.caption}>{name}</figcaption>
    </figure>
  );
  return (
    <div className={styles.figure}>
      {view(FRONT, "Front", true)}
      {view(BACK, "Back", false)}
    </div>
  );
}
