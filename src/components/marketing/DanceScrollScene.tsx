import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { RhythmStar } from "./RhythmHero";
import { SchoolPhoto } from "./SchoolPhoto";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { tdePhoto } from "@/lib/tdeMedia";

gsap.registerPlugin(ScrollTrigger);
// Safari toolbar expansion is not a layout resize; avoid refreshing mid-swipe.
ScrollTrigger.config({ ignoreMobileResize: true });
const photos = ["young-crew", "floorwork", "red-jacket-crew"] as const;

/** Original TDE scene recreating the reference's expanding aperture and travelling media. */
export function DanceScrollScene({ active, reduced, onToggle }: { active: boolean; reduced: boolean; onToggle: () => void }) {
  const lightweight = useMediaQuery("(max-width: 1023px), (pointer: coarse)");
  const animation = useRef<gsap.core.Timeline | null>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      // Match RhythmStar's 60 × 60 outline in pixels, so the star stays square
      // on both wide desktop and portrait mobile viewports.
      const closedStar = () => {
        const viewport = element.querySelector<HTMLElement>(".tde-scroll-scene-sticky")!;
        const { width, height } = viewport.getBoundingClientRect();
        const size = Math.min(width, height) * .36;
        const points = [[30, 0], [36, 24], [60, 30], [36, 36], [30, 60], [24, 36], [0, 30], [24, 24]];
        return `polygon(${points.map(([x, y]) => `${width / 2 + (x / 60 - .5) * size}px ${height / 2 + (y / 60 - .5) * size}px`).join(", ")})`;
      };
      const openStar = () => {
        const { width, height } = element.querySelector<HTMLElement>(".tde-scroll-scene-sticky")!.getBoundingClientRect();
        return `polygon(${width / 2}px 0px, ${width}px 0px, ${width}px ${height / 2}px, ${width}px ${height}px, ${width / 2}px ${height}px, 0px ${height}px, 0px ${height / 2}px, 0px 0px)`;
      };
      const timeline = gsap.timeline({ scrollTrigger: { trigger: element, start: "top top", end: "bottom bottom", scrub: lightweight ? true : .8, invalidateOnRefresh: true } });
      animation.current = timeline;
      timeline.fromTo(".tde-scroll-aperture", { clipPath: closedStar }, { clipPath: openStar, duration: .22, ease: "power3.inOut" }, .03)
        .fromTo(".tde-scroll-scene-world", { opacity: 0 }, { opacity: 1, duration: .14, ease: "none" }, .07)
        .fromTo(".tde-scroll-scene-world", { scale: lightweight ? 1 : .78 }, { scale: 1, duration: .22, ease: "power3.inOut" }, 0)
        .fromTo(".tde-scroll-echo:nth-child(odd)", { xPercent: -10 }, { xPercent: 10, duration: 1, ease: "none" }, 0)
        .fromTo(".tde-scroll-echo:nth-child(even)", { xPercent: 8 }, { xPercent: -12, duration: 1, ease: "none" }, 0)
        .to(".tde-scroll-aperture", { clipPath: closedStar, duration: .2, ease: "power3.inOut" }, .78)
        .to(".tde-scroll-scene-world", { opacity: 0, duration: .14, ease: "none" }, .84);
      gsap.utils.toArray<HTMLElement>(".tde-scroll-photo").forEach((photo, index) => {
        timeline.fromTo(photo, { x: () => window.innerWidth * .95, yPercent: index % 2 ? 20 : -15, rotation: index % 2 ? 9 : -8, scale: .78 }, { x: () => -window.innerWidth * .95, yPercent: index % 2 ? -12 : 12, rotation: index % 2 ? -5 : 5, scale: 1.08, duration: .48, ease: "none" }, .08 + index * .2);
      });
    }, element);
    return () => { context.revert(); animation.current = null; };
  }, [reduced, lightweight]);

  useEffect(() => {
    const timeline = animation.current;
    const trigger = timeline?.scrollTrigger;
    if (!timeline || !trigger) return;
    // Freeze in place: rebuilding the scene on pause used to collapse its height.
    if (active) { trigger.enable(false, false); trigger.update(); }
    else { trigger.disable(false); timeline.pause(); }
  }, [active, reduced, lightweight]);

  return <section className="tde-scroll-scene" data-enhanced={!reduced || undefined} ref={root} aria-labelledby="rhythm-scene-title">
    <div className="tde-scroll-scene-sticky">
      <div className="tde-scroll-scene-heading"><h2 id="rhythm-scene-title">Find your rhythm.</h2><div className="tde-scroll-scene-controls"><span aria-hidden="true">Scroll into the movement <ArrowDown size={14} /></span><button onClick={onToggle} aria-pressed={!active} disabled={reduced}>{active ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}{reduced ? "Reduced motion" : active ? "Pause motion" : "Play motion"}</button></div></div>
      <div className="tde-scroll-aperture">
        <div className="tde-scroll-scene-world">
          <div className="tde-scroll-echoes" aria-hidden="true">{[0, 1, 2].map(row => <div className="tde-scroll-echo" key={row}>{[0, 1, 2, 3].map(i => <span key={i}>DANCE <RhythmStar /></span>)}</div>)}</div>
          <div className="tde-scroll-photos">{photos.map(key => <figure className="tde-scroll-photo" key={key}><SchoolPhoto photo={tdePhoto(key)} sizes="(max-width: 760px) 76vw, 44vw" /></figure>)}</div>
        </div>
      </div>
      <div className="tde-scroll-scene-links"><Link to="/gallery">Life at TDE <ArrowUpRight size={18} aria-hidden /></Link><Link to="/classes">Find your class <ArrowUpRight size={18} aria-hidden /></Link></div>
    </div>
  </section>;
}
