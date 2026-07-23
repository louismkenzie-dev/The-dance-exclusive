import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import GrainOverlay from "@/components/immersive/GrainOverlay";
import { Reveal } from "@/components/immersive/Reveal";
import { Marquee } from "@/components/immersive/Marquee";
import { StatCounter } from "@/components/immersive/StatCounter";
import { useMagnetic } from "@/hooks/useMagnetic";

/* ─────────────────────────────────────────────────────────────
   Gallery / Showreel — "In Motion"
   The immersive media wall. No real photography yet, so every
   tile is an intentional stage-lit placeholder ready to receive
   real footage later.
   ──────────────────────────────────────────────────────────── */

type Tone = "blue" | "mag" | "violet";

const TONE: Record<Tone, { hsl: string; light: string; chip: string }> = {
  blue: { hsl: "193 100% 44%", light: "stage-light-blue", chip: "text-primary" },
  mag: { hsl: "330 90% 55%", light: "stage-light-mag", chip: "text-accent" },
  violet: { hsl: "270 75% 62%", light: "stage-light-duo", chip: "text-primary" },
};

type Filter = "all" | "showcase" | "competition" | "studio" | "behind";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "showcase", label: "Showcases" },
  { id: "competition", label: "Competition" },
  { id: "studio", label: "Studio Sessions" },
  { id: "behind", label: "Behind The Scenes" },
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
  { caption: "Competition Day", meta: "UDO · Blackpool", tone: "blue", kind: "photo", cat: "competition", aspect: "aspect-[3/4]" },
  { caption: "Studio Sessions", meta: "Commercial · Seniors", tone: "violet", kind: "photo", cat: "studio", aspect: "aspect-square" },
  { caption: "Heels Class", meta: "Adults · After Dark", tone: "mag", kind: "video", cat: "studio", aspect: "aspect-[3/4]" },
  { caption: "Crew Callout", meta: "Street · Juniors", tone: "blue", kind: "photo", cat: "competition", aspect: "aspect-square" },
  { caption: "Showcase 2025", meta: "Finale · Full Cast", tone: "violet", kind: "photo", cat: "showcase", aspect: "aspect-[4/3]", wide: true },
  { caption: "Behind The Scenes", meta: "Dress Run", tone: "mag", kind: "photo", cat: "behind", aspect: "aspect-[3/4]" },
  { caption: "Studio Sessions", meta: "Tots · First Steps", tone: "blue", kind: "photo", cat: "studio", aspect: "aspect-square" },
  { caption: "Competition Day", meta: "Nation's Best Crew", tone: "mag", kind: "video", cat: "competition", aspect: "aspect-[4/5]" },
  { caption: "Behind The Scenes", meta: "Glam · Backstage", tone: "violet", kind: "photo", cat: "behind", aspect: "aspect-square" },
  { caption: "Showcase 2025", meta: "Solo Spotlight", tone: "blue", kind: "video", cat: "showcase", aspect: "aspect-[3/4]" },
  { caption: "Studio Sessions", meta: "Choreo Lab", tone: "mag", kind: "photo", cat: "studio", aspect: "aspect-[4/3]", wide: true },
];

const STATS = [
  { value: 1200, suffix: "+", label: "Moments Captured" },
  { value: 48, suffix: "", label: "Routines Filmed" },
  { value: 14, suffix: "", label: "Trophy Days" },
  { value: 25, suffix: "k", label: "Views & Counting" },
];

const KindIcon = ({ kind }: { kind: Tile["kind"] }) =>
  kind === "video" ? <Play className="w-5 h-5" /> : <Camera className="w-5 h-5" />;

const Gallery = () => {
  const [active, setActive] = useState<Filter>("all");
  const magReel = useMagnetic<HTMLDivElement>(0.2);
  const magCta = useMagnetic<HTMLDivElement>(0.22);

  const shown = TILES.map((t) => ({
    ...t,
    dim: active !== "all" && t.cat !== active,
  }));

  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────────── HERO ───────────────── */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-duo" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent,hsl(220_20%_4%)_78%)]" />
        <GrainOverlay />

        <span
          aria-hidden
          className="pointer-events-none select-none absolute inset-x-0 top-[18%] text-center font-display font-bold text-[24vw] leading-none text-stroke-faint tracking-tighter"
        >
          REEL
        </span>

        <div className="relative z-10 max-w-3xl animate-fade-in">
          <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-5 inline-flex items-center gap-2">
            <Clapperboard className="w-4 h-4" /> The Gallery
          </p>
          <h1 className="font-display font-bold leading-[0.9] tracking-tight text-[18vw] sm:text-8xl md:text-[9rem]">
            <span className="block">In</span>
            <span className="block text-accent drop-shadow-[0_0_40px_hsl(330_90%_55%/0.4)]">Motion</span>
          </h1>
          <p
            className="mt-7 text-base md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed"
            style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
          >
            Every showcase, every trophy day, every late-night studio session — caught on camera.
            This is The Dance Exclusive after dark, frame by frame.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div ref={magReel} className="inline-block will-change-transform">
              <Button asChild size="lg" className="text-base px-8 py-6 font-semibold uppercase tracking-wider animate-glow-pulse">
                <a href="#showreel">
                  <Play className="w-4 h-4 mr-2" /> Watch The Showreel
                </a>
              </Button>
            </div>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-base px-8 py-6 font-semibold uppercase tracking-wider border-accent/40 text-foreground hover:bg-accent/10"
            >
              <a href="#wall">
                Browse The Wall <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">Scroll</span>
          <div className="w-5 h-8 rounded-full border border-muted-foreground/30 flex justify-center pt-1.5">
            <span className="w-1 h-1.5 rounded-full bg-accent animate-scroll-cue" />
          </div>
        </div>
      </section>

      {/* ───────────────── MARQUEE STRIP ───────────────── */}
      <div className="border-y border-border bg-card/40 py-4 text-foreground/90">
        <Marquee
          items={["Showcases", "Competition", "Studio Sessions", "Backstage", "Heels", "Crews", "Solos", "Camps", "After Dark"]}
          speed={38}
          accent="text-accent"
        />
      </div>

      {/* ───────────────── STAT BAND ───────────────── */}
      <section className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue opacity-50" />
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

      {/* ───────────────── THE WALL (masonry) ───────────────── */}
      <section id="wall" className="relative py-24 px-4 overflow-hidden">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(180deg, hsl(220 20% 4%), hsl(220 22% 6%)), radial-gradient(80% 60% at 0% 0%, hsl(193 100% 40% / 0.10), transparent 60%), radial-gradient(80% 60% at 100% 100%, hsl(330 90% 55% / 0.12), transparent 60%)",
          }}
        />
        <GrainOverlay />

        <div className="relative container">
          <Reveal className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">The Gallery Wall</p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">Caught In The Spotlight</h2>
            <p
              className="mt-4 text-muted-foreground"
              style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
            >
              A living wall of our best moments. Filter by the energy you're after — then watch real footage drop
              into every frame.
            </p>
          </Reveal>

          {/* filter pills */}
          <Reveal delay={80}>
            <div className="flex flex-wrap justify-center gap-2.5 mb-12">
              {FILTERS.map((f) => {
                const on = active === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActive(f.id)}
                    className={`px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.18em] border transition-all duration-300 ${
                      on
                        ? "bg-primary/15 border-primary/50 text-primary shadow-[0_0_24px_hsl(193_100%_44%/0.25)]"
                        : "bg-card/50 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </Reveal>

          {/* masonry via CSS columns — varied aspect ratios keep the rhythm */}
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
            {shown.map((t, i) => {
              const tone = TONE[t.tone];
              return (
                <Reveal key={`${t.caption}-${i}`} delay={(i % 3) * 90} className="mb-4 inline-block w-full align-top">
                  <article
                    className={`group relative w-full ${t.aspect} rounded-2xl overflow-hidden border cursor-pointer transition-all duration-500 hover:-translate-y-1.5 ${
                      t.dim ? "opacity-30 saturate-50" : "opacity-100"
                    }`}
                    style={{ borderColor: `hsl(${tone.hsl} / 0.3)` }}
                  >
                    {/* stage-lit fill — stands in for real media */}
                    <div className={`absolute inset-0 ${tone.light} opacity-80`} />
                    <div
                      className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                      style={{
                        background: `radial-gradient(120% 90% at 50% 20%, hsl(${tone.hsl} / 0.35), transparent 60%)`,
                      }}
                    />
                    <GrainOverlay />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/20 to-transparent" />

                    {/* faint giant index for depth */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-3 right-3 font-display font-bold text-7xl leading-none text-stroke-faint opacity-50"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    {/* centred play / camera glyph */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="flex items-center justify-center w-16 h-16 rounded-full border backdrop-blur-sm transition-all duration-500 group-hover:scale-110"
                        style={{
                          background: `hsl(${tone.hsl} / 0.14)`,
                          borderColor: `hsl(${tone.hsl} / 0.5)`,
                          color: `hsl(${tone.hsl})`,
                        }}
                      >
                        <KindIcon kind={t.kind} />
                      </span>
                    </div>

                    {/* hover expand hint */}
                    <span
                      className="absolute top-3 left-3 flex items-center justify-center w-9 h-9 rounded-full bg-background/50 border border-white/10 text-foreground/80 opacity-0 -translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0"
                      aria-hidden
                    >
                      <Maximize2 className="w-4 h-4" />
                    </span>

                    {/* caption */}
                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                      <span className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${tone.chip}`}>
                        {t.kind === "video" ? "Showreel" : "Photo"}
                      </span>
                      <h3 className="font-display text-xl sm:text-2xl mt-1 leading-tight">{t.caption}</h3>
                      <p
                        className="text-xs text-muted-foreground mt-0.5"
                        style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
                      >
                        {t.meta}
                      </p>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>

          <Reveal delay={120} className="text-center mt-12">
            <p
              className="text-sm text-muted-foreground"
              style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
            >
              Real photography and video drops in here as we shoot — bookmark the wall and watch it come alive.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── FEATURED SHOWREEL ───────────────── */}
      <section id="showreel" className="relative py-24 px-4 overflow-hidden border-y border-border">
        <div className="absolute inset-0 stage-light-mag opacity-45" />
        <GrainOverlay />

        <div className="relative container">
          <Reveal className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-3 inline-flex items-center gap-2">
              <Film className="w-4 h-4" /> Featured Showreel
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">The After Dark Reel</h2>
            <p
              className="mt-4 text-muted-foreground"
              style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
            >
              Ninety seconds of pure energy — the routines, the crowds, the lights. The fastest way to feel what a
              class here is really like.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div ref={magReel} className="inline-block w-full will-change-transform">
              <div
                className="group relative w-full aspect-video rounded-3xl overflow-hidden border cursor-pointer"
                style={{ borderColor: "hsl(330 90% 55% / 0.35)" }}
              >
                <div className="absolute inset-0 stage-light-duo" />
                <div
                  className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]"
                  style={{
                    background:
                      "radial-gradient(80% 70% at 50% 25%, hsl(330 90% 55% / 0.3), transparent 60%), radial-gradient(70% 60% at 20% 90%, hsl(193 100% 44% / 0.25), transparent 60%)",
                  }}
                />
                <GrainOverlay />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/30" />

                <span
                  aria-hidden
                  className="pointer-events-none select-none absolute inset-x-0 top-[8%] text-center font-display font-bold text-[16vw] md:text-[10rem] leading-none text-stroke-faint tracking-tighter"
                >
                  TDE
                </span>

                {/* big play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="relative flex items-center justify-center">
                    <span className="absolute w-28 h-28 md:w-36 md:h-36 rounded-full bg-accent/20 animate-glow-pulse" />
                    <span className="relative flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-[hsl(330,90%,55%)] text-white shadow-2xl shadow-[hsl(330,90%,55%)]/40 transition-transform duration-500 group-hover:scale-110">
                      <Play className="w-9 h-9 md:w-11 md:h-11 ml-1 fill-current" />
                    </span>
                  </span>
                </div>

                {/* lower bar */}
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-9 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                      Official Showreel · 2025
                    </span>
                    <h3 className="font-display text-2xl md:text-4xl mt-1">Step In, Stand Out — The Film</h3>
                  </div>
                  <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <Clapperboard className="w-4 h-4" /> 01:32
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* three sub-reel chips */}
          <div className="grid sm:grid-cols-3 gap-4 mt-5">
            {[
              { t: "Showcase Highlights", m: "The After Dark Show", Icon: Sparkles, tone: "mag" as Tone },
              { t: "Competition Reel", m: "Trophy Season", Icon: Trophy, tone: "blue" as Tone },
              { t: "Studio Energy", m: "Behind The Choreo", Icon: Music2, tone: "violet" as Tone },
            ].map(({ t, m, Icon, tone }, i) => {
              const c = TONE[tone];
              return (
                <Reveal key={t} delay={i * 90}>
                  <div
                    className="group relative aspect-[16/9] rounded-2xl overflow-hidden border cursor-pointer transition-transform duration-500 hover:-translate-y-1"
                    style={{ borderColor: `hsl(${c.hsl} / 0.3)` }}
                  >
                    <div className={`absolute inset-0 ${c.light} opacity-75`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    <div
                      className="absolute top-3 right-3 flex items-center justify-center w-10 h-10 rounded-full border backdrop-blur-sm transition-transform duration-500 group-hover:scale-110"
                      style={{ background: `hsl(${c.hsl} / 0.14)`, borderColor: `hsl(${c.hsl} / 0.5)`, color: `hsl(${c.hsl})` }}
                    >
                      <Play className="w-4 h-4 ml-0.5 fill-current" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <Icon className="w-5 h-5 mb-2" style={{ color: `hsl(${c.hsl})` }} />
                      <h4 className="font-display text-lg leading-tight">{t}</h4>
                      <p
                        className="text-xs text-muted-foreground"
                        style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
                      >
                        {m}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────── SOCIAL FOLLOW STRIP ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue opacity-55" />
        <GrainOverlay />

        <div className="relative container">
          <div className="rounded-3xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden">
            <div className="grid lg:grid-cols-[1.1fr_1fr]">
              {/* copy side */}
              <div className="p-9 md:p-12 flex flex-col justify-center">
                <Reveal>
                  <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3 inline-flex items-center gap-2">
                    <Instagram className="w-4 h-4" /> @thedanceexclusive
                  </p>
                  <h2 className="font-display font-bold text-4xl md:text-5xl leading-[0.95]">
                    Follow The <span className="text-accent">Movement</span>
                  </h2>
                  <p
                    className="mt-4 text-muted-foreground max-w-md"
                    style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
                  >
                    New reels every week — class clips, trophy moments and behind-the-scenes chaos. Tag us in your
                    videos and you might just land on the wall.
                  </p>

                  <div className="flex items-center gap-8 mt-7">
                    <div>
                      <div className="font-display font-bold text-3xl text-primary">
                        <StatCounter value={8} suffix="k+" />
                      </div>
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mt-1">Followers</div>
                    </div>
                    <div className="h-10 w-px bg-border" />
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Users className="w-4 h-4 text-accent" /> A proper Essex dance fam
                    </div>
                  </div>

                  <div ref={magCta} className="inline-block mt-8 will-change-transform">
                    <Button
                      asChild
                      size="lg"
                      className="px-8 py-6 text-base font-semibold uppercase tracking-wider bg-[hsl(330,90%,55%)] text-white hover:bg-[hsl(330,90%,60%)] shadow-lg shadow-[hsl(330,90%,55%)]/30"
                    >
                      <a href="https://instagram.com/thedanceexclusive" target="_blank" rel="noreferrer">
                        <Instagram className="w-4 h-4 mr-2" /> Follow Us
                      </a>
                    </Button>
                  </div>
                </Reveal>
              </div>

              {/* mini insta grid */}
              <div className="relative grid grid-cols-3 gap-1.5 p-1.5 bg-background/30 border-t lg:border-t-0 lg:border-l border-border">
                {(["mag", "blue", "violet", "blue", "violet", "mag", "violet", "mag", "blue"] as Tone[]).map((tn, i) => {
                  const c = TONE[tn];
                  return (
                    <div
                      key={i}
                      className="group relative aspect-square rounded-md overflow-hidden cursor-pointer"
                    >
                      <div className={`absolute inset-0 ${c.light} opacity-80 transition-transform duration-500 group-hover:scale-110`} />
                      <div className="absolute inset-0 bg-background/20 transition-colors duration-300 group-hover:bg-background/0" />
                      <span
                        className="absolute inset-0 flex items-center justify-center text-foreground/0 transition-colors duration-300 group-hover:text-foreground"
                        aria-hidden
                      >
                        <Instagram className="w-5 h-5" />
                      </span>
                      <ArrowUpRight className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── FINAL CTA ───────────────── */}
      <section className="relative py-28 px-4 text-center overflow-hidden border-t border-border">
        <div className="absolute inset-0 stage-light-duo" />
        <GrainOverlay />
        <Reveal className="relative max-w-3xl mx-auto">
          <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-4 inline-flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Your Turn
          </p>
          <h2 className="font-display font-bold text-5xl md:text-8xl leading-[0.95]">
            Get In <span className="text-accent">Frame</span>
          </h2>
          <p
            className="mt-5 text-muted-foreground text-lg"
            style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
          >
            The next showreel needs you in it. Book a class, hit the studio and step into the spotlight.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="px-9 py-6 text-base font-semibold uppercase tracking-wider">
              <Link to="/classes/children">
                <Sparkles className="w-4 h-4 mr-2" /> Children's Classes
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="px-9 py-6 text-base font-semibold uppercase tracking-wider border-accent/40 text-foreground hover:bg-accent/10"
            >
              <Link to="/classes/adult">
                Adult Classes <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
};

export default Gallery;
