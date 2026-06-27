import { useEffect, useRef } from "react";

/**
 * Scroll parallax — translates the element vertically as the page scrolls.
 * Disabled under prefers-reduced-motion. Use on a background layer that has
 * extra height (e.g. h-[120%]) so the movement never reveals an edge.
 */
export function useParallax<T extends HTMLElement = HTMLElement>(speed = 0.25) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const parent = el.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        // Only animate while the section is anywhere near the viewport.
        if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
        const offset = (window.innerHeight - rect.top) * speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [speed]);

  return ref;
}

export default useParallax;
