import { Fragment } from "react";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { RhythmField } from "./RhythmField";
import { MotionMedia } from "./MotionMedia";

export function RhythmStar({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 60 60" fill="currentColor" aria-hidden="true"><path d="M30 0 36 24 60 30 36 36 30 60 24 36 0 30 24 24Z" /></svg>;
}

export function RhythmHero({ active, reduced, onToggle }: { active: boolean; reduced: boolean; onToggle: () => void }) {
  return <section className="tde-rhythm-hero" aria-labelledby="hero-title">
    <div className="tde-rhythm-art">
      <MotionMedia className="tde-rhythm-underlay" image="/media/tde-hero-poster-hd.jpg" video="/media/tde-hero-film-hd.mp4" mobileVideo="/media/tde-hero-film-mobile.mp4" alt="The Dance Exclusive dancers performing on stage" active={active} eager travel={0} />
      <RhythmField active={active} />
      <div className="tde-rhythm-control">
        <span>Find your rhythm.</span>
        <button onClick={onToggle} disabled={reduced} aria-pressed={!active}>
          {active ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />}
          {reduced ? "Reduced motion" : active ? "Pause motion" : "Play motion"}
        </button>
      </div>
    </div>
    <div className="tde-rhythm-strip" aria-hidden="true">
      <span>5 / 6 / 7 / 8</span><span>////////////////////////</span><span>STREET / COMMERCIAL</span><span>////////////////////////</span><span>MOVE TOGETHER</span><span>////////////////////////</span><span>5 / 6 / 7 / 8</span>
    </div>
    <h1 id="hero-title" className="tde-rhythm-title" aria-label="Step in. Stand out.">
      {["Step in.", "Stand out."].map((word, index) => <Fragment key={word}>
        {index === 1 && <RhythmStar />}
        <span className="tde-rhythm-word" aria-hidden="true">{[...word].map((letter, i) => <span className="tde-rhythm-letter" key={i}><span className="tde-rhythm-letter-inner">{letter === " " ? "\u00a0" : letter}</span></span>)}</span>
      </Fragment>)}
    </h1>
    <div className="tde-rhythm-actions">
      <p>Your music. Your people. Your moment.<br /><span>Street & commercial dance. Children & adults. Essex.</span></p>
      <Link to="/classes?type=children">Children's classes <ArrowUpRight size={23} aria-hidden /></Link>
      <Link to="/classes?type=adult" data-audience="adult">Adult classes <ArrowUpRight size={23} aria-hidden /></Link>
      <a href="#find-your-class" className="tde-rhythm-scroll" aria-label="Scroll to find your crew"><ArrowDown size={23} aria-hidden /></a>
    </div>
  </section>;
}
