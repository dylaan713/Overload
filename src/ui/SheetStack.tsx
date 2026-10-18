import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotionConfig, useTransform, type AnimationPlaybackControlsWithThen } from "motion/react";
import { FLICK, commitOnRelease } from "./gesture";
import { FADE, SPRING } from "./motion";
import { Sheet } from "./Sheet";
import { useAxisDrag } from "./useAxisDrag";
import styles from "./SheetStack.module.css";

export interface SheetNav {
  push(view: SheetView): void;
  pop(): void;
  popToRoot(): void;
  depth: number;
}

export interface SheetView {
  id: string;
  title: string;
  render(nav: SheetNav): ReactNode;
  headerAction?: ReactNode;
}

const NavContext = createContext<SheetNav | null>(null);

export function useSheetNav(): SheetNav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("useSheetNav must be used inside a SheetStack");
  return nav;
}

const EDGE = 20; // px from the left edge where a swipe-back can start
const PARALLAX = 0.3; // the parent sits 30% to the left under a pushed view

/**
 * A navigation stack inside one Sheet (iOS push/pop). Pushed views enter from the right and pop back to the
 * right; the parent shifts left and dims in step. One motion value `x` (the top view's offset) drives both,
 * so an edge swipe moves them together and can be released either way. Views stay mounted while in the
 * stack, so a parent keeps its state (e.g. a search query) when you come back to it.
 */
export function SheetStack({ root, onClose }: { root: SheetView; onClose: () => void }) {
  const reduced = useReducedMotionConfig() ?? false;
  const [views, setViews] = useState<SheetView[]>([root]);
  const box = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const fade = useMotionValue(1);
  const anim = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const pending = useRef(0); // token of a pop in flight
  const tokens = useRef(0);
  const lastLength = useRef(1);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const openers = useRef<(HTMLElement | null)[]>([]); // openers[i] pushed view i + 1

  const width = () => box.current?.offsetWidth || window.innerWidth;
  const parentX = useTransform(() => -PARALLAX * (width() - x.get()));
  const dim = useTransform(() => 0.18 * (1 - Math.min(1, x.get() / width())));

  // A push renders the new view off to the right first, then springs it in (before paint: no flash).
  useLayoutEffect(() => {
    const grew = views.length > lastLength.current;
    lastLength.current = views.length;
    const top = views.length - 1;
    if (!grew) {
      x.set(0);
      fade.set(1);
      // Back where we came from: focus returns to the control that opened the view we left.
      const opener = openers.current[top];
      if (opener?.isConnected) opener.focus();
      else sections.current[top]?.focus();
      return;
    }
    sections.current[top]?.focus(); // the new view takes focus; its parent is now inert
    anim.current?.stop();
    if (reduced) {
      fade.set(0);
      anim.current = animate(fade, 1, FADE);
    } else {
      x.set(width());
      anim.current = animate(x, 0, SPRING.default);
    }
  }, [views, reduced, x, fade]);

  const nav = useMemo<SheetNav>(() => {
    // Animate the top view out to the right, then drop views down to `keep`.
    function leave(keep: number, velocity = 0) {
      const token = (pending.current = ++tokens.current);
      anim.current?.stop();
      anim.current = reduced
        ? animate(fade, 0, FADE)
        : animate(x, width(), { ...(Math.abs(velocity) > FLICK ? SPRING.momentum : SPRING.default), velocity });
      anim.current.then(() => {
        if (pending.current !== token) return;
        pending.current = 0;
        setViews((v) => v.slice(0, keep));
      });
    }
    return {
      depth: views.length,
      push(view) {
        pending.current = 0; // a push cancels a pop in flight
        openers.current[views.length - 1] = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setViews((v) => [...v, view]);
      },
      pop() {
        if (views.length > 1) leave(views.length - 1);
      },
      popToRoot() {
        if (views.length > 1) leave(1);
      },
    };
    // `leave` reads the latest views via the setter; depth is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views.length, reduced]);

  const swipe = useAxisDrag({
    axis: "x",
    value: x,
    canStart: (e) => views.length > 1 && e.clientX - (box.current?.getBoundingClientRect().left ?? 0) < EDGE,
    onStart() {
      anim.current?.stop();
      pending.current = 0;
    },
    map: (raw) => Math.max(0, raw),
    onRelease(raw, velocity) {
      if (commitOnRelease(raw, velocity, width())) {
        const token = (pending.current = ++tokens.current);
        // Reduced motion: the view tracked the finger; it fades out from there instead of being thrown.
        anim.current = reduced
          ? animate(fade, 0, FADE)
          : animate(x, width(), { ...(Math.abs(velocity) > FLICK ? SPRING.momentum : SPRING.default), velocity });
        anim.current.then(() => {
          if (pending.current === token) setViews((v) => v.slice(0, -1));
        });
      } else {
        anim.current = animate(x, 0, reduced ? FADE : { ...SPRING.default, velocity });
      }
    },
  });

  const top = views.length - 1;
  const current = views[top]!;
  // The provider wraps the whole sheet so header actions (e.g. "Add exercise") can navigate too.
  return (
    <NavContext.Provider value={nav}>
      <Sheet
        title={current.title}
        onClose={onClose}
        onBack={top > 0 ? nav.pop : undefined}
        backLabel={top > 0 ? views[top - 1]!.title : undefined}
        headerAction={current.headerAction}
      >
        <div ref={box} className={styles.stack} {...swipe}>
          {views.map((v, i) => {
            const isTop = i === top;
            const isParent = i === top - 1;
            return (
              <motion.section
                key={v.id + ":" + i}
                ref={(el: HTMLElement | null) => {
                  sections.current[i] = el;
                }}
                tabIndex={-1}
                aria-label={v.title}
                className={styles.view}
                hidden={!isTop && !isParent}
                inert={!isTop}
                aria-hidden={!isTop || undefined}
                style={isTop ? { x, opacity: reduced ? fade : 1 } : isParent ? { x: reduced ? 0 : parentX } : undefined}
              >
                {v.render(nav)}
                {isParent && !reduced && <motion.div className={styles.dim} style={{ opacity: dim }} />}
              </motion.section>
            );
          })}
        </div>
      </Sheet>
    </NavContext.Provider>
  );
}
