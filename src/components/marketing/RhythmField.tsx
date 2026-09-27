import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { rhythmPath, rhythmX } from "@/lib/rhythmField";
import { onScrollFrame } from "@/lib/scrollFrame";

// A server-rendered, motion-free fallback remains available without canvas or JavaScript.
const fallbackPaths = Array.from({ length: 220 }, (_, i) => rhythmPath(-.15 + i / 219 * 1.3));

export function RhythmField({ active }: { active: boolean }) {
  const lightweight = useMediaQuery("(max-width: 1023px), (pointer: coarse)");
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);
  const position = useRef({ pointer: 0, scroll: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = host.current;
    const surface = canvas.current;
    if (!element || !surface) return;
    // Keep the line artwork, but leave the phone GPU/CPU free for the film.
    if (lightweight || window.matchMedia("(max-width: 1023px), (pointer: coarse)").matches) { setReady(false); return; }
    const context = surface.getContext("2d", { alpha: true });
    if (!context) return;
    let width = 0, height = 0, frame = 0, last = 0;
    let visible = true, painted = false;
    let pointer = position.current.pointer, pointerTarget = pointer, scroll = position.current.scroll;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const canAnimate = () => active && !reduced.matches && visible && !document.hidden;

    const draw = () => {
      if (!width || !height) return;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = "#080e16";
      context.lineWidth = width < 600 ? .65 : .7;
      const count = Math.min(1300, Math.max(160, Math.round(width / 3.8)));
      const steps = width < 600 ? 36 : 48;
      context.beginPath();
      for (let line = 0; line < count; line++) {
        const u = -.15 + line / (count - 1) * 1.3;
        for (let point = 0; point <= steps; point++) {
          const v = point / steps;
          const x = rhythmX(u, v, phase.current, pointer, scroll) * width;
          if (point === 0) context.moveTo(x, 0);
          else context.lineTo(x, v * height);
        }
      }
      context.stroke();
      position.current = { pointer, scroll };
      if (!painted) { setReady(true); painted = true; }
    };
    const tick = (now: number) => {
      frame = 0;
      if (!canAnimate()) return;
      if (now - last >= 1000 / 30) {
        phase.current += Math.min(now - last, 60) / 1000;
        pointer += (pointerTarget - pointer) * .09;
        last = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      cancelAnimationFrame(frame); frame = 0; last = performance.now();
      if (canAnimate()) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const bounds = element.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element); resize();
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); });
    visibility.observe(element);
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const bounds = element.getBoundingClientRect();
      pointerTarget = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    };
    const leave = () => { pointerTarget = 0; };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", resume);
    reduced.addEventListener("change", resume);
    const unsubscribe = onScrollFrame(() => {
      const bounds = element.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -bounds.top / Math.max(bounds.height, 1)));
      return () => { if (canAnimate()) scroll = progress * 2; };
    });
    resume();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); visibility.disconnect(); unsubscribe();
      element.removeEventListener("pointermove", move); element.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", resume); reduced.removeEventListener("change", resume);
    };
  }, [active, lightweight]);

  return <div ref={host} className="tde-rhythm-field" aria-hidden="true" data-renderer={ready ? "canvas" : "svg"}>
    <svg viewBox="0 0 1440 480" preserveAspectRatio="none" className="tde-rhythm-fallback" style={{ visibility: ready ? "hidden" : "visible" }}>
      <g fill="none" stroke="currentColor" strokeWidth=".7">{fallbackPaths.map((d, i) => <path d={d} key={i} />)}</g>
    </svg>
    <canvas ref={canvas} />
  </div>;
}
