import { useEffect, useRef } from "react";

/** Progressive enhancement: server-rendered content is always visible. */
export function useEntranceMotion(active: boolean, contentReady: boolean) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (
      !element || !active ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.IntersectionObserver || !Element.prototype.animate
    ) return;

    element.setAttribute("data-motion-ready", "");
    const targets = [...element.querySelectorAll<HTMLElement>("[data-entrance]")];
    const animations = new Map<HTMLElement, Animation>();
    const show = (target: HTMLElement) => {
      target.removeAttribute("data-entrance-waiting");
      if (target.dataset.entranceDone) return;
      target.dataset.entranceDone = "true";
      const hero = target.dataset.entrance === "hero";
      const animation = target.animate(
        [
          { opacity: 0, transform: `translate3d(0, ${hero ? 70 : 32}px, 0)` },
          { opacity: 1, transform: "translate3d(0, 0, 0)" },
        ],
        {
          duration: hero ? 1050 : 800,
          delay: Number(target.dataset.delay || 0),
          easing: "cubic-bezier(.16, 1, .3, 1)",
          fill: "backwards",
        },
      );
      animations.set(target, animation);
      animation.onfinish = () => animations.delete(target);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        show(target as HTMLElement);
        observer.unobserve(target);
      });
    }, { threshold: 0, rootMargin: "0px 0px -5% 0px" });

    // Measure together before writing visibility, and never hide content above
    // the viewport on a restored scroll position or a client navigation.
    const positions = targets.map((target) => ({ target, top: target.getBoundingClientRect().top }));
    positions.forEach(({ target, top }) => {
      if (target.dataset.entranceDone) return;
      if (top < 0) target.dataset.entranceDone = "true";
      else if (top < window.innerHeight * 0.95) show(target);
      else {
        target.setAttribute("data-entrance-waiting", "");
        observer.observe(target);
      }
    });

    const revealFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>("[data-entrance]");
      if (!target) return;
      target.removeAttribute("data-entrance-waiting");
      target.dataset.entranceDone = "true";
      animations.get(target)?.cancel();
      observer.unobserve(target);
    };
    element.addEventListener("focusin", revealFocus);
    return () => {
      observer.disconnect();
      element.removeEventListener("focusin", revealFocus);
      animations.forEach((animation) => animation.cancel());
      targets.forEach((target) => target.removeAttribute("data-entrance-waiting"));
      element.removeAttribute("data-motion-ready");
    };
  }, [active, contentReady]);

  return root;
}
