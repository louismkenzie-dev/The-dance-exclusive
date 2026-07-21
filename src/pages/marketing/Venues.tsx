import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { FadeRise, Stagger, AnimatedNumber, AmbientGlow } from "@/components/motion";
import VenueMap from "@/components/VenueMap";

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
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
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

const Venues = () => {
  const [venues, setVenues] = useState<PublicVenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("venues")
        .select(
          "id, name, address_line1, city, county, postcode, short_description, description, hero_image, photo_outside, latitude, longitude, is_active, is_featured, slug, floor_type, has_mirrors, has_sound_system, has_changing_rooms, has_parking, has_waiting_area, accessibility_info",
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

  const hasMap = Boolean(import.meta.env.VITE_MAPBOX_TOKEN) && venues.some((v) => v.latitude && v.longitude);

  return (
    <div className="overflow-x-clip bg-background text-foreground">
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative overflow-hidden px-4 pb-16 pt-20 md:pb-24 md:pt-28">
        <AmbientGlow variant="light" />
        <div className="container relative max-w-7xl">
          <FadeRise className="mx-auto max-w-3xl text-center">
            <p className="eyebrow mb-5">
              {venues.length > 0 ? `${venues.length} venues · one family` : "Our venues"}
            </p>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-7xl">
              Find your{" "}
              <em className="font-serif italic font-normal text-primary">studio</em>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-xl">
              Award-winning classes across {regionLine}, each venue with the same electric
              energy. Wherever you are, your spotlight is closer than you think.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              {venues.map((v) => (
                <a
                  key={v.id}
                  href={`#${anchorFor(v)}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-soft transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-foreground hover:shadow-soft-md"
                >
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {v.city}
                </a>
              ))}
            </div>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── Stat band ───────────────── */}
      {venues.length > 0 && (
        <section className="px-4 pb-16 md:pb-20">
          <Stagger className="container grid max-w-7xl grid-cols-3 gap-8 text-center">
            {[
              { value: venues.length, label: "Venues" },
              { value: towns.length, label: "Towns & villages" },
              { value: counties.length || 1, label: "Counties" },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-display text-4xl font-bold tabular-nums text-primary md:text-5xl">
                  <AnimatedNumber value={s.value} />
                </div>
                <div className="eyebrow mt-2">{s.label}</div>
              </div>
            ))}
          </Stagger>
        </section>
      )}

      {/* ───────────────── Venue grid ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <FadeRise className="mx-auto mb-14 max-w-2xl text-center">
            <p className="eyebrow mb-3">The venues</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Pick the venue nearest you
            </h2>
            <p className="mt-4 text-muted-foreground">
              Same coaching, same family, same standards — {venues.length || "plenty of"}{" "}
              postcodes to choose from. Every room is chosen for serious training and built
              to make you feel at home.
            </p>
          </FadeRise>

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-[4/3] w-full rounded-none" />
                  <div className="space-y-3 p-6">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </Card>
              ))}
            </div>
          ) : venues.length === 0 ? (
            <FadeRise className="mx-auto max-w-md text-center">
              <Card className="p-10">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold tracking-tight">
                  New venues announcing soon
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  We're finalising our venue list for the new term — check back shortly or
                  browse classes to register your interest.
                </p>
              </Card>
            </FadeRise>
          ) : (
            <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" childClassName="h-full">
              {venues.map((v) => {
                const img = v.hero_image || v.photo_outside;
                const chips = facilityChips(v);
                const blurb = v.short_description || v.description;
                return (
                  <Card
                    key={v.id}
                    id={anchorFor(v)}
                    className="flex h-full scroll-mt-28 flex-col overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
                      {img ? (
                        <img
                          src={img}
                          alt={`${v.name}, ${v.city}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2.5">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <MapPin className="h-6 w-6" />
                          </div>
                          <span className="eyebrow">{v.city}</span>
                        </div>
                      )}
                      {v.is_featured && (
                        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-card/80 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-soft backdrop-blur-sm">
                          <Star className="h-3 w-3 text-warning" fill="currentColor" />
                          New for September
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-display text-xl font-bold leading-tight tracking-tight">
                            {v.name}
                          </h3>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {v.city}, {outcode(v.postcode)}
                          </p>
                        </div>
                      </div>

                      {blurb && (
                        <p className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground">{blurb}</p>
                      )}

                      {chips.length > 0 && (
                        <ul className="mb-6 mt-5 flex flex-wrap gap-2">
                          {chips.map((c) => (
                            <li
                              key={c.label}
                              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground"
                            >
                              <c.icon className="h-3 w-3 text-muted-foreground" />
                              {c.label}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/50 pt-5">
                        <Button asChild size="sm">
                          <Link to="/classes/children">
                            View classes <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                        <a
                          href={directionsUrl(v)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Navigation className="h-3.5 w-3.5" /> Directions
                        </a>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {/* "can't choose?" helper card */}
              <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center transition-all duration-300 ease-out hover:-translate-y-0.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Compass className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold tracking-tight">Not sure which?</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  Pop your postcode into the class browser and we'll sort every class by
                  distance from your front door.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link to="/classes/children">
                    Browse every class <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Stagger>
          )}
        </div>
      </section>

      {/* ───────────────── Map ───────────────── */}
      {hasMap && (
        <section className="px-4 py-16 md:py-24">
          <div className="container max-w-7xl">
            <FadeRise className="mx-auto mb-10 max-w-2xl text-center">
              <p className="eyebrow mb-3">On the map</p>
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
                All of our venues, one map
              </h2>
            </FadeRise>
            <FadeRise>
              <div className="overflow-hidden rounded-3xl shadow-soft-lg">
                <VenueMap venues={venues} />
              </div>
            </FadeRise>
          </div>
        </section>
      )}

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
                  Venues across {regionLine}. One unforgettable first class. Find your nearest
                  and book today.
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
