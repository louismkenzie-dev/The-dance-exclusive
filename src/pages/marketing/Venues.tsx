import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MapPin,
  ArrowRight,
  Car,
  Wind,
  Eye,
  Coffee,
  Sparkles,
  Volume2,
  Music2,
  Accessibility,
  ShieldCheck,
  Clock,
  HeartHandshake,
  Compass,
  Star,
} from "lucide-react";
import { FadeRise, Stagger, AnimatedNumber, AmbientGlow } from "@/components/motion";

type VenueTone = "primary" | "accent";

type Venue = {
  name: string;
  town: string;
  blurb: string;
  facilities: string[];
  tone: VenueTone;
  established: string;
};

const TONE_STYLES: Record<VenueTone, { tile: string; wash: string }> = {
  primary: {
    tile: "bg-primary/10 text-primary",
    wash: "from-primary/15 via-primary/5 to-transparent",
  },
  accent: {
    tile: "bg-accent/10 text-accent",
    wash: "from-accent/15 via-accent/5 to-transparent",
  },
};

const VENUES: Venue[] = [
  {
    name: "Kelvedon Studios",
    town: "Kelvedon, CO5",
    blurb: "Our flagship space — purpose-built for commercial and street, wall-to-wall mirrors and a soundsystem that hits.",
    facilities: ["Sprung floor", "Free parking", "Viewing area", "Café"],
    tone: "primary",
    established: "Est. 2014",
  },
  {
    name: "Braintree Hall",
    town: "Braintree, CM7",
    blurb: "A high-ceilinged studio with serious headroom for tricks, lifts and big crew formations.",
    facilities: ["Sprung floor", "Free parking", "Changing rooms", "Step-free access"],
    tone: "accent",
    established: "Est. 2016",
  },
  {
    name: "White Notley Studio",
    town: "White Notley, CM8",
    blurb: "Our intimate village studio — small classes, big attention, the warmest welcome for first-timers.",
    facilities: ["Sprung floor", "Free parking", "Viewing window", "On-site toilets"],
    tone: "primary",
    established: "Est. 2018",
  },
  {
    name: "Chelmsford City Studio",
    town: "Chelmsford, CM1",
    blurb: "City-centre energy with full mirror walls and a pro PA — where competition crews sharpen their edge.",
    facilities: ["Sprung floor", "Pay & display nearby", "Spectator seating", "Air-conditioned"],
    tone: "accent",
    established: "Est. 2019",
  },
  {
    name: "Clacton-on-Sea Studio",
    town: "Clacton-on-Sea, CO15",
    blurb: "Our seaside home on the coast — bright, breezy and buzzing with after-school energy all week.",
    facilities: ["Sprung floor", "Free parking", "Viewing area", "Refreshments"],
    tone: "primary",
    established: "Est. 2021",
  },
];

const FACILITY_ICONS: Record<string, typeof MapPin> = {
  "Sprung floor": Wind,
  "Free parking": Car,
  "Pay & display nearby": Car,
  "Viewing area": Eye,
  "Viewing window": Eye,
  "Spectator seating": Eye,
  "Café": Coffee,
  Refreshments: Coffee,
  "Changing rooms": ShieldCheck,
  "Step-free access": Accessibility,
  "On-site toilets": ShieldCheck,
  "Air-conditioned": Wind,
};

const STATS = [
  { value: 5, suffix: "", label: "Essex venues" },
  { value: 30, suffix: "+", label: "Minutes apart, max" },
  { value: 12, suffix: "", label: "Classes every week" },
  { value: 100, suffix: "%", label: "Sprung floors" },
];

const EXPECT = [
  {
    icon: HeartHandshake,
    tile: "bg-primary/10 text-primary",
    title: "A warm welcome",
    copy: "Arrive five minutes early and a member of our team will greet you by name, show you the studio and settle any first-day nerves — yours or your dancer's.",
  },
  {
    icon: Music2,
    tile: "bg-accent/10 text-accent",
    title: "Wear what moves",
    copy: "No kit to buy on day one. Comfy clothes you can move in, trainers and a water bottle — that's it. Just bring the energy and we'll handle the rest.",
  },
  {
    icon: Sparkles,
    tile: "bg-warning/10 text-warning",
    title: "Leave buzzing",
    copy: "Your first session is all about smiles, confidence and that post-class glow. No pressure, no judgement — just a room full of people who can't wait to dance with you.",
  },
];

const anchorFor = (v: Venue) => v.town.split(",")[0].trim().toLowerCase().replace(/\s+/g, "-");

const Venues = () => {
  return (
    <div className="overflow-x-clip bg-background text-foreground">
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative overflow-hidden px-4 pb-16 pt-20 md:pb-24 md:pt-28">
        <AmbientGlow variant="light" />
        <div className="container relative max-w-7xl">
          <FadeRise className="mx-auto max-w-3xl text-center">
            <p className="eyebrow mb-5">Five studios · one family</p>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-7xl">
              Find your{" "}
              <em className="font-serif italic font-normal text-primary">studio</em>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-xl">
              Five award-winning venues across Essex, each with sprung floors, big sound and
              the same electric energy. Wherever you are, your spotlight is closer than you think.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              {VENUES.map((v) => (
                <a
                  key={v.name}
                  href={`#${anchorFor(v)}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-soft transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-foreground hover:shadow-soft-md"
                >
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {v.town.split(",")[0].trim()}
                </a>
              ))}
            </div>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── Stat band ───────────────── */}
      <section className="px-4 pb-16 md:pb-20">
        <Stagger className="container grid max-w-7xl grid-cols-2 gap-8 text-center md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="font-display text-4xl font-bold tabular-nums text-primary md:text-5xl">
                <AnimatedNumber value={s.value} suffix={s.suffix} />
              </div>
              <div className="eyebrow mt-2">{s.label}</div>
            </div>
          ))}
        </Stagger>
      </section>

      {/* ───────────────── Venue grid ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <FadeRise className="mx-auto mb-14 max-w-2xl text-center">
            <p className="eyebrow mb-3">The venues</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Pick the studio nearest you
            </h2>
            <p className="mt-4 text-muted-foreground">
              Same coaching, same family, same standards — five postcodes to choose from.
              Every room is kitted for serious training and built to make you feel at home.
            </p>
          </FadeRise>

          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" childClassName="h-full">
            {VENUES.map((v) => {
              const tone = TONE_STYLES[v.tone];
              return (
                <Card
                  key={v.name}
                  id={anchorFor(v)}
                  className="flex h-full scroll-mt-28 flex-col overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
                >
                  {/* placeholder photo tile — drop real photography in here later */}
                  <div className={`relative aspect-[4/3] overflow-hidden bg-gradient-to-br ${tone.wash}`}>
                    <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-card/80 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-soft backdrop-blur-sm">
                      <Star className="h-3 w-3 text-warning" fill="currentColor" />
                      Award-winning
                    </div>
                    <div className="flex h-full flex-col items-center justify-center gap-2.5">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone.tile}`}>
                        <MapPin className="h-6 w-6" />
                      </div>
                      <span className="eyebrow">{v.established}</span>
                    </div>
                  </div>

                  {/* body */}
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone.tile}`}>
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-bold leading-tight tracking-tight">
                          {v.name}
                        </h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">{v.town}</p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.blurb}</p>

                    {/* facilities */}
                    <ul className="mb-6 mt-5 flex flex-wrap gap-2">
                      {v.facilities.map((f) => {
                        const Icon = FACILITY_ICONS[f] ?? Sparkles;
                        return (
                          <li
                            key={f}
                            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground"
                          >
                            <Icon className="h-3 w-3 text-muted-foreground" />
                            {f}
                          </li>
                        );
                      })}
                    </ul>

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/50 pt-5">
                      <Button asChild size="sm">
                        <Link to="/classes/children">
                          View classes <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Volume2 className="h-3.5 w-3.5" /> Pro PA
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* "can't choose?" helper card to balance the 5-card grid */}
            <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center transition-all duration-300 ease-out hover:-translate-y-0.5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Compass className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight">Not sure which?</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Tell us your postcode and what you're after — we'll point you to the perfect
                studio and the right class to start with.
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link to="/classes/children">
                  Browse every class <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Stagger>
        </div>
      </section>

      {/* ───────────────── What to expect ───────────────── */}
      <section className="relative overflow-hidden px-4 py-16 md:py-24">
        <AmbientGlow variant="duo" />
        <div className="container relative max-w-7xl">
          <FadeRise className="mx-auto mb-14 max-w-2xl text-center">
            <p className="eyebrow mb-3">Your first class</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              What to expect on day one
            </h2>
            <p className="mt-4 text-muted-foreground">
              Walking into a new studio can feel big. Here's exactly how your first session goes —
              so the only surprise is how quickly you'll want to come back.
            </p>
          </FadeRise>

          <Stagger className="grid gap-5 sm:grid-cols-3" childClassName="h-full">
            {EXPECT.map((e) => {
              const Icon = e.icon;
              return (
                <Card
                  key={e.title}
                  className="h-full p-7 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${e.tile}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold tracking-tight">{e.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{e.copy}</p>
                </Card>
              );
            })}
          </Stagger>

          {/* reassurance strip */}
          <FadeRise delay={120} className="mt-10">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> DBS-checked teachers
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Arrive 5 mins early
              </span>
              <span className="inline-flex items-center gap-2">
                <HeartHandshake className="h-4 w-4 text-primary" /> First class, no pressure
              </span>
              <span className="inline-flex items-center gap-2">
                <Accessibility className="h-4 w-4 text-primary" /> Step-free options
              </span>
            </div>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── Final CTA band (Studio Night) ───────────────── */}
      <section className="px-4 pb-16 md:pb-24">
        <div className="container max-w-7xl">
          <FadeRise>
            <div className="dark relative overflow-hidden rounded-[2.5rem] bg-background px-6 py-16 text-center text-foreground shadow-soft-xl md:py-24">
              <AmbientGlow variant="night" />
              <div className="relative mx-auto max-w-3xl">
                <p className="eyebrow mb-4">Your studio is waiting</p>
                <h2 className="font-display text-4xl font-extrabold tracking-tight md:text-6xl">
                  Step into the <span className="text-primary">spotlight</span>{" "}
                  <span className="text-accent">near you</span>
                </h2>
                <p className="mt-5 text-lg text-muted-foreground">
                  Five Essex venues. One unforgettable first class. Find your nearest studio and book today.
                </p>
                <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
                  <Button asChild size="lg">
                    <Link to="/classes/children">
                      <Sparkles className="h-4 w-4" /> View classes
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/classes/adult">
                      Adult classes <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </FadeRise>
        </div>
      </section>
    </div>
  );
};

export default Venues;
