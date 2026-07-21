import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  Users,
  ShieldCheck,
  HeartHandshake,
  GraduationCap,
  Sparkles,
  Trophy,
  Music2,
  BadgeCheck,
  Megaphone,
} from "lucide-react";
import { FadeRise, Stagger, AnimatedNumber, AmbientGlow } from "@/components/motion";

type Instructor = {
  name: string;
  initials: string;
  credit: string;
  /** children = blue (primary), adult = magenta (accent) */
  specialism: "children" | "adult";
  tags: string[];
  bio: string;
};

/** Soft tinted avatar + credit colour per specialism — token classes only. */
const TONES = {
  children: {
    avatar: "bg-gradient-to-br from-primary/15 to-primary/5 text-primary",
    credit: "text-primary",
  },
  adult: {
    avatar: "bg-gradient-to-br from-accent/15 to-accent/5 text-accent",
    credit: "text-accent",
  },
} as const;

const INSTRUCTORS: Instructor[] = [
  {
    name: "Jade Okafor",
    initials: "JO",
    credit: "Artistic director · Commercial coach",
    specialism: "children",
    tags: ["Commercial", "Street", "Choreography"],
    bio: "Founder and driving force of TDE. Ten years building championship crews and the sharpest commercial routines in Essex.",
  },
  {
    name: "Marcus Bonetti",
    initials: "MB",
    credit: "Head of street · Competition coach",
    specialism: "adult",
    tags: ["Hip-hop", "Breaking", "Battles"],
    bio: "Battle-tested freestyler turned coach. Marcus drills foundations hard then sets dancers loose to find their own swagger.",
  },
  {
    name: "Priya Sandhu",
    initials: "PS",
    credit: "Heels lead · Performance director",
    specialism: "adult",
    tags: ["Heels", "Commercial", "Stage craft"],
    bio: "Brings West End polish to our adult heels floor — power, attitude and technique with absolutely zero judgement.",
  },
  {
    name: "Callum Fraser",
    initials: "CF",
    credit: "Juniors specialist · Choreographer",
    specialism: "children",
    tags: ["Street", "Kids", "Routines"],
    bio: "A natural with our younger crews. Callum turns first-class nerves into stage-ready confidence faster than anyone.",
  },
  {
    name: "Niamh O'Reilly",
    initials: "NO",
    credit: "Ballet & conditioning · Technique coach",
    specialism: "children",
    tags: ["Ballet", "Contemporary", "Strength"],
    bio: "Classically trained and obsessed with clean lines. Niamh gives every dancer the technical backbone to go further.",
  },
  {
    name: "Theo Adeyemi",
    initials: "TA",
    credit: "Commercial coach · Showcase director",
    specialism: "adult",
    tags: ["Commercial", "Locking", "Performance"],
    bio: "The energy in the room. Theo choreographs our biggest showcase numbers and makes sure every dancer hits the spotlight.",
  },
  {
    name: "Lola Hartley",
    initials: "LH",
    credit: "Tots & foundations · Early years lead",
    specialism: "children",
    tags: ["Tots", "Rhythm", "Play"],
    bio: "Where it all begins. Lola makes the very first steps pure joy — rhythm, smiles and a lifelong love of movement.",
  },
  {
    name: "Devon Walsh",
    initials: "DW",
    credit: "Seniors coach · Competition choreographer",
    specialism: "adult",
    tags: ["Commercial", "Street", "Competition"],
    bio: "Sharp, demanding and fiercely proud of his teams. Devon prepares our seniors for the biggest competitive stages.",
  },
];

const SPECIALTIES = [
  "Choreographers",
  "Competition coaches",
  "Heels specialists",
  "Street originators",
  "Ballet technicians",
  "Showcase directors",
  "Mentors",
];

const STATS = [
  { value: 14, suffix: "", label: "Pro coaches", Icon: Users, tile: "bg-primary/10 text-primary" },
  { value: 100, suffix: "%", label: "DBS-checked", Icon: ShieldCheck, tile: "bg-success/10 text-success" },
  { value: 30, suffix: "+", label: "Comp titles coached", Icon: Trophy, tile: "bg-warning/10 text-warning" },
  { value: 5, suffix: "", label: "Essex venues", Icon: Music2, tile: "bg-accent/10 text-accent" },
];

const TRUST = [
  {
    Icon: ShieldCheck,
    title: "DBS-checked",
    copy: "Every single instructor holds an enhanced DBS certificate, renewed and on file.",
  },
  {
    Icon: BadgeCheck,
    title: "Fully insured",
    copy: "Comprehensive public liability cover across all five of our Essex venues.",
  },
  {
    Icon: HeartHandshake,
    title: "Safeguarding-trained",
    copy: "Designated safeguarding leads with up-to-date child-protection training.",
  },
  {
    Icon: GraduationCap,
    title: "Qualified coaches",
    copy: "First-aid certified, dance-qualified professionals who never stop learning.",
  },
];

const PERKS = [
  {
    Icon: Trophy,
    title: "Coach championship crews",
    copy: "Lead routines that compete — and win — on the biggest UK stages.",
    tile: "bg-primary/10 text-primary",
  },
  {
    Icon: HeartHandshake,
    title: "A proper family",
    copy: "Supportive, ambitious team culture with real progression.",
    tile: "bg-accent/10 text-accent",
  },
  {
    Icon: Users,
    title: "Shape young talent",
    copy: "From tots to seniors across five thriving Essex venues.",
    tile: "bg-primary/10 text-primary",
  },
];

const Team = () => {
  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative overflow-hidden px-4 pt-24 pb-16 md:pt-32 md:pb-24">
        <AmbientGlow variant="light" />
        <div className="relative container max-w-7xl text-center">
          <FadeRise>
            <p className="eyebrow mb-5">The people behind the movement</p>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-7xl">
              Meet the <em className="font-serif italic font-normal text-primary">crew</em>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-xl">
              Award-winning choreographers, battle-tested coaches and the warmest faces in Essex
              dance. Every one of them DBS-checked, insured and here for one reason — to help you
              move different.
            </p>
          </FadeRise>
          <FadeRise delay={140}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              {SPECIALTIES.map((label) => (
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

      {/* ───────────────── Instructor roster ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <FadeRise className="mb-12 max-w-2xl">
            <p className="eyebrow mb-3">The roster</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Coaches who push you further
            </h2>
            <p className="mt-4 text-muted-foreground">
              From your child's first wobble to a championship-level routine — this is the team
              that takes you there.
            </p>
          </FadeRise>

          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" childClassName="h-full">
            {INSTRUCTORS.map((p) => {
              const tone = TONES[p.specialism];
              return (
                <Card
                  key={p.name}
                  className="h-full p-6 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
                >
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-full font-display text-xl font-bold ${tone.avatar}`}
                    aria-hidden
                  >
                    {p.initials}
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold leading-tight tracking-tight">
                    {p.name}
                  </h3>
                  <p className={`mt-1 text-sm font-semibold ${tone.credit}`}>{p.credit}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{p.bio}</p>
                </Card>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── Stat band ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <Stagger className="grid grid-cols-2 gap-5 md:grid-cols-4" childClassName="h-full">
            {STATS.map(({ value, suffix, label, Icon, tile }) => (
              <Card key={label} className="h-full p-6 text-center">
                <div
                  className={`mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${tile}`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="font-display text-3xl font-bold tabular-nums tracking-tight md:text-4xl">
                  <AnimatedNumber value={value} suffix={suffix} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{label}</p>
              </Card>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── Trust band ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <FadeRise className="mx-auto mb-12 max-w-2xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-1.5 text-sm font-medium text-success">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Safe hands, always
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              DBS-checked, insured and safeguarding-trained
            </h2>
            <p className="mt-4 text-muted-foreground">
              The fun is non-negotiable — and so is your peace of mind. Every coach on our team
              meets the same high bar before they ever step into the studio.
            </p>
          </FadeRise>

          <FadeRise delay={120}>
            <Card className="p-6 md:p-8">
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {TRUST.map(({ Icon, title, copy }) => (
                  <div key={title}>
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p>
                  </div>
                ))}
              </div>
            </Card>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── Join the team CTA ───────────────── */}
      <section className="relative overflow-hidden px-4 py-16 md:py-24">
        <AmbientGlow variant="duo" />
        <div className="relative container grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <FadeRise>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
              <Megaphone className="h-4 w-4" aria-hidden />
              We're hiring
            </div>
            <h2 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Think you've got <span className="text-accent">it?</span>
            </h2>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              We're always on the lookout for coaches who bring energy, technique and heart.
              Street, commercial, heels or ballet — if you live to put dancers on stage, we want
              to hear from you.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/contact">
                  <Sparkles className="mr-2 h-4 w-4" /> Join the team
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/about">
                  Our story <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </FadeRise>

          <FadeRise delay={140}>
            <div className="grid gap-4">
              {PERKS.map(({ Icon, title, copy, tile }) => (
                <Card
                  key={title}
                  className="flex items-center gap-4 p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tile}`}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
                  </div>
                </Card>
              ))}
            </div>
          </FadeRise>
        </div>
      </section>
    </div>
  );
};

export default Team;
