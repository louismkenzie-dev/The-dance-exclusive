import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { FadeRise, Stagger, AnimatedNumber, AmbientGlow } from "@/components/motion";

const BADGES = [
  "Built in Essex",
  "Family run",
  "Award-winning",
  "Street",
  "Commercial",
  "Heels",
  "Crews",
  "Showcases",
];

const VALUES = [
  {
    Icon: Flame,
    title: "Energy",
    tile: "bg-primary/10 text-primary",
    copy: "The music hits and the room changes. We train hard, sweat harder and chase that electric feeling that only the dance floor gives you. No half-measures, ever.",
  },
  {
    Icon: Heart,
    title: "Family",
    tile: "bg-accent/10 text-accent",
    copy: "Nobody dances alone here. From shy first-timers to seasoned crews, every dancer is welcomed, championed and pushed by people who genuinely care about them.",
  },
  {
    Icon: Trophy,
    title: "Excellence",
    tile: "bg-warning/10 text-warning",
    copy: "Competition titles don't happen by accident. We hold a standard, sharpen every detail and believe every student is capable of more than they think.",
  },
];

const TIMELINE = [
  {
    year: "2014",
    title: "One class, one room",
    node: "bg-primary",
    yearText: "text-primary",
    copy: "It started with a single hired hall, a borrowed speaker and a handful of kids who just wanted to move. The energy was undeniable from week one.",
  },
  {
    year: "2016",
    title: "First competition titles",
    node: "bg-primary",
    yearText: "text-primary",
    copy: "Our first crews stepped onto the competition stage — and came home with trophies. Word spread fast across Essex.",
  },
  {
    year: "2018",
    title: "A second home",
    node: "bg-accent",
    yearText: "text-accent",
    copy: "Demand outgrew one venue. We opened our second location and welcomed our first dedicated adult classes — heels and commercial included.",
  },
  {
    year: "2021",
    title: "Award-winning status",
    node: "bg-accent",
    yearText: "text-accent",
    copy: "Recognised as one of the region's standout street and commercial schools, with showcase pedigree and a growing wall of silverware.",
  },
  {
    year: "2024",
    title: "Five venues, one family",
    node: "bg-accent",
    yearText: "text-accent",
    copy: "Now across five Essex venues with hundreds of dancers every week — and still run with the same family spirit it started with.",
  },
];

const STATS = [
  { value: 10, suffix: "+", label: "Award-winning years" },
  { value: 500, suffix: "+", label: "Dancers & counting" },
  { value: 5, suffix: "", label: "Essex venues" },
  { value: 25, suffix: "+", label: "Titles & awards" },
];

export default function About() {
  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative overflow-hidden px-4 pt-24 pb-16 md:pt-32 md:pb-24">
        <AmbientGlow variant="light" />
        <div className="relative container max-w-7xl text-center">
          <FadeRise>
            <p className="eyebrow mb-5">The Dance Exclusive</p>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-7xl">
              Our <em className="font-serif italic font-normal text-primary">story</em>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-xl">
              Built in Essex from a single class into an award-winning movement — we exist to
              put every dancer, young or grown, into the spotlight they deserve.
            </p>
          </FadeRise>
          <FadeRise delay={140}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              {BADGES.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── Origin / founder narrative ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="container grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Art-directed gradient tile (image placeholder) */}
          <FadeRise>
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-secondary/60 to-accent/10 shadow-soft-lg">
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Music2 className="h-8 w-8" />
                </div>
                <div>
                  <p className="eyebrow">Where it began</p>
                  <p className="mt-2 font-display text-6xl font-extrabold tabular-nums tracking-tight text-primary/30 md:text-7xl">
                    2014
                  </p>
                </div>
              </div>
            </div>
          </FadeRise>

          {/* Narrative */}
          <FadeRise delay={120}>
            <p className="eyebrow mb-4">How it started</p>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              One class. One borrowed speaker. A whole lot of belief.
            </h2>
            <div className="mt-6 space-y-5 leading-relaxed text-muted-foreground">
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
              <p className="text-foreground">
                A decade on, we're an award-winning school across five Essex venues, teaching
                hundreds of dancers every week — and still run with the exact heart it started with.
              </p>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                From one room to a movement
              </span>
            </div>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── Values trio ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <FadeRise className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
            <p className="eyebrow mb-3">What we stand for</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Three things, non-negotiable
            </h2>
            <p className="mt-4 text-muted-foreground">
              Everything we teach and every class we run is built on the same three pillars — the
              DNA of The Dance Exclusive.
            </p>
          </FadeRise>

          <Stagger className="grid gap-4 md:grid-cols-3 md:gap-6" childClassName="h-full">
            {VALUES.map((v) => (
              <Card
                key={v.title}
                className="h-full p-8 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ${v.tile}`}>
                  <v.Icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-2xl font-bold tracking-tight">{v.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.copy}</p>
              </Card>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── Timeline / journey so far ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="container max-w-4xl">
          <FadeRise className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
            <p className="eyebrow mb-3">The journey so far</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              From hall to headline
            </h2>
            <p className="mt-4 text-muted-foreground">
              Ten years, five venues and hundreds of dancers — the lights shift from blue to magenta
              as the story grows.
            </p>
          </FadeRise>

          <div className="relative">
            {/* Spine */}
            <div
              aria-hidden
              className="absolute left-[1.15rem] top-2 bottom-2 w-px -translate-x-1/2 bg-gradient-to-b from-primary/40 via-border to-accent/50 sm:left-1/2"
            />

            <div className="space-y-8 md:space-y-10">
              {TIMELINE.map((t, i) => {
                const left = i % 2 === 0;
                return (
                  <FadeRise key={t.year} delay={i * 90}>
                    <div
                      className={`relative pl-12 sm:grid sm:grid-cols-2 sm:items-center sm:gap-10 sm:pl-0 ${
                        left ? "" : "sm:[direction:rtl]"
                      }`}
                    >
                      {/* Node */}
                      <span
                        aria-hidden
                        className={`absolute left-[1.15rem] top-8 h-3 w-3 -translate-x-1/2 rounded-full ring-4 ring-background sm:left-1/2 sm:top-1/2 sm:-translate-y-1/2 ${t.node}`}
                      />
                      {/* Card */}
                      <div className={left ? "sm:pr-10 sm:text-right" : "sm:pl-10 sm:text-left sm:[direction:ltr]"}>
                        <Card className="w-full p-6 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg">
                          <span
                            className={`font-display text-3xl font-bold tabular-nums tracking-tight ${t.yearText}`}
                          >
                            {t.year}
                          </span>
                          <h3 className="mt-1 font-display text-xl font-bold tracking-tight">{t.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.copy}</p>
                        </Card>
                      </div>
                      {/* Spacer column on desktop */}
                      <div className="hidden sm:block" />
                    </div>
                  </FadeRise>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── Stat band ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-6xl">
          <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6" childClassName="h-full">
            {STATS.map((s) => (
              <Card key={s.label} className="h-full p-6 text-center md:p-8">
                <div className="font-display text-4xl font-bold tabular-nums tracking-tight text-primary md:text-5xl">
                  <AnimatedNumber value={s.value} suffix={s.suffix} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── Quote / testimonial ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <FadeRise className="container max-w-3xl text-center">
          <figure>
            <div className="mb-6 flex justify-center gap-1 text-warning">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-current" />
              ))}
            </div>
            <div className="mx-auto mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Quote className="h-6 w-6" />
            </div>
            <blockquote className="font-display text-2xl font-medium leading-[1.25] tracking-tight md:text-4xl">
              “She walked in shy and walked out unstoppable. This isn't just a dance school —
              it's the place that taught my daughter who she could be.”
            </blockquote>
            <figcaption className="mt-8">
              <span className="font-display text-sm font-semibold">Sarah M.</span>
              <span className="mt-1 block text-xs text-muted-foreground">Parent · Chelmsford</span>
            </figcaption>
          </figure>
        </FadeRise>
      </section>

      {/* ───────────────── Closing CTA (night band) ───────────────── */}
      <section className="px-4 pb-16 md:pb-24">
        <FadeRise className="container max-w-6xl">
          <div className="dark relative overflow-hidden rounded-3xl bg-background px-6 py-16 text-center text-foreground shadow-soft-xl md:px-12 md:py-24">
            <AmbientGlow variant="night" />
            <div className="relative mx-auto max-w-3xl">
              <p className="eyebrow mb-4">Your story starts here</p>
              <h2 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                Come <span className="text-primary">write</span> the{" "}
                <span className="text-accent">next chapter</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
                Whether you're three or thirty-three, there's a spot on this floor with your name on
                it. Step into the spotlight.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/classes/children">
                    <Sparkles className="mr-2 h-4 w-4" /> Children's classes
                  </Link>
                </Button>
                <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Link to="/classes/adult">
                    <Heart className="mr-2 h-4 w-4" /> Adult classes
                  </Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Five venues across Essex
                <ArrowRight className="h-3.5 w-3.5" />
                <Zap className="h-4 w-4 text-accent" />
                One unforgettable first class
              </div>
            </div>
          </div>
        </FadeRise>
      </section>
    </div>
  );
}
