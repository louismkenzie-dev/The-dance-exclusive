import { useEffect, useRef, useState } from "react";
import { ArrowDown, Pause, Play } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { BrandLogo } from "@/components/BrandLogo";
import { onScrollFrame } from "@/lib/scrollFrame";
import type { createDanceStudio } from "@/lib/danceStudio";

type Stage = Awaited<ReturnType<typeof createDanceStudio>>;

export function ScrollDanceStudio({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const section = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<Stage>();
  const portrait = useMediaQuery("(max-aspect-ratio: 4/5)");
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const canMove = active && !reduced;

  useEffect(() => {
    if (!section.current) return;
    const preload = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNear(true); }, { rootMargin: "400px" });
    const visibility = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    preload.observe(section.current); visibility.observe(section.current);
    return () => { preload.disconnect(); visibility.disconnect(); };
  }, []);

  useEffect(() => { if (near && canMove) setStarted(true); }, [near, canMove]);

  useEffect(() => {
    if (!started || reduced || failed || !host.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const abort = new AbortController();
    let cancelled = false;
    let stage: Stage | undefined;
    void import("@/lib/danceStudio").then(({ createDanceStudio }) => {
      if (cancelled || !host.current) return;
      return createDanceStudio(host.current, () => setFailed(true), abort.signal, portrait);
    }).then(result => {
      if (!result) return;
      if (cancelled) { result.dispose(); return; }
      stage = result; controller.current = result; setReady(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; abort.abort(); stage?.dispose(); controller.current = undefined; setReady(false); };
  }, [started, reduced, failed, portrait]);

  useEffect(() => {
    const element = section.current;
    if (!element || !canMove || !ready || !visible) return;
    return onScrollFrame(() => {
      const bounds = element.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -bounds.top / Math.max(1, bounds.height - window.innerHeight)));
      return () => {
        controller.current?.setProgress(progress);
        element.style.setProperty("--stage-progress", String(progress));
        element.dataset.chapter = progress < .33 ? "1" : progress < .67 ? "2" : "3";
      };
    });
  }, [canMove, ready, visible]);

  return (
    <section ref={section} id="turn-it-up" className="tde-sound-stage tde-dance-studio" data-enhanced={ready && !reduced && !failed} data-chapter="1" aria-labelledby="sound-stage-title">
      <div className="tde-sound-sticky">
        <div className="tde-sound-heading"><BrandLogo tone="white" className="tde-studio-logo" /><h2 id="sound-stage-title">Turn it<br /><em>up.</em></h2><p>Scroll to bring the studio to life.</p></div>
        <div className="tde-sound-art" aria-hidden="true">
          <picture><source media="(max-aspect-ratio: 4/5)" srcSet="/media/tde-animated-studio-mobile.jpg" /><img src="/media/tde-animated-studio.jpg" alt="" width="1440" height="1000" loading="lazy" /></picture>
          <div ref={host} className="tde-sound-canvas" />
        </div>
        <div className="tde-studio-shade" aria-hidden="true" />
        <div className="tde-sound-bottom">
          <div className="tde-sound-chapters" role="group" aria-label="Sound on. Find the steps. Light the room.">
            <span aria-hidden="true">01 / Sound on.</span><span aria-hidden="true">02 / Find the steps.</span><span aria-hidden="true">03 / Light the room.</span>
          </div>
          <div className="tde-sound-controls">
            {ready && !reduced && <button type="button" onClick={onToggle} aria-pressed={!active}>{active ? <Pause size={14} /> : <Play size={14} />}{active ? "Pause motion" : "Play motion"}</button>}
            <a href="#find-a-location">Find your local class <ArrowDown size={15} aria-hidden /></a>
          </div>
          <div className="tde-sound-progress" aria-hidden="true"><span /></div>
        </div>
      </div>
    </section>
  );
}
