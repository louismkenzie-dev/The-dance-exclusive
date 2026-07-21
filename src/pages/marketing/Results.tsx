import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Medal,
  Star,
  Award,
  Crown,
  Flame,
  ArrowRight,
  Quote,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { FadeRise, Stagger, AnimatedNumber, AmbientGlow } from "@/components/motion";

/* ──────────────────────────── Data ──────────────────────────── */

type Tone = "primary" | "accent" | "warning";

const TONES: Record<Tone, { tile: string; text: string; badge: "default" | "accent" | "warning" }> = {
  primary: { tile: "bg-primary/10 text-primary", text: "text-primary", badge: "default" },
  accent: { tile: "bg-accent/10 text-accent", text: "text-accent", badge: "accent" },
  warning: { tile: "bg-warning/10 text-warning", text: "text-warning", badge: "warning" },
};

type Honour = {
  title: string;
  body: string;
  badge: string;
  year: string;
  tone: Tone;
  icon: LucideIcon;
  highlight?: boolean;
};

const AWARDS: Honour[] = [
  {
    title: "Performing Arts School of the Year",
    body: "Crowned Essex's top commercial & street dance academy at the regional industry awards — judged on results, teaching and reputation.",
    badge: "School of the year",
    year: "2025",
    tone: "accent",
    icon: Crown,
    highlight: true,
  },
  {
    title: "UDO European Street Dance Champions",
    body: "Our senior crew took gold in the Under-16 Team division at the United Dance Organisation Euro Championships.",
    badge: "1st place · gold",
    year: "2024",
    tone: "primary",
    icon: Trophy,
  },
  {
    title: "UKSDC National Finalists",
    body: "Two crews reached the UK Street Dance Championship Grand Finals — top-five placements against the country's best academies.",
    badge: "National finalists",
    year: "2024",
    tone: "primary",
    icon: Medal,
  },
  {
    title: "Blackpool · BDO Winter Gardens",
    body: "Silver and bronze podium finishes on the legendary Blackpool floor — the most prestigious stage in UK competitive dance.",
    badge: "Podium · silver & bronze",
    year: "2023",
    tone: "warning",
    icon: Award,
  },
  {
    title: "UDO British Solo Champion",
    body: "One of our seniors danced solo to the top of the UDO British rankings — Under-14 commercial category, first place.",
    badge: "1st place · solo",
    year: "2025",
    tone: "accent",
    icon: Crown,
  },
  {
    title: "Regional Crew Champions ×6",
    body: "Six regional titles across junior, senior and adult divisions in a single competitive season — a school record.",
    badge: "6× regional titles",
    year: "2024–25",
    tone: "primary",
    icon: Flame,
  },
];

const STATS: { value: number; suffix: string; label: string; icon: LucideIcon; tone: Tone }[] = [
  { value: 38, suffix: "+", label: "Titles won", icon: Trophy, tone: "primary" },
  { value: 60, suffix: "+", label: "Finals reached", icon: Medal, tone: "accent" },
  { value: 120, suffix: "+", label: "Trophies & medals", icon: Award, tone: "warning" },
  { value: 100, suffix: "%", label: "Grade exam pass rate", icon: Star, tone: "primary" },
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

const PODIUM: { place: string; title: string; div: string; tone: Tone }[] = [
  { place: "1st", title: "UDO Euro Champions", div: "U16 team", tone: "accent" },
  { place: "1st", title: "British Solo Champion", div: "U14 commercial", tone: "primary" },
  { place: "2nd", title: "Blackpool Winter Gardens", div: "Senior crew", tone: "warning" },
];

const ACHIEVEMENTS: { icon: LucideIcon; label: string; tone: Tone }[] = [
  { icon: Trophy, label: "1st place · UDO British finals", tone: "warning" },
  { icon: Medal, label: "Top-5 · UKSDC nationals", tone: "primary" },
  { icon: Star, label: "Distinction · Grade 6 commercial", tone: "accent" },
];

/* ──────────────────────────── Page ──────────────────────────── */

const Results = () => {
  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative overflow-hidden px-4 pt-24 pb-16 md:pt-32 md:pb-24">
        <AmbientGlow variant="light" />
        <div className="relative container max-w-7xl text-center">
          <FadeRise>
            <p className="eyebrow mb-5">Results · awards · champions</p>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground">
              <Trophy className="h-4 w-4 text-warning" />
              Essex's most-decorated dance school
            </div>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-7xl">
              We raise <em className="font-serif italic font-normal text-primary">champions</em>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-xl">
              Trophies on the shelf. Titles to our name. National finals reached year on year. When
              families choose The Dance Exclusive, they choose a team that knows how to win — and how
              to make every dancer believe they can.
            </p>
          </FadeRise>
          <FadeRise delay={140}>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/classes/children">
                  <Flame className="mr-2 h-4 w-4" /> Train with champions
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#wall">
                  See the honours <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── The record — stat cards ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-6xl">
          <FadeRise className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
            <div className="mb-5 flex justify-center gap-1 text-warning">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-current" />
              ))}
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              The record speaks
            </h2>
            <p className="mt-4 text-muted-foreground">
              A decade of competing — and winning — at the highest levels of UK street and commercial
              dance.
            </p>
          </FadeRise>

          <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4 md:gap-6" childClassName="h-full">
            {STATS.map((s) => {
              const tone = TONES[s.tone];
              return (
                <Card
                  key={s.label}
                  className="h-full p-6 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg md:p-8"
                >
                  <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-2xl ${tone.tile}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="font-display text-3xl font-bold tabular-nums tracking-tight md:text-4xl">
                    <AnimatedNumber value={s.value} suffix={s.suffix} />
                  </div>
                  <p className="eyebrow mt-2">{s.label}</p>
                </Card>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── The honours wall — refined list ───────────────── */}
      <section id="wall" className="px-4 py-16 md:py-24">
        <div className="container max-w-5xl">
          <FadeRise className="mb-12 max-w-3xl md:mb-16">
            <p className="eyebrow mb-3">The honours wall</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Every title earned <span className="text-accent">on the floor</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From UDO European stages to the boards at Blackpool's Winter Gardens — these are the
              competitions our crews have conquered.
            </p>
          </FadeRise>

          <Stagger className="space-y-4" step={70}>
            {AWARDS.map((a) => {
              const tone = TONES[a.tone];
              return (
                <Card
                  key={a.title}
                  className="flex items-start gap-4 p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg md:p-6"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.tile}`}
                  >
                    <a.icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <h3 className="font-display text-lg font-bold tracking-tight">{a.title}</h3>
                      <Badge variant={a.highlight ? "accent" : tone.badge}>{a.badge}</Badge>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
                  </div>
                  <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-muted-foreground">
                    {a.year}
                  </span>
                </Card>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── This season's podium — title grid ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-6xl">
          <FadeRise className="mb-12 max-w-3xl md:mb-16">
            <p className="eyebrow mb-3">This season's podium</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Gold doesn't happen by accident
            </h2>
          </FadeRise>

          <Stagger className="grid gap-4 md:grid-cols-3 md:gap-6" childClassName="h-full">
            {PODIUM.map((p) => {
              const tone = TONES[p.tone];
              return (
                <Card
                  key={p.title}
                  className="h-full p-8 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`font-display text-5xl font-extrabold tabular-nums tracking-tight md:text-6xl ${tone.text}`}
                    >
                      {p.place}
                    </span>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone.tile}`}
                    >
                      <Trophy className="h-6 w-6" />
                    </div>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-bold tracking-tight">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.div}</p>
                </Card>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── As seen at ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="container max-w-4xl text-center">
          <FadeRise className="mb-10">
            <p className="eyebrow mb-3">As seen at</p>
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-4xl">
              The stages where we compete
            </h2>
          </FadeRise>
          <FadeRise delay={120}>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {BODIES.map((b) => (
                <span
                  key={b}
                  className="rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground"
                >
                  {b}
                </span>
              ))}
            </div>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── Champion testimonial ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-4xl">
          <FadeRise>
            <Card className="p-8 md:p-14">
              <figure>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Quote className="h-6 w-6" />
                </div>
                <blockquote className="font-display text-2xl font-medium leading-[1.3] tracking-tight md:text-3xl">
                  "I joined as a shy nine-year-old who'd never stepped on a stage. Six years later I'm
                  a UDO British Champion. The coaches here didn't just teach me to dance — they taught
                  me to <span className="font-semibold text-accent">win</span>, and to believe I
                  belonged at the top."
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Crown className="h-6 w-6" />
                  </span>
                  <div>
                    <span className="block font-display text-sm font-semibold">Maya T.</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      UDO British solo champion · senior crew captain
                    </span>
                  </div>
                </figcaption>
              </figure>
            </Card>
          </FadeRise>

          {/* Mini achievement strip */}
          <Stagger className="mt-6 grid gap-4 sm:grid-cols-3" childClassName="h-full">
            {ACHIEVEMENTS.map((m) => {
              const tone = TONES[m.tone];
              return (
                <Card key={m.label} className="flex h-full items-center gap-3 p-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone.tile}`}
                  >
                    <m.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">{m.label}</span>
                </Card>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── Final CTA (night band) ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <FadeRise className="container max-w-6xl">
          <div className="dark relative overflow-hidden rounded-3xl bg-background px-6 py-16 text-center text-foreground shadow-soft-xl md:px-12 md:py-24">
            <AmbientGlow variant="night" />
            <div className="relative mx-auto max-w-3xl">
              <div className="mb-6 flex justify-center gap-1 text-warning">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <h2 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                Your name <span className="text-accent">on the trophy</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
                Every champion started with one class. Train alongside title-winning crews and
                coaches who have done it on the biggest stages in the UK.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/classes/children">
                    <Flame className="mr-2 h-4 w-4" /> Train with champions
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Link to="/classes/adult">
                    Adult classes <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </FadeRise>
      </section>
    </div>
  );
};

export default Results;
