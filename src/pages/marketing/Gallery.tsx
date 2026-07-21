import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Play,
  Camera,
  Film,
  Trophy,
  Sparkles,
  Music2,
  Users,
  Instagram,
  ArrowRight,
  ArrowUpRight,
  Maximize2,
  Calendar,
  Clapperboard,
} from "lucide-react";
import { FadeRise, Stagger, AnimatedNumber, AmbientGlow } from "@/components/motion";

/* ─────────────────────────────────────────────────────────────
   Gallery / Showreel — "In motion"
   The media wall. No real photography yet, so every tile is an
   art-directed gradient placeholder ready to receive real
   footage later.
   ──────────────────────────────────────────────────────────── */

type Tone = "blue" | "mag" | "violet";

const TONE: Record<Tone, { grad: string; text: string }> = {
  blue: { grad: "from-primary/15 via-secondary/60 to-primary/5", text: "text-primary" },
  mag: { grad: "from-accent/15 via-secondary/60 to-accent/5", text: "text-accent" },
  violet: { grad: "from-primary/12 via-secondary/50 to-accent/12", text: "text-primary" },
};

type Filter = "all" | "showcase" | "competition" | "studio" | "behind";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "showcase", label: "Showcases" },
  { id: "competition", label: "Competition" },
  { id: "studio", label: "Studio sessions" },
  { id: "behind", label: "Behind the scenes" },
];

type Tile = {
  caption: string;
  meta: string;
  tone: Tone;
  kind: "video" | "photo";
  cat: Exclude<Filter, "all">;
  /** tailwind aspect helper — drives the masonry rhythm */
  aspect: string;
  /** spans two columns on lg for hero tiles */
  wide?: boolean;
};

const TILES: Tile[] = [
  { caption: "Showcase 2025", meta: "The After Dark Show", tone: "mag", kind: "video", cat: "showcase", aspect: "aspect-[4/5]", wide: true },
  { caption: "Competition day", meta: "UDO · Blackpool", tone: "blue", kind: "photo", cat: "competition", aspect: "aspect-[3/4]" },
  { caption: "Studio sessions", meta: "Commercial · Seniors", tone: "violet", kind: "photo", cat: "studio", aspect: "aspect-square" },
  { caption: "Heels class", meta: "Adults · After Dark", tone: "mag", kind: "video", cat: "studio", aspect: "aspect-[3/4]" },
  { caption: "Crew callout", meta: "Street · Juniors", tone: "blue", kind: "photo", cat: "competition", aspect: "aspect-square" },
  { caption: "Showcase 2025", meta: "Finale · Full cast", tone: "violet", kind: "photo", cat: "showcase", aspect: "aspect-[4/3]", wide: true },
  { caption: "Behind the scenes", meta: "Dress run", tone: "mag", kind: "photo", cat: "behind", aspect: "aspect-[3/4]" },
  { caption: "Studio sessions", meta: "Tots · First steps", tone: "blue", kind: "photo", cat: "studio", aspect: "aspect-square" },
  { caption: "Competition day", meta: "Nation's Best Crew", tone: "mag", kind: "video", cat: "competition", aspect: "aspect-[4/5]" },
  { caption: "Behind the scenes", meta: "Glam · Backstage", tone: "violet", kind: "photo", cat: "behind", aspect: "aspect-square" },
  { caption: "Showcase 2025", meta: "Solo spotlight", tone: "blue", kind: "video", cat: "showcase", aspect: "aspect-[3/4]" },
  { caption: "Studio sessions", meta: "Choreo lab", tone: "mag", kind: "photo", cat: "studio", aspect: "aspect-[4/3]", wide: true },
];

const CATEGORIES = [
  "Showcases",
  "Competition",
  "Studio sessions",
  "Backstage",
  "Heels",
  "Crews",
  "Solos",
  "Camps",
  "After Dark",
];

const STATS = [
  { value: 1200, suffix: "+", label: "Moments captured" },
  { value: 48, suffix: "", label: "Routines filmed" },
  { value: 14, suffix: "", label: "Trophy days" },
  { value: 25, suffix: "k", label: "Views & counting" },
];

const SUB_REELS = [
  { t: "Showcase highlights", m: "The After Dark Show", Icon: Sparkles, tone: "mag" as Tone },
  { t: "Competition reel", m: "Trophy season", Icon: Trophy, tone: "blue" as Tone },
  { t: "Studio energy", m: "Behind the choreo", Icon: Music2, tone: "violet" as Tone },
];

const KindIcon = ({ kind }: { kind: Tile["kind"] }) =>
  kind === "video" ? <Play className="h-5 w-5" /> : <Camera className="h-5 w-5" />;

const Gallery = () => {
  const [active, setActive] = useState<Filter>("all");

  const shown = TILES.map((t) => ({
    ...t,
    dim: active !== "all" && t.cat !== active,
  }));

  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative overflow-hidden px-4 pt-24 pb-16 md:pt-32 md:pb-24">
        <AmbientGlow variant="duo" />
        <div className="relative container max-w-7xl text-center">
          <FadeRise>
            <p className="eyebrow mb-5 inline-flex items-center gap-2">
              <Clapperboard className="h-4 w-4" /> The gallery
            </p>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-7xl">
              In <em className="font-serif italic font-normal text-accent">motion</em>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-xl">
              Every showcase, every trophy day, every late-night studio session — caught on camera.
              This is The Dance Exclusive after dark, frame by frame.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg">
                <a href="#showreel">
                  <Play className="mr-2 h-4 w-4" /> Watch the showreel
                </a>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href="#wall">
                  Browse the wall <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </FadeRise>

          {/* Category strip */}
          <FadeRise delay={140}>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
              {CATEGORIES.map((label) => (
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

      {/* ───────────────── Stat band ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-20">
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

      {/* ───────────────── The wall (masonry) ───────────────── */}
      <section id="wall" className="px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <FadeRise className="mx-auto mb-10 max-w-2xl text-center">
            <p className="eyebrow mb-3">The gallery wall</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Caught in the spotlight
            </h2>
            <p className="mt-4 text-muted-foreground">
              A living wall of our best moments. Filter by the energy you're after — then watch real
              footage drop into every frame.
            </p>
          </FadeRise>

          {/* Filter pills */}
          <FadeRise delay={80}>
            <div className="mb-12 flex flex-wrap justify-center gap-2">
              {FILTERS.map((f) => {
                const on = active === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActive(f.id)}
                    className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 ease-out ${
                      on
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </FadeRise>

          {/* Masonry via CSS columns — varied aspect ratios keep the rhythm */}
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [column-fill:_balance]">
            {shown.map((t, i) => {
              const tone = TONE[t.tone];
              return (
                <FadeRise key={`${t.caption}-${i}`} delay={(i % 3) * 90} className="mb-4 inline-block w-full align-top">
                  <article
                    className={`group relative w-full ${t.aspect} cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-br ${tone.grad} shadow-soft transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-soft-lg ${
                      t.dim ? "opacity-30 saturate-50" : "opacity-100"
                    }`}
                  >
                    {/* Art-directed gradient fill — stands in for real media */}
                    <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                    </div>

                    {/* Tile index */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-4 right-4 font-display text-xs font-semibold tabular-nums text-foreground/30"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    {/* Centred play / camera glyph */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className={`flex h-14 w-14 items-center justify-center rounded-full bg-card/80 shadow-soft backdrop-blur-sm transition-transform duration-300 ease-out group-hover:scale-105 ${tone.text}`}
                      >
                        <KindIcon kind={t.kind} />
                      </span>
                    </div>

                    {/* Hover expand hint */}
                    <span
                      className="absolute top-3 left-3 flex h-9 w-9 -translate-y-1 items-center justify-center rounded-full bg-card/80 text-muted-foreground opacity-0 shadow-soft backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                      aria-hidden
                    >
                      <Maximize2 className="h-4 w-4" />
                    </span>

                    {/* Caption */}
                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                      <span className={`text-[11px] font-semibold ${tone.text}`}>
                        {t.kind === "video" ? "Showreel" : "Photo"}
                      </span>
                      <h3 className="mt-1 font-display text-xl font-bold leading-tight tracking-tight">
                        {t.caption}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.meta}</p>
                    </div>
                  </article>
                </FadeRise>
              );
            })}
          </div>

          <FadeRise delay={120} className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Real photography and video drops in here as we shoot — bookmark the wall and watch it
              come alive.
            </p>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── Featured showreel (night band) ───────────────── */}
      <section id="showreel" className="px-4 py-8 md:py-12">
        <FadeRise className="container max-w-7xl">
          <div className="dark relative overflow-hidden rounded-3xl bg-background p-6 text-foreground shadow-soft-xl md:p-12">
            <AmbientGlow variant="night" />
            <div className="relative">
              <div className="mx-auto mb-10 max-w-2xl text-center md:mb-12">
                <p className="eyebrow mb-3 inline-flex items-center gap-2">
                  <Film className="h-4 w-4" /> Featured showreel
                </p>
                <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
                  The After Dark Reel
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Ninety seconds of pure energy — the routines, the crowds, the lights. The fastest
                  way to feel what a class here is really like.
                </p>
              </div>

              <div className="group relative aspect-video w-full cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-br from-accent/20 via-card to-primary/15 shadow-soft-lg">
                <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.02]">
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                </div>

                {/* Big play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-soft-xl transition-transform duration-300 ease-out group-hover:scale-105 md:h-24 md:w-24">
                    <Play className="ml-1 h-9 w-9 fill-current md:h-11 md:w-11" />
                  </span>
                </div>

                {/* Lower bar */}
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-6 md:p-9">
                  <div>
                    <span className="text-xs font-semibold text-accent">Official showreel · 2025</span>
                    <h3 className="mt-1 font-display text-2xl font-bold tracking-tight md:text-4xl">
                      Move different — the film
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-2 text-xs font-medium tabular-nums text-muted-foreground">
                    <Clapperboard className="h-4 w-4" /> 01:32
                  </span>
                </div>
              </div>

              {/* Three sub-reel chips */}
              <Stagger className="mt-5 grid gap-4 sm:grid-cols-3" childClassName="h-full">
                {SUB_REELS.map(({ t, m, Icon, tone }) => {
                  const c = TONE[tone];
                  return (
                    <div
                      key={t}
                      className={`group relative aspect-[16/9] cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br ${c.grad} shadow-soft transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-soft-lg`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                      <span
                        className={`absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-card/70 shadow-soft backdrop-blur-sm transition-transform duration-300 ease-out group-hover:scale-105 ${c.text}`}
                      >
                        <Play className="ml-0.5 h-4 w-4 fill-current" />
                      </span>
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <Icon className={`mb-2 h-5 w-5 ${c.text}`} />
                        <h4 className="font-display text-lg font-bold leading-tight tracking-tight">{t}</h4>
                        <p className="text-xs text-muted-foreground">{m}</p>
                      </div>
                    </div>
                  );
                })}
              </Stagger>
            </div>
          </div>
        </FadeRise>
      </section>

      {/* ───────────────── Social follow strip ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <FadeRise className="container max-w-6xl">
          <Card className="overflow-hidden">
            <div className="grid lg:grid-cols-[1.1fr_1fr]">
              {/* Copy side */}
              <div className="flex flex-col justify-center p-8 md:p-12">
                <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-accent">
                  <Instagram className="h-4 w-4" /> @thedanceexclusive
                </p>
                <h2 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-5xl">
                  Follow the <span className="text-accent">movement</span>
                </h2>
                <p className="mt-4 max-w-md text-muted-foreground">
                  New reels every week — class clips, trophy moments and behind-the-scenes chaos.
                  Tag us in your videos and you might just land on the wall.
                </p>

                <div className="mt-7 flex items-center gap-8">
                  <div>
                    <div className="font-display text-3xl font-bold tabular-nums tracking-tight text-primary">
                      <AnimatedNumber value={8} suffix="k+" />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Followers</div>
                  </div>
                  <div className="h-10 w-px bg-border/60" />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4 text-accent" /> A proper Essex dance fam
                  </div>
                </div>

                <div className="mt-8">
                  <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <a href="https://instagram.com/thedanceexclusive" target="_blank" rel="noreferrer">
                      <Instagram className="mr-2 h-4 w-4" /> Follow us
                    </a>
                  </Button>
                </div>
              </div>

              {/* Mini insta grid */}
              <div className="grid grid-cols-3 gap-2 bg-secondary/40 p-2">
                {(["mag", "blue", "violet", "blue", "violet", "mag", "violet", "mag", "blue"] as Tone[]).map(
                  (tn, i) => {
                    const c = TONE[tn];
                    return (
                      <div key={i} className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl">
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${c.grad} transition-transform duration-500 ease-out group-hover:scale-105`}
                        />
                        <span
                          className="absolute inset-0 flex items-center justify-center text-foreground/0 transition-colors duration-300 group-hover:text-foreground"
                          aria-hidden
                        >
                          <Instagram className="h-5 w-5" />
                        </span>
                        <ArrowUpRight className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </Card>
        </FadeRise>
      </section>

      {/* ───────────────── Final CTA (night band) ───────────────── */}
      <section className="px-4 pb-16 md:pb-24">
        <FadeRise className="container max-w-6xl">
          <div className="dark relative overflow-hidden rounded-3xl bg-background px-6 py-16 text-center text-foreground shadow-soft-xl md:px-12 md:py-24">
            <AmbientGlow variant="duo" />
            <div className="relative mx-auto max-w-3xl">
              <p className="eyebrow mb-4 inline-flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Your turn
              </p>
              <h2 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                Get in <span className="text-accent">frame</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
                The next showreel needs you in it. Book a class, hit the studio and step into the
                spotlight.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/classes/children">
                    <Sparkles className="mr-2 h-4 w-4" /> Children's classes
                  </Link>
                </Button>
                <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Link to="/classes/adult">
                    Adult classes <ArrowRight className="ml-2 h-4 w-4" />
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

export default Gallery;
