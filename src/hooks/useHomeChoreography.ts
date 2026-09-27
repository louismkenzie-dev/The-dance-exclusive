import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

/** Homepage-only choreography. All styles revert on pause, route change or reduced motion. */
export function useHomeChoreography(active: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  useEffect(() => {
    const element = root.current;
    if (!element || !active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let disposed = false;
    const lenis = new Lenis({
      lerp: .085,
      smoothWheel: true,
      syncTouch: false,
      prevent: node => Boolean(node.closest('[role="dialog"], [data-lenis-prevent], input, textarea, select') || document.querySelector('[role="dialog"]')),
    });
    const tick = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    const context = gsap.context(() => {
      if (!entered.current && window.scrollY < 100) {
        entered.current = true;
        const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
        intro.from(".tde-rhythm-art", { clipPath: "inset(100% 0 0 0)", duration: 1.25 }, 0)
          .from(".tde-rhythm-field", { scaleY: 1.35, transformOrigin: "bottom", duration: 1.6 }, .05)
          .from(".tde-rhythm-letter-inner", { yPercent: 115, duration: 1.05, stagger: .025 }, .15)
          .from(".tde-rhythm-title > svg", { rotation: -90, duration: 1.5 }, .3)
          .from(".tde-rhythm-actions", { opacity: 0, duration: .5 }, .4);
      }
      gsap.to(".tde-rhythm-title > svg", { rotation: 180, ease: "none", scrollTrigger: { trigger: ".tde-rhythm-hero", start: "top top", end: "bottom top", scrub: .8 } });
      gsap.to(".tde-rhythm-strip", { "--ticker-shift": "-160px", ease: "none", scrollTrigger: { trigger: ".tde-rhythm-hero", start: "top top", end: "bottom top", scrub: .7 } });
      gsap.to(".tde-rhythm-underlay .tde-media-layer", { scale: 1.15, ease: "none", scrollTrigger: { trigger: ".tde-rhythm-hero", start: "top top", end: "bottom top", scrub: .8 } });
      gsap.fromTo(".tde-intro-main-photo", { clipPath: "inset(12% 9% 12% 9%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none", scrollTrigger: { trigger: ".tde-intro-grid", start: "top 85%", end: "top 25%", scrub: .7 } });
    }, element);
    const refresh = () => ScrollTrigger.refresh();
    const observer = new ResizeObserver(refresh);
    observer.observe(element);
    document.fonts.ready.then(() => { if (!disposed && element.isConnected) refresh(); });
    return () => {
      disposed = true;
      observer.disconnect();
      gsap.ticker.remove(tick);
      context.revert();
      // Reset velocity before destruction so Lenis' pending native-scroll
      // timeout cannot restore its root classes after navigation.
      lenis.stop();
      lenis.destroy();
    };
  }, [active]);
  return root;
}
