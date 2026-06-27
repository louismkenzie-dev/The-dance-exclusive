import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Zap,
  Flame,
  Heart,
  Trophy,
  Sparkles,
  MapPin,
  Quote,
  Users,
  Star,
  Music2,
} from "lucide-react";
import GrainOverlay from "@/components/immersive/GrainOverlay";
import { Reveal } from "@/components/immersive/Reveal";
import { Marquee } from "@/components/immersive/Marquee";
import { StatCounter } from "@/components/immersive/StatCounter";
import { useMagnetic } from "@/hooks/useMagnetic";

const sentence = {
  textTransform: "none",
  letterSpacing: "normal",
  fontFamily: "var(--font-body)",
} as const;

const VALUES = [
  {
    Icon: Flame,
    title: "Energy",
    tint: "201 70% 65%",
    copy: "The music hits and the room changes. We train hard, sweat harder and chase that electric feeling that only the dance floor gives you. No half-measures, ever.",
  },
  {
    Icon: Heart,
    title: "Family",
    tint: "280 78% 62%",
    copy: "Nobody dances alone here. From shy first-timers to seasoned crews, every dancer is welcomed, championed and pushed by people who genuinely care about them.",
  },
  {
    Icon: Trophy,
    title: "Excellence",
    tint: "330 90% 55%",
    copy: "Competition titles don't happen by accident. We hold a standard, sharpen every detail and believe every student is capable of more than they think.",
  },
];

const TIMELINE = [
  {
    year: "2014",
    title: "One Class, One Room",
    tint: "201 70% 65%",
    copy: "It started with a single hired hall, a borrowed speaker and a handful of kids who just wanted to move. The energy was undeniable from week one.",
  },
  {
    year: "2016",
    title: "First Competition Titles",
    tint: "220 72% 64%",
    copy: "Our first crews stepped onto the competition stage — and came home with trophies. Word spread fast across Essex.",
  },
  {
    year: "2018",
    title: "A Second Home",
    tint: "260 75% 62%",
    copy: "Demand outgrew one venue. We opened our second location and welcomed our first dedicated adult classes — heels and commercial included.",
  },
  {
    year: "2021",
    title: "Award-Winning Status",
    tint: "300 80% 58%",
    copy: "Recognised as one of the region's standout street and commercial schools, with showcase pedigree and a growing wall of silverware.",
  },
  {
    year: "2024",
    title: "Five Venues, One Family",
    tint: "330 90% 55%",
    copy: "Now across five Essex venues with hundreds of dancers every week — and still run with the same family spirit it started with.",
  },
];

const STATS = [
  { value: 10, suffix: "+", label: "Award-Winning Years" },
  { value: 500, suffix: "+", label: "Dancers & Counting" },
  { value: 5, suffix: "", label: "Essex Venues" },
  { value: 25, suffix: "+", label: "Titles & Awards" },
];

export default function About() {
  const magBlue = useMagnetic<HTMLDivElement>(0.22);
  const magMag = useMagnetic<HTMLDivElement>(0.22);

  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────────── HERO ───────────────── */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent,hsl(220_20%_4%)_78%)]" />
        <GrainOverlay />

        <span
          aria-hidden
          className="pointer-events-none select-none absolute inset-x-0 top-[12%] text-center font-display font-bold text-[24vw] leading-none text-stroke-faint tracking-tighter"
        >
          STORY
        </span>

        <div className="relative z-10 max-w-3xl animate-fade-in">
          <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-5">
            The Dance Exclusive
          </p>
          <h1 className="font-display font-bold leading-[0.92] tracking-tight text-[16vw] sm:text-7xl md:text-8xl">
            <span className="block">Our</span>
            <span className="block text-primary drop-shadow-[0_0_40px_hsl(201_70%_65%/0.35)]">
              Story
            </span>
          </h1>
          <p
            className="mt-7 text-base md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed"
            style={sentence}
          >
            Built in Essex from a single class into an award-winning movement — we exist to
            put every dancer, young or grown, into the spotlight they deserve.
          </p>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
            Our journey
          </span>
          <div className="w-5 h-8 rounded-full border border-muted-foreground/30 flex justify-center pt-1.5">
            <span className="w-1 h-1.5 rounded-full bg-primary animate-scroll-cue" />
          </div>
        </div>
      </section>

      {/* ───────────────── MARQUEE STRIP ───────────────── */}
      <div className="border-y border-border bg-card/40 py-4 text-foreground/90">
        <Marquee
          items={[
            "Built In Essex",
            "Family Run",
            "Award-Winning",
            "Street",
            "Commercial",
            "Heels",
            "Crews",
            "Showcases",
          ]}
          speed={38}
        />
      </div>

      {/* ───────────────── ORIGIN / FOUNDER NARRATIVE ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue opacity-60" />
        <GrainOverlay />
        <div className="relative container grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* image placeholder */}
          <Reveal>
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-primary/25">
              <div className="absolute inset-0 stage-light-blue" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
              <GrainOverlay />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <Music2 className="w-8 h-8" />
                </div>
                <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground/80">
                  Where it began
                </span>
              </div>
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-4 left-4 font-display font-bold text-[7rem] leading-none text-stroke-faint"
              >
                2014
              </span>
            </div>
          </Reveal>

          {/* narrative */}
          <Reveal delay={120}>
            <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-4">
              How it started
            </p>
            <h2 className="font-display font-bold text-4xl md:text-5xl leading-tight">
              One class. One borrowed speaker. A whole lot of belief.
            </h2>
            <div className="mt-6 space-y-5 text-muted-foreground leading-relaxed" style={sentence}>
              <p>
                The Dance Exclusive didn't begin in a glossy studio. It began in a hired hall in
                Essex with a single class, a secondhand sound system and a simple conviction:
                that great dance training should feel electric, welcoming and seriously good — all
                at the same time.
              </p>
              <p>
                Word travelled the way it always does when something special is happening. One class
                became two. Crews formed. Trophies arrived. Parents told other parents. Adults who
                hadn't danced in years walked in nervous and walked out hooked. What never changed
                was the feeling in the room — the energy, the family, the relentless pursuit of
                getting better.
              </p>
              <p className="text-foreground/90">
                A decade on, we're an award-winning school across five Essex venues, teaching
                hundreds of dancers every week — and still run with the exact heart it started with.
              </p>
            </div>
            <div className="mt-8 flex items-center gap-3 text-sm">
              <Users className="w-5 h-5 text-primary" />
              <span className="uppercase tracking-[0.18em] text-muted-foreground">
                From one room to a movement
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── VALUES TRIO ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(180deg, hsl(220 20% 4%), hsl(220 22% 6%)), radial-gradient(70% 50% at 0% 0%, hsl(201 70% 55% / 0.10), transparent 60%), radial-gradient(70% 50% at 100% 100%, hsl(330 90% 55% / 0.10), transparent 60%)",
          }}
        />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              What we stand for
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">Three Things, Non-Negotiable</h2>
            <p className="mt-4 text-muted-foreground" style={sentence}>
              Everything we teach and every class we run is built on the same three pillars — the
              DNA of The Dance Exclusive.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 110}>
                <div
                  className="group relative h-full rounded-2xl border p-8 bg-card/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1.5 overflow-hidden"
                  style={{ borderColor: `hsl(${v.tint} / 0.35)` }}
                >
                  <div
                    className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-40 transition-opacity duration-500 group-hover:opacity-70"
                    style={{ background: `hsl(${v.tint} / 0.5)` }}
                  />
                  <div className="relative">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 border"
                      style={{
                        background: `hsl(${v.tint} / 0.12)`,
                        borderColor: `hsl(${v.tint} / 0.4)`,
                        color: `hsl(${v.tint})`,
                      }}
                    >
                      <v.Icon className="w-7 h-7" />
                    </div>
                    <h3 className="font-display text-3xl">{v.title}</h3>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed" style={sentence}>
                      {v.copy}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── TIMELINE / JOURNEY SO FAR ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div
          className="absolute inset-0 opacity-95"
          style={{
            background:
              "linear-gradient(180deg, hsl(220 22% 5%), hsl(220 22% 6%)), radial-gradient(60% 80% at 50% 0%, hsl(201 70% 55% / 0.10), transparent 55%), radial-gradient(60% 80% at 50% 100%, hsl(330 90% 55% / 0.14), transparent 55%)",
          }}
        />
        <GrainOverlay />
        <div className="relative container max-w-4xl">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              The journey so far
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">From Hall to Headline</h2>
            <p className="mt-4 text-muted-foreground" style={sentence}>
              Ten years, five venues and hundreds of dancers — the lights shift from blue to magenta
              as the story grows.
            </p>
          </Reveal>

          <div className="relative">
            {/* spine */}
            <div
              className="absolute left-[1.15rem] sm:left-1/2 top-2 bottom-2 w-px -translate-x-1/2"
              style={{
                background:
                  "linear-gradient(180deg, hsl(201 70% 65% / 0.6), hsl(280 78% 62% / 0.6), hsl(330 90% 55% / 0.7))",
              }}
            />

            <div className="space-y-10">
              {TIMELINE.map((t, i) => {
                const left = i % 2 === 0;
                return (
                  <Reveal key={t.year} delay={i * 90}>
                    <div
                      className={`relative pl-12 sm:pl-0 sm:grid sm:grid-cols-2 sm:gap-10 sm:items-center ${
                        left ? "" : "sm:[direction:rtl]"
                      }`}
                    >
                      {/* node */}
                      <span
                        className="absolute left-[1.15rem] sm:left-1/2 top-1.5 sm:top-1/2 w-4 h-4 rounded-full -translate-x-1/2 sm:-translate-y-1/2 ring-4 ring-background"
                        style={{ background: `hsl(${t.tint})`, boxShadow: `0 0 22px hsl(${t.tint} / 0.7)` }}
                      />
                      {/* card */}
                      <div className={left ? "sm:text-right sm:pr-10" : "sm:text-left sm:pl-10 sm:[direction:ltr]"}>
                        <div
                          className="inline-flex flex-col rounded-2xl border bg-card/60 backdrop-blur-sm p-6 transition-colors duration-300 w-full"
                          style={{ borderColor: `hsl(${t.tint} / 0.35)` }}
                        >
                          <span
                            className="font-display font-bold text-4xl"
                            style={{ color: `hsl(${t.tint})` }}
                          >
                            {t.year}
                          </span>
                          <h3 className="mt-1 font-display text-2xl">{t.title}</h3>
                          <p className="mt-2 text-sm text-muted-foreground leading-relaxed" style={sentence}>
                            {t.copy}
                          </p>
                        </div>
                      </div>
                      {/* spacer column on desktop */}
                      <div className="hidden sm:block" />
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── STAT BAND ───────────────── */}
      <section className="relative py-20 px-4 overflow-hidden border-y border-border">
        <div className="absolute inset-0 stage-light-duo opacity-70" />
        <GrainOverlay />
        <div className="relative container grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <div className="font-display font-bold text-5xl md:text-6xl text-primary">
                <StatCounter value={s.value} suffix={s.suffix} />
              </div>
              <div className="mt-2 text-xs md:text-sm uppercase tracking-[0.18em] text-muted-foreground">
                {s.label}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────────────── QUOTE / TESTIMONIAL ───────────────── */}
      <section className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-mag opacity-50" />
        <GrainOverlay />
        <Reveal className="relative max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-6 text-accent">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-current" />
            ))}
          </div>
          <Quote className="w-10 h-10 text-accent/40 mx-auto mb-6" />
          <blockquote
            className="text-2xl md:text-4xl font-display leading-[1.25]"
            style={{ textTransform: "none" }}
          >
            “She walked in shy and walked out unstoppable. This isn't just a dance school —
            it's the place that taught my daughter who she could be.”
          </blockquote>
          <figcaption className="mt-8">
            <span className="font-display uppercase tracking-wider text-sm">Sarah M.</span>
            <span className="block text-xs text-muted-foreground mt-1" style={{ textTransform: "none" }}>
              Parent · Chelmsford
            </span>
          </figcaption>
        </Reveal>
      </section>

      {/* ───────────────── CLOSING CTA ───────────────── */}
      <section className="relative py-28 px-4 text-center overflow-hidden border-t border-border">
        <div className="absolute inset-0 stage-light-duo" />
        <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_50%_120%,hsl(330_90%_55%/0.18),transparent_60%)]" />
        <GrainOverlay />
        <Reveal className="relative max-w-3xl mx-auto">
          <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-4">
            Your story starts here
          </p>
          <h2 className="font-display font-bold text-5xl md:text-7xl leading-[0.95]">
            Come <span className="text-primary">write</span> the{" "}
            <span className="text-accent">next chapter</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg" style={sentence}>
            Whether you're three or thirty-three, there's a spot on this floor with your name on it.
            Step into the spotlight.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div ref={magBlue} className="inline-block will-change-transform">
              <Button
                asChild
                size="lg"
                className="text-base px-8 py-6 font-semibold uppercase tracking-wider animate-glow-pulse"
              >
                <Link to="/classes/children">
                  <Sparkles className="w-4 h-4 mr-2" /> Children's Classes
                </Link>
              </Button>
            </div>
            <div ref={magMag} className="inline-block will-change-transform">
              <Button
                asChild
                size="lg"
                className="text-base px-8 py-6 font-semibold uppercase tracking-wider bg-[hsl(330,90%,55%)] text-white hover:bg-[hsl(330,90%,60%)] shadow-lg shadow-[hsl(330,90%,55%)]/30"
              >
                <Link to="/classes/adult">
                  <Heart className="w-4 h-4 mr-2" /> Adult Classes
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
            <MapPin className="w-4 h-4 text-primary" />
            Five venues across Essex
            <ArrowRight className="w-3.5 h-3.5" />
            <Zap className="w-4 h-4 text-accent" />
            One unforgettable first class
          </div>
        </Reveal>
      </section>
    </div>
  );
}
