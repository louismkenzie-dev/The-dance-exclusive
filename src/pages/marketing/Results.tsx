import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Flame,
  Sparkles,
  ArrowRight,
  Quote,
  ChevronRight,
} from "lucide-react";
import GrainOverlay from "@/components/immersive/GrainOverlay";
import { Reveal } from "@/components/immersive/Reveal";
import { Marquee } from "@/components/immersive/Marquee";
import { StatCounter } from "@/components/immersive/StatCounter";
import { useMagnetic } from "@/hooks/useMagnetic";

/* ──────────────────────────── DATA ──────────────────────────── */

type Award = {
  title: string;
  body: string;
  badge: string;
  year: string;
  tint: string;
  icon: typeof Trophy;
  highlight?: boolean;
};

const AWARDS: Award[] = [
  {
    title: "Performing Arts School of the Year",
    body: "Crowned Essex's top commercial & street dance academy at the regional industry awards — judged on results, teaching and reputation.",
    badge: "School of the Year",
    year: "2025",
    tint: "330 90% 55%",
    icon: Crown,
    highlight: true,
  },
  {
    title: "UDO European Street Dance Champions",
    body: "Our senior crew took gold in the Under-16 Team division at the United Dance Organisation Euro Championships.",
    badge: "1st Place · Gold",
    year: "2024",
    tint: "193 100% 44%",
    icon: Trophy,
  },
  {
    title: "UKSDC National Finalists",
    body: "Two crews reached the UK Street Dance Championship Grand Finals — top-five placements against the country's best academies.",
    badge: "National Finalists",
    year: "2024",
    tint: "260 75% 62%",
    icon: Medal,
  },
  {
    title: "Blackpool · BDO Winter Gardens",
    body: "Silver and bronze podium finishes on the legendary Blackpool floor — the most prestigious stage in UK competitive dance.",
    badge: "Podium · Silver & Bronze",
    year: "2023",
    tint: "300 80% 58%",
    icon: Award,
  },
  {
    title: "UDO British Solo Champion",
    body: "One of our seniors danced solo to the top of the UDO British rankings — Under-14 commercial category, first place.",
    badge: "1st Place · Solo",
    year: "2025",
    tint: "330 90% 55%",
    icon: Crown,
  },
  {
    title: "Regional Crew Champions ×6",
    body: "Six regional titles across junior, senior and adult divisions in a single competitive season — a school record.",
    badge: "6× Regional Titles",
    year: "2024–25",
    tint: "193 100% 44%",
    icon: Flame,
  },
];

const STATS = [
  { value: 38, suffix: "+", label: "Titles Won" },
  { value: 60, suffix: "+", label: "Finals Reached" },
  { value: 120, suffix: "+", label: "Trophies & Medals" },
  { value: 100, suffix: "%", label: "Grade Exam Pass Rate" },
];

const BODIES = [
  "UDO",
  "UKSDC",
  "BDO Blackpool",
  "Move It London",
  "Dance World Cup",
  "Street Dance UK",
  "IDF Worlds",
  "Winter Gardens",
];

const PODIUM = [
  { place: "1st", title: "UDO Euro Champions", div: "U16 Team", tint: "330 90% 55%" },
  { place: "1st", title: "British Solo Champion", div: "U14 Commercial", tint: "193 100% 44%" },
  { place: "2nd", title: "Blackpool Winter Gardens", div: "Senior Crew", tint: "300 80% 58%" },
];

/* ──────────────────────────── PAGE ──────────────────────────── */

const Results = () => {
  const magTrain = useMagnetic<HTMLDivElement>(0.22);
  const magBook = useMagnetic<HTMLDivElement>(0.22);

  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────────── HERO ───────────────── */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-duo" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent,hsl(220_20%_4%)_78%)]" />
        <GrainOverlay />

        {/* ghost word for depth */}
        <span
          aria-hidden
          className="pointer-events-none select-none absolute inset-x-0 top-[12%] text-center font-display font-bold text-[24vw] leading-none text-stroke-faint tracking-tighter"
        >
          WIN
        </span>

        <div className="relative z-10 max-w-4xl animate-fade-in">
          <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-6">
            Results · Awards · Champions
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/10 text-accent text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-8">
            <Trophy className="w-4 h-4" />
            Essex's Most-Decorated Dance School
          </div>

          <h1 className="font-display font-bold leading-[0.9] tracking-tight text-[18vw] sm:text-8xl md:text-[9rem]">
            <span className="block">We Raise</span>
            <span className="block text-accent drop-shadow-[0_0_48px_hsl(330_90%_55%/0.45)]">
              Champions
            </span>
          </h1>

          <p
            className="mt-7 mx-auto max-w-2xl text-muted-foreground text-lg"
            style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
          >
            Trophies on the shelf. Titles to our name. National finals reached year on year. When
            families choose The Dance Exclusive, they choose a team that knows how to win — and how
            to make every dancer believe they can.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <div ref={magBook} className="inline-block">
              <Button
                asChild
                size="lg"
                className="px-9 py-6 text-base font-semibold uppercase tracking-wider bg-accent text-white hover:bg-accent/90"
              >
                <Link to="/classes/children">
                  <Flame className="w-4 h-4 mr-2" /> Train With Champions
                </Link>
              </Button>
            </div>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="px-9 py-6 text-base font-semibold uppercase tracking-wider border-primary/40 text-foreground hover:bg-primary/10"
            >
              <a href="#wall">
                See The Honours <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>

        {/* floating trophy glyphs */}
        <Trophy className="hidden md:block absolute left-[8%] top-[28%] w-10 h-10 text-accent/30 animate-float" />
        <Medal className="hidden md:block absolute right-[10%] top-[34%] w-9 h-9 text-primary/30 animate-float [animation-delay:1.2s]" />
        <Crown className="hidden md:block absolute right-[16%] bottom-[18%] w-7 h-7 text-accent/30 animate-float [animation-delay:2s]" />
      </section>

      {/* ───────────────── AWARDS WALL ───────────────── */}
      <section id="wall" className="relative py-24 px-4 overflow-hidden border-t border-border">
        <div className="absolute inset-0 stage-light-mag opacity-50" />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="max-w-3xl mb-16">
            <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-4">
              The Honours Wall
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl leading-[0.95]">
              Every Title Earned <span className="text-accent">On The Floor</span>
            </h2>
            <p
              className="mt-5 text-muted-foreground text-lg"
              style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
            >
              From UDO European stages to the boards at Blackpool's Winter Gardens — these are the
              competitions our crews have conquered.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AWARDS.map((a, i) => {
              const Icon = a.icon;
              return (
                <Reveal key={a.title} delay={i * 90}>
                  <article
                    className={`group relative h-full rounded-2xl border bg-card/70 backdrop-blur-sm p-7 flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1.5 ${
                      a.highlight
                        ? "border-accent/50 shadow-[0_0_50px_-12px_hsl(330_90%_55%/0.4)] lg:col-span-1"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {/* tint glow */}
                    <div
                      className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl opacity-25 transition-opacity duration-300 group-hover:opacity-45"
                      style={{ background: `hsl(${a.tint})` }}
                    />

                    <div className="relative flex items-center justify-between mb-6">
                      <span
                        className="flex items-center justify-center w-14 h-14 rounded-xl border"
                        style={{
                          borderColor: `hsl(${a.tint} / 0.4)`,
                          background: `hsl(${a.tint} / 0.12)`,
                          color: `hsl(${a.tint})`,
                        }}
                      >
                        <Icon className="w-7 h-7" />
                      </span>
                      <span className="font-display text-sm tracking-wider text-muted-foreground">
                        {a.year}
                      </span>
                    </div>

                    <span
                      className="relative inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full text-[0.7rem] font-semibold uppercase tracking-[0.15em] mb-4"
                      style={{
                        color: `hsl(${a.tint})`,
                        background: `hsl(${a.tint} / 0.12)`,
                        border: `1px solid hsl(${a.tint} / 0.3)`,
                      }}
                    >
                      <Sparkles className="w-3 h-3" /> {a.badge}
                    </span>

                    <h3 className="relative font-display font-bold text-xl leading-tight mb-3">
                      {a.title}
                    </h3>

                    <p
                      className="relative text-sm text-muted-foreground flex-1"
                      style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
                    >
                      {a.body}
                    </p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────── RESULTS STAT BAND ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden border-y border-border">
        <div className="absolute inset-0 stage-light-duo opacity-70" />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="text-center mb-16">
            <div className="flex justify-center gap-1.5 mb-5 text-accent">
              {Array.from({ length: 5 }).map((_, i) => (
                <Crown key={i} className="w-5 h-5 fill-current" />
              ))}
            </div>
            <h2 className="font-display font-bold text-4xl md:text-6xl leading-[0.95]">
              The Record <span className="text-primary">Speaks</span>
            </h2>
            <p
              className="mt-4 mx-auto max-w-xl text-muted-foreground text-lg"
              style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
            >
              Seven years of competing — and winning — at the highest levels of UK street and
              commercial dance.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 110}>
                <div className="group relative h-full rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-8 text-center overflow-hidden transition-colors hover:border-accent/40">
                  <div className="pointer-events-none absolute inset-0 stage-light-mag opacity-0 transition-opacity duration-300 group-hover:opacity-30" />
                  <div className="relative font-display font-bold text-5xl md:text-6xl text-accent drop-shadow-[0_0_30px_hsl(330_90%_55%/0.35)]">
                    <StatCounter value={s.value} suffix={s.suffix} />
                  </div>
                  <div className="relative mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                    {s.label}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── AS SEEN AT MARQUEE ───────────────── */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue opacity-40" />
        <GrainOverlay />
        <div className="relative">
          <Reveal className="text-center mb-9 px-4">
            <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold">
              As Seen At
            </p>
            <h2 className="mt-3 font-display font-bold text-2xl md:text-4xl text-foreground/90">
              The Stages Where We Compete
            </h2>
          </Reveal>
          <Marquee items={BODIES} speed={34} accent="text-accent" />
          <Marquee items={BODIES} speed={40} reverse accent="text-primary" className="mt-5" />
        </div>
      </section>

      {/* ───────────────── PODIUM / SPOTLIGHT ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden border-t border-border">
        <div className="absolute inset-0 stage-light-mag opacity-50" />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="max-w-3xl mb-14">
            <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-4">
              This Season's Podium
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl leading-[0.95]">
              Gold Doesn't <span className="text-primary">Happen By Accident</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {PODIUM.map((p, i) => (
              <Reveal key={p.title} delay={i * 110}>
                <div
                  className="relative h-full rounded-2xl border border-border bg-card/70 backdrop-blur-sm p-8 overflow-hidden transition-transform duration-300 hover:-translate-y-1.5"
                  style={{ borderColor: `hsl(${p.tint} / 0.35)` }}
                >
                  <div
                    className="pointer-events-none absolute -bottom-16 -left-10 w-48 h-48 rounded-full blur-3xl opacity-25"
                    style={{ background: `hsl(${p.tint})` }}
                  />
                  <div
                    className="relative font-display font-bold text-7xl leading-none"
                    style={{ color: `hsl(${p.tint})` }}
                  >
                    {p.place}
                  </div>
                  <h3 className="relative mt-5 font-display font-bold text-xl leading-tight">
                    {p.title}
                  </h3>
                  <p
                    className="relative mt-2 text-sm text-muted-foreground"
                    style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
                  >
                    {p.div}
                  </p>
                  <Trophy
                    className="absolute top-7 right-7 w-8 h-8 opacity-40"
                    style={{ color: `hsl(${p.tint})` }}
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── CHAMPION TESTIMONIAL ───────────────── */}
      <section className="relative py-28 px-4 overflow-hidden border-t border-border">
        <div className="absolute inset-0 stage-light-blue opacity-50" />
        <GrainOverlay />
        <div className="relative container max-w-5xl">
          <Reveal>
            <figure className="relative rounded-3xl border border-accent/30 bg-card/70 backdrop-blur-sm p-10 md:p-16 overflow-hidden">
              <div className="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full blur-3xl opacity-20 bg-accent" />
              <Quote className="relative w-12 h-12 text-accent/50 mb-6" />
              <blockquote
                className="relative text-2xl md:text-3xl leading-snug text-foreground/95"
                style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
              >
                "I joined as a shy nine-year-old who'd never stepped on a stage. Six years later I'm a
                UDO British Champion. The coaches here didn't just teach me to dance — they taught me
                to <span className="text-accent font-semibold">win</span>, and to believe I belonged
                at the top."
              </blockquote>
              <figcaption className="relative mt-9 flex items-center gap-4">
                <span className="flex items-center justify-center w-14 h-14 rounded-full border border-accent/40 bg-accent/10 text-accent">
                  <Crown className="w-7 h-7" />
                </span>
                <div>
                  <span className="block font-display uppercase tracking-wider text-base">
                    Maya T.
                  </span>
                  <span
                    className="block text-sm text-muted-foreground"
                    style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
                  >
                    UDO British Solo Champion · Senior Crew Captain
                  </span>
                </div>
              </figcaption>
            </figure>
          </Reveal>

          {/* mini achievement strip */}
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            {[
              { icon: Trophy, label: "1st Place · UDO British Finals" },
              { icon: Medal, label: "Top-5 · UKSDC Nationals" },
              { icon: Crown, label: "Distinction · Grade 6 Commercial" },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <Reveal key={m.label} delay={i * 90}>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3">
                    <Icon className="w-5 h-5 text-accent shrink-0" />
                    <span className="text-sm text-foreground/85" style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}>
                      {m.label}
                    </span>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────── FINAL CTA ───────────────── */}
      <section className="relative py-28 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 stage-light-duo" />
        <GrainOverlay />
        <Reveal className="relative max-w-3xl mx-auto">
          <div className="flex justify-center gap-1.5 mb-6 text-accent">
            {Array.from({ length: 5 }).map((_, i) => (
              <Crown key={i} className="w-5 h-5 fill-current" />
            ))}
          </div>
          <h2 className="font-display font-bold text-5xl md:text-8xl leading-[0.92]">
            Your Name <span className="text-accent">On The Trophy</span>
          </h2>
          <p
            className="mt-6 mx-auto max-w-xl text-muted-foreground text-lg"
            style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
          >
            Every champion started with one class. Train alongside title-winning crews and coaches who
            have done it on the biggest stages in the UK.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <div ref={magTrain} className="inline-block">
              <Button
                asChild
                size="lg"
                className="px-9 py-6 text-base font-semibold uppercase tracking-wider bg-accent text-white hover:bg-accent/90"
              >
                <Link to="/classes/children">
                  <Flame className="w-4 h-4 mr-2" /> Train With Champions
                </Link>
              </Button>
            </div>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="px-9 py-6 text-base font-semibold uppercase tracking-wider border-primary/40 text-foreground hover:bg-primary/10"
            >
              <Link to="/classes/adult">
                Adult Classes <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
};

export default Results;
