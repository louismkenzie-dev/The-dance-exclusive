import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  ArrowRight,
  Car,
  Wind,
  Eye,
  Sparkles,
  Volume2,
  Music2,
  Accessibility,
  ShieldCheck,
  Clock,
  HeartHandshake,
  Compass,
  Star,
  Navigation,
} from "lucide-react";
import GrainOverlay from "@/components/immersive/GrainOverlay";
import { Reveal } from "@/components/immersive/Reveal";
import { Marquee } from "@/components/immersive/Marquee";
import { StatCounter } from "@/components/immersive/StatCounter";
import { useMagnetic } from "@/hooks/useMagnetic";

interface PublicVenue {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  county: string | null;
  postcode: string;
  short_description: string | null;
  description: string | null;
  hero_image: string | null;
  photo_outside: string | null;
  is_featured: boolean;
  slug: string | null;
  floor_type: string | null;
  has_mirrors: boolean | null;
  has_sound_system: boolean | null;
  has_changing_rooms: boolean | null;
  has_parking: boolean | null;
  has_waiting_area: boolean | null;
  accessibility_info: string | null;
}

/** Brand tint rotation — blue → violet → pink → magenta, matching the journey grade. */
const TINTS = ["201 70% 65%", "260 75% 62%", "300 80% 58%", "330 90% 55%"];

/** Real facility chips — rendered only when the venue record actually has them. */
const facilityChips = (v: PublicVenue): { label: string; icon: typeof MapPin }[] => {
  const chips: { label: string; icon: typeof MapPin }[] = [];
  if (v.floor_type) chips.push({ label: `${v.floor_type} floor`, icon: Wind });
  if (v.has_mirrors) chips.push({ label: "Mirrored studio", icon: Eye });
  if (v.has_sound_system) chips.push({ label: "Pro sound", icon: Volume2 });
  if (v.has_changing_rooms) chips.push({ label: "Changing rooms", icon: ShieldCheck });
  if (v.has_parking) chips.push({ label: "Parking", icon: Car });
  if (v.has_waiting_area) chips.push({ label: "Waiting area", icon: Clock });
  if (v.accessibility_info) chips.push({ label: "Accessible", icon: Accessibility });
  return chips;
};

const outcode = (postcode: string) => postcode.split(" ")[0] ?? postcode;

const anchorFor = (v: PublicVenue) =>
  v.slug || v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const directionsUrl = (v: PublicVenue) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${v.name}, ${v.postcode}`,
  )}`;

const bodyType = {
  textTransform: "none",
  letterSpacing: "normal",
  fontFamily: "var(--font-body)",
} as const;

const EXPECT = [
  {
    icon: HeartHandshake,
    tint: "201 70% 65%",
    title: "A Warm Welcome",
    copy: "Arrive five minutes early and a member of our team will greet you by name, show you the studio and settle any first-day nerves — yours or your dancer's.",
  },
  {
    icon: Music2,
    tint: "300 80% 58%",
    title: "Wear What Moves",
    copy: "No kit to buy on day one. Comfy clothes you can move in, trainers and a water bottle — that's it. Just bring the energy and we'll handle the rest.",
  },
  {
    icon: Sparkles,
    tint: "330 90% 55%",
    title: "Leave Buzzing",
    copy: "Your first session is all about smiles, confidence and that post-class glow. No pressure, no judgement — just a room full of people who can't wait to dance with you.",
  },
];

const Venues = () => {
  const magPrimary = useMagnetic<HTMLDivElement>(0.22);
  const [venues, setVenues] = useState<PublicVenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("venues")
        .select(
          "id, name, address_line1, city, county, postcode, short_description, description, hero_image, photo_outside, is_featured, slug, floor_type, has_mirrors, has_sound_system, has_changing_rooms, has_parking, has_waiting_area, accessibility_info",
        )
        .eq("publicly_visible", true)
        .order("is_featured", { ascending: false })
        .order("name");
      if (!cancelled) {
        if (!error && data) setVenues(data as PublicVenue[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const towns = useMemo(
    () => [...new Set(venues.map((v) => v.city).filter(Boolean))],
    [venues],
  );
  const counties = useMemo(
    () => [...new Set(venues.map((v) => v.county).filter(Boolean))] as string[],
    [venues],
  );
  const regionLine =
    counties.length > 1
      ? `${counties.slice(0, -1).join(", ")} and ${counties[counties.length - 1]}`
      : counties[0] || "Essex";

  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────────── HERO ───────────────── */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent,hsl(220_20%_4%)_75%)]" />
        <GrainOverlay />

        <span
          aria-hidden
          className="pointer-events-none select-none absolute inset-x-0 top-[18%] text-center font-display font-bold text-[24vw] leading-none text-stroke-faint tracking-tighter"
        >
          ESSEX
        </span>

        <div className="relative z-10 max-w-3xl animate-fade-in">
          <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-5">
            {venues.length > 0 ? `${venues.length} Venues · One Family` : "Our Venues"}
          </p>
          <h1 className="font-display font-bold leading-[0.92] tracking-tight text-foreground text-[16vw] sm:text-7xl md:text-8xl">
            <span className="block">Find Your</span>
            <span className="block text-primary drop-shadow-[0_0_40px_hsl(201_70%_65%/0.35)]">
              Studio
            </span>
          </h1>
          <p
            className="mt-7 text-base md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed"
            style={bodyType}
          >
            Award-winning venues across {regionLine}, each with the same electric energy.
            Wherever you are, your spotlight is closer than you think.
          </p>

          <div className="mt-9 flex flex-wrap gap-3 justify-center">
            {venues.map((v) => (
              <a
                key={v.id}
                href={`#${anchorFor(v)}`}
                className="group inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card/50 backdrop-blur-sm text-xs sm:text-sm uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <MapPin className="w-3.5 h-3.5 text-primary" />
                {v.city}
              </a>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
            Explore
          </span>
          <div className="w-5 h-8 rounded-full border border-muted-foreground/30 flex justify-center pt-1.5">
            <span className="w-1 h-1.5 rounded-full bg-primary animate-scroll-cue" />
          </div>
        </div>
      </section>

      {/* ───────────────── MARQUEE STRIP ───────────────── */}
      <div className="border-y border-border bg-card/40 py-4 text-foreground/90">
        <Marquee
          items={towns.length > 0 ? towns : ["Essex", "Kent", "London"]}
          speed={38}
        />
      </div>
      <div className="border-b border-border bg-background py-3 text-muted-foreground/70">
        <Marquee
          items={["Award-Winning Coaching", "DBS-Checked Teams", "Street", "Commercial", "Heels", "Kids & Adults"]}
          reverse
          speed={46}
          accent="text-accent"
        />
      </div>

      {/* ───────────────── STAT BAND ───────────────── */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-duo opacity-60" />
        <div className="relative container grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: venues.length || 12, suffix: "", label: "Venues" },
            { value: towns.length || 10, suffix: "", label: "Towns & Villages" },
            { value: counties.length || 3, suffix: "", label: "Counties" },
            { value: 100, suffix: "%", label: "DBS-Checked Teams" },
          ].map((s, i) => (
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

      {/* ───────────────── VENUE GRID ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(180deg, hsl(220 20% 4%), hsl(220 22% 6%)), radial-gradient(80% 60% at 0% 0%, hsl(201 70% 55% / 0.10), transparent 60%), radial-gradient(80% 60% at 100% 100%, hsl(330 90% 55% / 0.12), transparent 60%)",
          }}
        />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              The Venues
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">
              Pick the Venue Nearest You
            </h2>
            <p className="mt-4 text-muted-foreground" style={bodyType}>
              Same coaching, same family, same standards — {venues.length || "plenty of"}{" "}
              postcodes to choose from. Every room is chosen for serious training and built
              to make you feel at home.
            </p>
          </Reveal>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-muted/40" />
                  <div className="p-6 space-y-3">
                    <div className="h-5 w-2/3 rounded bg-muted/40" />
                    <div className="h-3 w-1/3 rounded bg-muted/30" />
                    <div className="h-3 w-full rounded bg-muted/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : venues.length === 0 ? (
            <Reveal className="max-w-md mx-auto">
              <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-10 text-center">
                <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center border border-primary/40 bg-primary/10">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <h3 className="mt-4 font-display text-2xl">New Venues Announcing Soon</h3>
                <p className="mt-2 text-sm text-muted-foreground" style={bodyType}>
                  We're finalising our venue list for the new term — check back shortly or
                  browse classes to register your interest.
                </p>
              </div>
            </Reveal>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {venues.map((v, i) => {
                const tint = TINTS[i % TINTS.length];
                const img = v.hero_image || v.photo_outside;
                const chips = facilityChips(v);
                const blurb = v.short_description || v.description;
                return (
                  <Reveal key={v.id} delay={(i % 3) * 90}>
                    <article
                      id={anchorFor(v)}
                      className="group relative h-full flex flex-col rounded-2xl border bg-card/60 backdrop-blur-sm overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl scroll-mt-28"
                      style={{ borderColor: `hsl(${tint} / 0.35)` }}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden">
                        {img ? (
                          <img
                            src={img}
                            alt={`${v.name}, ${v.city}`}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <>
                            <div
                              className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                              style={{
                                background: `radial-gradient(120% 100% at 20% 0%, hsl(${tint} / 0.45), transparent 60%), linear-gradient(155deg, hsl(220 24% 9%), hsl(220 28% 5%))`,
                              }}
                            />
                            <GrainOverlay />
                            <span
                              aria-hidden
                              className="pointer-events-none select-none absolute -bottom-6 right-2 font-display font-bold text-[7rem] leading-none text-stroke-faint tracking-tighter opacity-70"
                            >
                              {v.city.charAt(0)}
                            </span>
                            <div className="relative h-full flex flex-col items-center justify-center gap-2">
                              <div
                                className="w-14 h-14 rounded-full flex items-center justify-center border"
                                style={{
                                  borderColor: `hsl(${tint} / 0.5)`,
                                  background: `hsl(${tint} / 0.12)`,
                                }}
                              >
                                <MapPin className="w-6 h-6" style={{ color: `hsl(${tint})` }} />
                              </div>
                            </div>
                          </>
                        )}
                        <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/70 backdrop-blur-sm border border-border text-[10px] uppercase tracking-[0.18em] text-foreground/80">
                          <Star className="w-3 h-3 text-accent" fill="currentColor" />
                          {v.is_featured ? "New for September" : "Award-winning"}
                        </div>
                      </div>

                      {/* body */}
                      <div className="relative flex flex-col flex-1 p-6">
                        <div className="flex items-start gap-2">
                          <MapPin
                            className="w-4 h-4 mt-1 shrink-0"
                            style={{ color: `hsl(${tint})` }}
                          />
                          <div>
                            <h3 className="font-display text-2xl leading-tight">{v.name}</h3>
                            <p
                              className="text-xs uppercase tracking-[0.18em] mt-0.5"
                              style={{ color: `hsl(${tint})` }}
                            >
                              {v.city}, {outcode(v.postcode)}
                            </p>
                          </div>
                        </div>

                        {blurb && (
                          <p className="mt-3 text-sm text-muted-foreground" style={bodyType}>
                            {blurb}
                          </p>
                        )}

                        {chips.length > 0 && (
                          <ul className="mt-5 flex flex-wrap gap-2">
                            {chips.map((c) => (
                              <li
                                key={c.label}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-background/40 text-[11px] tracking-wide text-muted-foreground"
                                style={bodyType}
                              >
                                <c.icon className="w-3 h-3" style={{ color: `hsl(${tint})` }} />
                                {c.label}
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-6 pt-5 border-t border-border/60 flex items-center justify-between gap-3">
                          <Button
                            asChild
                            className="font-semibold uppercase tracking-wider"
                            style={{ background: `hsl(${tint})`, color: "hsl(220 20% 6%)" }}
                          >
                            <Link to="/classes/children">
                              View Classes <ArrowRight className="w-4 h-4 ml-2" />
                            </Link>
                          </Button>
                          <a
                            href={directionsUrl(v)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70 transition-colors hover:text-foreground"
                          >
                            <Navigation className="w-3.5 h-3.5" /> Directions
                          </a>
                        </div>
                      </div>
                    </article>
                  </Reveal>
                );
              })}

              {/* "can't choose?" helper card */}
              <Reveal delay={180}>
                <article className="group relative h-full flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-primary/30 bg-card/30 backdrop-blur-sm p-8 transition-all duration-500 hover:-translate-y-2 hover:border-primary/60">
                  <div className="absolute inset-0 stage-light-mag opacity-40 rounded-2xl" />
                  <div className="relative">
                    <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center border border-primary/40 bg-primary/10">
                      <Compass className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="mt-4 font-display text-2xl">Not Sure Which?</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-xs" style={bodyType}>
                      Pop your postcode into the class browser and we'll sort every class by
                      distance from your front door.
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      className="mt-5 font-semibold uppercase tracking-wider border-primary/40 text-foreground hover:bg-primary/10"
                    >
                      <Link to="/classes/children">
                        Browse Every Class <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </article>
              </Reveal>
            </div>
          )}
        </div>
      </section>

      {/* ───────────────── WHAT TO EXPECT ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue opacity-60" />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              Your First Class
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">
              What to Expect on Day One
            </h2>
            <p className="mt-4 text-muted-foreground" style={bodyType}>
              Walking into a new studio can feel big. Here's exactly how your first session goes —
              so the only surprise is how quickly you'll want to come back.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-5">
            {EXPECT.map((e, i) => {
              const Icon = e.icon;
              return (
                <Reveal key={e.title} delay={i * 110}>
                  <div
                    className="group relative h-full rounded-2xl border p-7 bg-card/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1.5 overflow-hidden"
                    style={{ borderColor: `hsl(${e.tint} / 0.35)` }}
                  >
                    <div
                      className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-40 transition-opacity duration-500 group-hover:opacity-70"
                      style={{ background: `hsl(${e.tint} / 0.5)` }}
                    />
                    <div className="relative">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center border"
                        style={{
                          borderColor: `hsl(${e.tint} / 0.5)`,
                          background: `hsl(${e.tint} / 0.12)`,
                        }}
                      >
                        <Icon className="w-6 h-6" style={{ color: `hsl(${e.tint})` }} />
                      </div>
                      <h3 className="mt-4 font-display text-2xl">{e.title}</h3>
                      <p className="mt-3 text-sm text-muted-foreground" style={bodyType}>
                        {e.copy}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* reassurance strip */}
          <Reveal delay={120} className="mt-10">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> DBS-checked teachers
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Arrive 5 mins early
              </span>
              <span className="inline-flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-primary" /> First class, no pressure
              </span>
              <span className="inline-flex items-center gap-2">
                <Accessibility className="w-4 h-4 text-primary" /> Step-free options
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── FINAL CTA BAND ───────────────── */}
      <section className="relative py-28 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 stage-light-duo" />
        <GrainOverlay />
        <Reveal className="relative max-w-3xl mx-auto">
          <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-4">
            Your Studio Is Waiting
          </p>
          <h2 className="font-display font-bold text-5xl md:text-7xl leading-[0.95]">
            Step Into the <span className="text-primary">spotlight</span>{" "}
            <span className="text-accent">near you</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg" style={bodyType}>
            Venues across {regionLine}. One unforgettable first class. Find your nearest and
            book today.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center">
            <div ref={magPrimary} className="inline-block will-change-transform">
              <Button
                asChild
                size="lg"
                className="px-9 py-6 text-base font-semibold uppercase tracking-wider animate-glow-pulse"
              >
                <Link to="/classes/children">
                  <Sparkles className="w-4 h-4 mr-2" /> View Classes
                </Link>
              </Button>
            </div>
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

export default Venues;
