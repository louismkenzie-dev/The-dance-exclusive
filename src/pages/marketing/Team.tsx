import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Users,
  ShieldCheck,
  HeartHandshake,
  GraduationCap,
  Sparkles,
  Trophy,
  Music2,
  User,
  BadgeCheck,
  Megaphone,
} from "lucide-react";
import GrainOverlay from "@/components/immersive/GrainOverlay";
import { Reveal } from "@/components/immersive/Reveal";
import { Marquee } from "@/components/immersive/Marquee";
import { StatCounter } from "@/components/immersive/StatCounter";
import { useMagnetic } from "@/hooks/useMagnetic";

/** Alternating stage-light accents — odd cards blue, even cards magenta. */
const BLUE = "193 100% 44%";
const MAGENTA = "330 90% 55%";

type Instructor = {
  name: string;
  initials: string;
  credit: string;
  tags: string[];
  bio: string;
};

const INSTRUCTORS: Instructor[] = [
  {
    name: "Jade Okafor",
    initials: "JO",
    credit: "Artistic Director · Commercial Coach",
    tags: ["Commercial", "Street", "Choreography"],
    bio: "Founder and driving force of TDE. Seven years building championship crews and the sharpest commercial routines in Essex.",
  },
  {
    name: "Marcus Bonetti",
    initials: "MB",
    credit: "Head of Street · Competition Coach",
    tags: ["Hip-Hop", "Breaking", "Battles"],
    bio: "Battle-tested freestyler turned coach. Marcus drills foundations hard then sets dancers loose to find their own swagger.",
  },
  {
    name: "Priya Sandhu",
    initials: "PS",
    credit: "Heels Lead · Performance Director",
    tags: ["Heels", "Commercial", "Stage Craft"],
    bio: "Brings West End polish to our adult heels floor — power, attitude and technique with absolutely zero judgement.",
  },
  {
    name: "Callum Fraser",
    initials: "CF",
    credit: "Juniors Specialist · Choreographer",
    tags: ["Street", "Kids", "Routines"],
    bio: "A natural with our younger crews. Callum turns first-class nerves into stage-ready confidence faster than anyone.",
  },
  {
    name: "Niamh O'Reilly",
    initials: "NO",
    credit: "Ballet & Conditioning · Technique Coach",
    tags: ["Ballet", "Contemporary", "Strength"],
    bio: "Classically trained and obsessed with clean lines. Niamh gives every dancer the technical backbone to go further.",
  },
  {
    name: "Theo Adeyemi",
    initials: "TA",
    credit: "Commercial Coach · Showcase Director",
    tags: ["Commercial", "Locking", "Performance"],
    bio: "The energy in the room. Theo choreographs our biggest showcase numbers and makes sure every dancer hits the spotlight.",
  },
  {
    name: "Lola Hartley",
    initials: "LH",
    credit: "Tots & Foundations · Early Years Lead",
    tags: ["Tots", "Rhythm", "Play"],
    bio: "Where it all begins. Lola makes the very first steps pure joy — rhythm, smiles and a lifelong love of movement.",
  },
  {
    name: "Devon Walsh",
    initials: "DW",
    credit: "Seniors Coach · Competition Choreographer",
    tags: ["Commercial", "Street", "Competition"],
    bio: "Sharp, demanding and fiercely proud of his teams. Devon prepares our seniors for the biggest competitive stages.",
  },
];

const TRUST = [
  {
    Icon: ShieldCheck,
    title: "DBS-Checked",
    copy: "Every single instructor holds an enhanced DBS certificate, renewed and on file.",
  },
  {
    Icon: BadgeCheck,
    title: "Fully Insured",
    copy: "Comprehensive public liability cover across all five of our Essex venues.",
  },
  {
    Icon: HeartHandshake,
    title: "Safeguarding-Trained",
    copy: "Designated safeguarding leads with up-to-date child-protection training.",
  },
  {
    Icon: GraduationCap,
    title: "Qualified Coaches",
    copy: "First-aid certified, dance-qualified professionals who never stop learning.",
  },
];

const Team = () => {
  const magJoin = useMagnetic<HTMLDivElement>(0.22);

  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────────── HERO ───────────────── */}
      <section className="relative min-h-[64vh] flex flex-col justify-center px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-duo opacity-80" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent,hsl(220_20%_4%)_78%)]" />
        <GrainOverlay />

        <span
          aria-hidden
          className="pointer-events-none select-none absolute inset-x-0 top-[20%] text-center font-display font-bold text-[24vw] leading-none text-stroke-faint tracking-tighter"
        >
          CREW
        </span>

        <div className="relative z-10 container animate-fade-in">
          <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-4">
            The People Behind The Movement
          </p>
          <h1 className="font-display font-bold leading-[0.92] tracking-tight text-[16vw] sm:text-7xl md:text-[7.5rem]">
            <span className="block">Meet the</span>
            <span className="block text-accent drop-shadow-[0_0_40px_hsl(330_90%_55%/0.35)]">
              Crew
            </span>
          </h1>
          <p
            className="mt-7 text-base md:text-xl text-muted-foreground max-w-2xl leading-relaxed"
            style={{ fontFamily: "var(--font-body)", textTransform: "none", letterSpacing: "normal" }}
          >
            Award-winning choreographers, battle-tested coaches and the warmest
            faces in Essex dance. Every one of them DBS-checked, insured and
            here for one reason — to help you move different.
          </p>
        </div>
      </section>

      {/* ───────────────── MARQUEE STRIP ───────────────── */}
      <div className="border-y border-border bg-card/40 py-4 text-foreground/90">
        <Marquee
          items={[
            "Choreographers",
            "Competition Coaches",
            "Heels Specialists",
            "Street Originators",
            "Ballet Technicians",
            "Showcase Directors",
            "Mentors",
          ]}
          speed={40}
          accent="text-accent"
        />
      </div>

      {/* ───────────────── INSTRUCTOR GRID ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue opacity-50" />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="max-w-2xl mb-14">
            <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              The Roster
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">
              Coaches Who Push You Further
            </h2>
            <p
              className="mt-4 text-muted-foreground"
              style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
            >
              From your child's first wobble to a championship-level routine —
              this is the team that takes you there.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {INSTRUCTORS.map((p, i) => {
              const tint = i % 2 === 0 ? BLUE : MAGENTA;
              return (
                <Reveal key={p.name} delay={(i % 4) * 90}>
                  <article
                    className="group relative h-full rounded-2xl border bg-card/60 backdrop-blur-sm p-5 transition-all duration-500 hover:-translate-y-2 overflow-hidden"
                    style={{ borderColor: `hsl(${tint} / 0.3)` }}
                  >
                    {/* hover glow */}
                    <div
                      className="absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none"
                      style={{ boxShadow: `0 24px 60px -18px hsl(${tint} / 0.55)` }}
                    />
                    <div
                      className="absolute -top-20 -right-16 w-44 h-44 rounded-full blur-3xl opacity-30 transition-opacity duration-500 group-hover:opacity-70 pointer-events-none"
                      style={{ background: `hsl(${tint} / 0.5)` }}
                    />

                    <div className="relative">
                      {/* portrait placeholder */}
                      <div
                        className="relative aspect-[4/5] w-full rounded-xl border overflow-hidden flex flex-col items-center justify-center gap-3 mb-5"
                        style={{
                          borderColor: `hsl(${tint} / 0.25)`,
                          background: `linear-gradient(160deg, hsl(${tint} / 0.18), hsl(220 22% 7%) 70%)`,
                        }}
                      >
                        <div
                          className="w-16 h-16 rounded-full border flex items-center justify-center font-display font-bold text-2xl"
                          style={{
                            color: `hsl(${tint})`,
                            borderColor: `hsl(${tint} / 0.4)`,
                            background: `hsl(${tint} / 0.12)`,
                          }}
                        >
                          {p.initials}
                        </div>
                        <User
                          className="w-7 h-7 opacity-40"
                          style={{ color: `hsl(${tint})` }}
                          aria-hidden
                        />
                        <span className="absolute bottom-2 inset-x-0 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
                          Portrait
                        </span>
                      </div>

                      <h3 className="font-display text-2xl leading-tight">{p.name}</h3>
                      <p
                        className="mt-1 text-xs uppercase tracking-[0.15em]"
                        style={{ color: `hsl(${tint})` }}
                      >
                        {p.credit}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] uppercase tracking-[0.12em] px-2.5 py-1 rounded-full border font-semibold"
                            style={{
                              color: `hsl(${tint})`,
                              borderColor: `hsl(${tint} / 0.3)`,
                              background: `hsl(${tint} / 0.08)`,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>

                      <p
                        className="mt-4 text-sm text-muted-foreground"
                        style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
                      >
                        {p.bio}
                      </p>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────── STAT BAND ───────────────── */}
      <section className="relative py-20 px-4 overflow-hidden border-y border-border">
        <div className="absolute inset-0 stage-light-mag opacity-40" />
        <div className="relative container grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 14, suffix: "", label: "Pro Coaches", Icon: Users },
            { value: 100, suffix: "%", label: "DBS-Checked", Icon: ShieldCheck },
            { value: 30, suffix: "+", label: "Comp Titles Coached", Icon: Trophy },
            { value: 5, suffix: "", label: "Essex Venues", Icon: Music2 },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <s.Icon className="w-6 h-6 mx-auto mb-3 text-accent" aria-hidden />
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

      {/* ───────────────── TRUST BAND ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(180deg, hsl(220 20% 4%), hsl(220 22% 6%)), radial-gradient(80% 60% at 0% 0%, hsl(193 100% 40% / 0.10), transparent 60%), radial-gradient(80% 60% at 100% 100%, hsl(330 90% 55% / 0.12), transparent 60%)",
          }}
        />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-[0.2em] mb-6">
              <ShieldCheck className="w-4 h-4" />
              Safe Hands, Always
            </div>
            <h2 className="font-display font-bold text-4xl md:text-6xl">
              DBS-Checked, Insured &amp; Safeguarding-Trained
            </h2>
            <p
              className="mt-4 text-muted-foreground"
              style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
            >
              The fun is non-negotiable — and so is your peace of mind. Every
              coach on our team meets the same high bar before they ever step
              into the studio.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TRUST.map(({ Icon, title, copy }, i) => (
              <Reveal key={title} delay={i * 90}>
                <div className="h-full rounded-2xl border border-border bg-card/60 p-7 transition-colors hover:border-primary/40">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-xl mb-2">{title}</h3>
                  <p
                    className="text-sm text-muted-foreground"
                    style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
                  >
                    {copy}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── JOIN THE TEAM CTA ───────────────── */}
      <section className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-duo" />
        <GrainOverlay />
        <div className="relative container grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/40 bg-accent/10 text-accent text-xs font-semibold uppercase tracking-[0.2em] mb-6">
              <Megaphone className="w-4 h-4" />
              We're Hiring
            </div>
            <h2 className="font-display font-bold text-4xl md:text-7xl leading-[0.95]">
              Think You've Got <span className="text-accent">It?</span>
            </h2>
            <p
              className="mt-5 text-muted-foreground text-lg max-w-xl"
              style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
            >
              We're always on the lookout for coaches who bring energy,
              technique and heart. Street, commercial, heels or ballet — if you
              live to put dancers on stage, we want to hear from you.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-4">
              <div ref={magJoin} className="inline-block will-change-transform">
                <Button
                  asChild
                  size="lg"
                  className="px-9 py-6 text-base font-semibold uppercase tracking-wider bg-[hsl(330,90%,55%)] text-white hover:bg-[hsl(330,90%,60%)] shadow-lg shadow-[hsl(330,90%,55%)]/30"
                >
                  <Link to="/contact">
                    <Sparkles className="w-4 h-4 mr-2" /> Join the Team
                  </Link>
                </Button>
              </div>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="px-9 py-6 text-base font-semibold uppercase tracking-wider border-primary/40 text-foreground hover:bg-primary/10"
              >
                <Link to="/about">
                  Our Story <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="grid gap-4">
              {[
                {
                  Icon: Trophy,
                  title: "Coach Championship Crews",
                  copy: "Lead routines that compete — and win — on the biggest UK stages.",
                  tint: BLUE,
                },
                {
                  Icon: HeartHandshake,
                  title: "A Proper Family",
                  copy: "Supportive, ambitious team culture with real progression.",
                  tint: MAGENTA,
                },
                {
                  Icon: Users,
                  title: "Shape Young Talent",
                  copy: "From tots to seniors across five thriving Essex venues.",
                  tint: BLUE,
                },
              ].map(({ Icon, title, copy, tint }) => (
                <div
                  key={title}
                  className="group flex gap-4 rounded-2xl border bg-card/60 backdrop-blur-sm p-5 transition-all duration-500 hover:-translate-y-1"
                  style={{ borderColor: `hsl(${tint} / 0.3)` }}
                >
                  <div
                    className="shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center"
                    style={{
                      color: `hsl(${tint})`,
                      borderColor: `hsl(${tint} / 0.35)`,
                      background: `hsl(${tint} / 0.1)`,
                    }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl">{title}</h3>
                    <p
                      className="text-sm text-muted-foreground mt-1"
                      style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
                    >
                      {copy}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default Team;
