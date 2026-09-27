import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { RhythmStar } from "./RhythmHero";
import { SchoolPhoto } from "./SchoolPhoto";
import { tdePhoto } from "@/lib/tdeMedia";

gsap.registerPlugin(ScrollTrigger);
const photos = ["young-crew", "floorwork", "red-jacket-crew"] as const;

/** Original TDE scene recreating the reference's expanding aperture and travelling media. */
export function DanceScrollScene({ active, reduced, onToggle }: { active: boolean; reduced: boolean; onToggle: () => void }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || !active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.dataset.enhanced = "true";
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ scrollTrigger: { trigger: element, start: "top top", end: "bottom bottom", scrub: .8, invalidateOnRefresh: true } });
      timeline.fromTo(".tde-scroll-aperture", { clipPath: "inset(18% 32% round 50%)" }, { clipPath: "inset(0% 0% round 0%)", duration: .22, ease: "power3.inOut" }, 0)
        .fromTo(".tde-scroll-scene-world", { scale: .78 }, { scale: 1, duration: .22, ease: "power3.inOut" }, 0)
        .fromTo(".tde-scroll-echo:nth-child(odd)", { xPercent: -10 }, { xPercent: 10, duration: 1, ease: "none" }, 0)
        .fromTo(".tde-scroll-echo:nth-child(even)", { xPercent: 8 }, { xPercent: -12, duration: 1, ease: "none" }, 0);
      gsap.utils.toArray<HTMLElement>(".tde-scroll-photo").forEach((photo, index) => {
        timeline.fromTo(photo, { x: () => window.innerWidth * .95, yPercent: index % 2 ? 20 : -15, rotation: index % 2 ? 9 : -8, scale: .78 }, { x: () => -window.innerWidth * .95, yPercent: index % 2 ? -12 : 12, rotation: index % 2 ? -5 : 5, scale: 1.08, duration: .48, ease: "none" }, .08 + index * .2);
      });
    }, element);
    return () => { context.revert(); delete element.dataset.enhanced; };
  }, [active]);

  return <section className="tde-scroll-scene" ref={root} aria-labelledby="rhythm-scene-title">
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
