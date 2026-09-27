import { useEffect, type RefObject } from "react";

/** Exact critically damped spring step: stable across frame rates, with
 * continuous velocity when the pointer changes direction mid-transition. */
export function stepCoachSpring(position: number, velocity: number, target: number, seconds: number) {
  const frequency = 18;
  const offset = position - target;
  const impulse = velocity + frequency * offset;
  const decay = Math.exp(-frequency * seconds);
  return {
    position: target + (offset + impulse * seconds) * decay,
    velocity: (velocity - frequency * impulse * seconds) * decay,
  };
}

export function useCoachHoverMotion(ref: RefObject<HTMLButtonElement>) {
  useEffect(() => {
    const card = ref.current;
    if (!card) return;
    const preference = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    let previous = 0;
    let position = 0;
    let velocity = 0;
    let target = 0;
    const paint = () => card.style.setProperty("--coach-hover", String(Math.max(0, Math.min(1, position))));
    const tick = (time: number) => {
      frame = 0;
      const seconds = previous ? Math.min((time - previous) / 1000, 0.05) : 1 / 60;
      previous = time;
      ({ position, velocity } = stepCoachSpring(position, velocity, target, seconds));
      if (Math.abs(position - target) < 0.001 && Math.abs(velocity) < 0.008) {
        position = target;
        velocity = 0;
        previous = 0;
      } else frame = requestAnimationFrame(tick);
      paint();
    };
    const moveTo = (next: number) => {
      if (!preference.matches) return;
      target = next;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const enter = (event: PointerEvent) => { if (event.pointerType === "mouse") moveTo(1); };
    const leave = () => moveTo(0);
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = previous = position = velocity = target = 0;
      paint();
    };
    const configure = () => {
      reset();
      if (preference.matches) card.dataset.coachMotion = "spring";
      else delete card.dataset.coachMotion;
    };
    const visibility = () => { if (document.hidden) reset(); };
    configure();
    preference.addEventListener("change", configure);
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    card.addEventListener("pointercancel", leave);
    window.addEventListener("blur", leave);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      reset();
      delete card.dataset.coachMotion;
      card.style.removeProperty("--coach-hover");
      preference.removeEventListener("change", configure);
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointerleave", leave);
      card.removeEventListener("pointercancel", leave);
      window.removeEventListener("blur", leave);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [ref]);
}
