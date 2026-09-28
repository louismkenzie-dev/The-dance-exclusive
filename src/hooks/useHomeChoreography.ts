import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useMediaQuery } from "./useMediaQuery";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

/** Homepage-only choreography. All styles revert on pause, route change or reduced motion. */
export function useHomeChoreography(active: boolean) {
  const desktop = useMediaQuery("(min-width: 1024px) and (pointer: fine)");
  const root = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  useEffect(() => {
    const element = root.current;
    if (!element || !active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let disposed = false;
    // Never intercept touch momentum; only smooth desktop wheel input.
    const lenis = desktop ? new Lenis({
      lerp: .085,
      smoothWheel: true,
      syncTouch: false,
      prevent: node => Boolean(node.closest('[role="dialog"], [data-lenis-prevent], input, textarea, select') || document.querySelector('[role="dialog"]')),
    }) : null;
    const tick = (time: number) => lenis?.raf(time * 1000);
    lenis?.on("scroll", ScrollTrigger.update);
    if (lenis) gsap.ticker.add(tick);
    const context = gsap.context(() => {
      if (!entered.current && window.scrollY < 100) {
        entered.current = true;
        const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
        if (desktop) {
          intro.from(".tde-rhythm-art", { clipPath: "inset(100% 0 0 0)", duration: 1.25 }, 0)
            .from(".tde-rhythm-field", { scaleY: 1.35, transformOrigin: "bottom", duration: 1.6 }, .05);
        } else {
          // Composite the existing line artwork instead of repainting a canvas
          // or clipping the playing video every frame on phones.
          intro.from(".tde-rhythm-art", { opacity: .35, duration: .65 }, 0);
        }
        intro.from(".tde-rhythm-letter-inner", { yPercent: 105, duration: desktop ? 1.05 : .7, stagger: desktop ? .025 : .012 }, .1)
          .from(".tde-rhythm-actions", { opacity: .2, duration: .45 }, .2);
      }
      const heroScroll = { trigger: ".tde-rhythm-hero", start: "top top", end: "bottom top", scrub: desktop ? .8 : true };
      gsap.to(".tde-rhythm-title > svg", { rotation: 180, ease: "none", scrollTrigger: heroScroll });
      gsap.to(".tde-rhythm-underlay .tde-media-layer", { scale: desktop ? 1.15 : 1.06, ease: "none", scrollTrigger: heroScroll });
      if (desktop) {
        gsap.to(".tde-rhythm-strip", { "--ticker-shift": "-160px", ease: "none", scrollTrigger: heroScroll });
        gsap.fromTo(".tde-intro-main-photo", { clipPath: "inset(12% 9% 12% 9%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none", scrollTrigger: { trigger: ".tde-intro-grid", start: "top 85%", end: "top 25%", scrub: .7 } });
      } else {
        gsap.fromTo(".tde-rhythm-fallback", { scale: 1.08, xPercent: -3 }, { xPercent: 3, yPercent: -4, ease: "none", scrollTrigger: heroScroll });
      }
    }, element);
    let refreshFrame = 0;
    let refreshPending = false;
    let lastWidth = element.offsetWidth;
    let lastHeight = element.offsetHeight;
    const refresh = () => {
      // Content/font measurements must not interrupt a phone's momentum swipe.
      if (!desktop && ScrollTrigger.isScrolling()) { refreshPending = true; return; }
      refreshPending = false;
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => { if (!disposed) ScrollTrigger.refresh(); });
    };
    const afterScroll = () => { if (refreshPending) refresh(); };
    if (!desktop) ScrollTrigger.addEventListener("scrollEnd", afterScroll);
    const observer = new ResizeObserver(() => {
      const width = element.offsetWidth, height = element.offsetHeight;
      // Ignore small height-only browser-chrome changes during touch scroll.
      if (width === lastWidth && Math.abs(height - lastHeight) < 80) return;
      lastWidth = width; lastHeight = height;
      refresh();
    });
    observer.observe(element);
    document.fonts.ready.then(() => { if (!disposed && element.isConnected) refresh(); });
    return () => {
      disposed = true;
      observer.disconnect();
      ScrollTrigger.removeEventListener("scrollEnd", afterScroll);
      cancelAnimationFrame(refreshFrame);
      gsap.ticker.remove(tick);
      context.revert();
      // Reset velocity before destruction so Lenis' pending native-scroll
      // timeout cannot restore its root classes after navigation.
      lenis?.stop();
      lenis?.destroy();
    };
  }, [active, desktop]);
  return root;
}
