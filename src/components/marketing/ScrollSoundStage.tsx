import { useEffect, useRef, useState } from "react";
import { ArrowDown, Pause, Play } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { onScrollFrame } from "@/lib/scrollFrame";
import type { createSoundStage } from "@/lib/soundStage";

type Stage = Awaited<ReturnType<typeof createSoundStage>>;

export function ScrollSoundStage({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const section = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<Stage>();
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
    void import("@/lib/soundStage").then(({ createSoundStage }) => {
      if (cancelled || !host.current) return;
      return createSoundStage(host.current, () => setFailed(true), abort.signal);
    }).then(result => {
      if (!result) return;
      if (cancelled) { result.dispose(); return; }
      stage = result; controller.current = result; setReady(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; abort.abort(); stage?.dispose(); controller.current = undefined; setReady(false); };
  }, [started, reduced, failed]);

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
    <section ref={section} id="turn-it-up" className="tde-sound-stage" data-enhanced={ready && !reduced && !failed} data-chapter="1" aria-labelledby="sound-stage-title">
      <div className="tde-sound-sticky">
        <div className="tde-sound-heading"><span className="tde-eyebrow">The music brings us together.</span><h2 id="sound-stage-title">Turn it <em>up.</em></h2><p>Find your rhythm. Make it yours.</p></div>
        <div className="tde-sound-art" aria-hidden="true">
          <span className="tde-sound-glow" />
          <img src="/media/tde-sound-stage.webp" alt="" width="1200" height="1000" loading="lazy" />
          <div ref={host} className="tde-sound-canvas" />
        </div>
        <div className="tde-sound-bottom">
          <div className="tde-sound-chapters" role="group" aria-label="Feel the beat. Find your people. Own the floor.">
            <span aria-hidden="true">01 / Feel the beat.</span><span aria-hidden="true">02 / Find your people.</span><span aria-hidden="true">03 / Own the floor.</span>
          </div>
          <div className="tde-sound-controls">
            {ready && !reduced && <button type="button" onClick={onToggle} aria-pressed={!active}>{active ? <Pause size={14} /> : <Play size={14} />}{active ? "Pause motion" : "Play motion"}</button>}
            <a href="#the-feeling">Meet your people <ArrowDown size={15} aria-hidden /></a>
          </div>
          <div className="tde-sound-progress" aria-hidden="true"><span /></div>
        </div>
      </div>
    </section>
  );
}
