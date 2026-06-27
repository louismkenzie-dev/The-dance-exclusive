import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PartyPopper,
  Sparkles,
  Cake,
  Music2,
  Star,
  Gift,
  Send,
  Users,
  Clock,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import GrainOverlay from "@/components/immersive/GrainOverlay";
import { Reveal } from "@/components/immersive/Reveal";
import { Marquee } from "@/components/immersive/Marquee";
import { useMagnetic } from "@/hooks/useMagnetic";

const bodyStyle = {
  textTransform: "none" as const,
  letterSpacing: "normal",
  fontFamily: "var(--font-body)",
};

type PartyPackage = {
  id: string;
  name: string;
  description: string | null;
  included_items: string[];
  price_1hr: number | null;
  price_1_5hr: number | null;
  max_guests: number;
  extra_guest_price: number;
  display_order: number;
};

// magenta-leaning tints to cycle through the package cards
const CARD_TINTS = ["330 90% 55%", "300 80% 58%", "320 85% 56%", "280 75% 62%"];

const HIGHLIGHTS = [
  {
    icon: Music2,
    tint: "330 90% 55%",
    title: "A Real Dance Party",
    copy: "Pro choreographers lead the room through high-energy routines to the music your dancer loves — no sitting around, all moving and grinning.",
  },
  {
    icon: Cake,
    tint: "300 80% 58%",
    title: "The Birthday Star",
    copy: "The birthday child takes centre stage with their own spotlight moment, a routine to show off and a room full of friends cheering them on.",
  },
  {
    icon: Sparkles,
    tint: "320 85% 56%",
    title: "We Bring the Magic",
    copy: "Lights, sound, games and good vibes — our crew handles the lot so the grown-ups can relax and enjoy the show.",
  },
];

const emptyForm = {
  parent_name: "",
  email: "",
  phone: "",
  preferred_date: "",
  preferred_time: "",
  party_package_id: "",
  guest_count: "",
  venue_preference: "",
  birthday_child_name: "",
  birthday_child_age: "",
  notes: "",
};

const NO_PACKAGE = "none";

const Parties = () => {
  const magPrimary = useMagnetic<HTMLDivElement>(0.22);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["public-party-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_packages")
        .select(
          "id, name, description, included_items, price_1hr, price_1_5hr, max_guests, extra_guest_price, display_order"
        )
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as PartyPackage[];
    },
  });

  const set = <K extends keyof typeof form>(key: K, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from("party_inquiries").insert({
        parent_name: form.parent_name,
        email: form.email,
        phone: form.phone || null,
        preferred_date: form.preferred_date || null,
        preferred_time: form.preferred_time || null,
        party_package_id:
          form.party_package_id && form.party_package_id !== NO_PACKAGE
            ? form.party_package_id
            : null,
        guest_count: form.guest_count ? Number(form.guest_count) : null,
        venue_preference: form.venue_preference || null,
        birthday_child_name: form.birthday_child_name,
        birthday_child_age: form.birthday_child_age
          ? Number(form.birthday_child_age)
          : null,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast.success("Thanks — we'll be in touch within 24 hours");
      setForm(emptyForm);
    } catch {
      toast.error("Something went wrong — please try again or email us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────────── HERO ───────────────── */}
      <section className="relative min-h-[68vh] flex flex-col items-center justify-center text-center px-4 py-24 overflow-hidden">
        <div className="absolute inset-0 stage-light-mag opacity-80" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent,hsl(220_20%_4%)_75%)]" />
        <GrainOverlay />

        <span
          aria-hidden
          className="pointer-events-none select-none absolute inset-x-0 top-[16%] text-center font-display font-bold text-[24vw] leading-none text-stroke-faint tracking-tighter"
        >
          PARTY
        </span>

        <div className="relative z-10 max-w-3xl">
          <Reveal>
            <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-5">
              Birthday Parties · Essex
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="font-display font-bold leading-[0.92] tracking-tight text-[16vw] sm:text-7xl md:text-8xl">
              <span className="block">Dance-Floor</span>
              <span
                className="block drop-shadow-[0_0_40px_hsl(330_90%_55%/0.4)]"
                style={{ color: "hsl(330,90%,55%)" }}
              >
                Birthdays
              </span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p
              className="mt-7 text-base md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed"
              style={bodyStyle}
            >
              The most unforgettable birthday in town. We turn the studio into your
              dancer's own pop video — lights, music, games and a whole crew of
              friends learning routines together. You just bring the cake.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center">
              <div ref={magPrimary} className="inline-block will-change-transform">
                <Button
                  asChild
                  size="lg"
                  className="px-9 py-6 text-base font-semibold uppercase tracking-wider animate-glow-pulse"
                >
                  <a href="#enquire">
                    <PartyPopper className="w-4 h-4 mr-2" /> Enquire Now
                  </a>
                </Button>
              </div>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="px-9 py-6 text-base font-semibold uppercase tracking-wider border-accent/40 text-foreground hover:bg-accent/10"
              >
                <a href="#packages">
                  See Packages <ArrowRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </div>
          </Reveal>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
            Let's Party
          </span>
          <div className="w-5 h-8 rounded-full border border-muted-foreground/30 flex justify-center pt-1.5">
            <span className="w-1 h-1.5 rounded-full bg-primary animate-scroll-cue" />
          </div>
        </div>
      </section>

      {/* ───────────────── MARQUEE ───────────────── */}
      <div className="relative py-5 border-y border-border/60 bg-card/30">
        <Marquee
          items={[
            "Routines",
            "Spotlight Moments",
            "Pro Choreographers",
            "Games & Prizes",
            "Big Sound",
            "Happy Faces",
          ]}
          speed={38}
          accent="text-accent"
        />
      </div>

      {/* ───────────────── HIGHLIGHTS ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-duo opacity-60" />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              Why Our Parties Hit Different
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">
              Two Hours They'll Never Forget
            </h2>
            <p className="mt-4 text-muted-foreground" style={bodyStyle}>
              Forget bouncy castles and soft play. We give your dancer a proper
              performance experience with their friends — the kind of party people
              talk about for the rest of the school year.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-5">
            {HIGHLIGHTS.map((h, i) => {
              const Icon = h.icon;
              return (
                <Reveal key={h.title} delay={i * 110}>
                  <div
                    className="group relative h-full rounded-2xl border p-7 bg-card/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1.5 overflow-hidden"
                    style={{ borderColor: `hsl(${h.tint} / 0.35)` }}
                  >
                    <div
                      className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-40 transition-opacity duration-500 group-hover:opacity-70"
                      style={{ background: `hsl(${h.tint} / 0.5)` }}
                    />
                    <div className="relative">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center border"
                        style={{
                          borderColor: `hsl(${h.tint} / 0.5)`,
                          background: `hsl(${h.tint} / 0.12)`,
                        }}
                      >
                        <Icon className="w-6 h-6" style={{ color: `hsl(${h.tint})` }} />
                      </div>
                      <h3 className="mt-4 font-display text-2xl">{h.title}</h3>
                      <p className="mt-3 text-sm text-muted-foreground" style={bodyStyle}>
                        {h.copy}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────── PACKAGES ───────────────── */}
      <section id="packages" className="relative py-24 px-4 overflow-hidden scroll-mt-24">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(180deg, hsl(220 20% 4%), hsl(220 22% 6%)), radial-gradient(80% 60% at 100% 0%, hsl(330 90% 55% / 0.12), transparent 60%), radial-gradient(80% 60% at 0% 100%, hsl(300 80% 58% / 0.12), transparent 60%)",
          }}
        />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              The Packages
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">
              Pick Your Party
            </h2>
            <p className="mt-4 text-muted-foreground" style={bodyStyle}>
              Every package is fully hosted by our team. Choose your length, tell us a
              little about your dancer, and we'll build the perfect celebration around
              them.
            </p>
          </Reveal>

          {isLoading ? (
            <p className="text-center text-muted-foreground" style={bodyStyle}>
              Loading packages…
            </p>
          ) : packages.length === 0 ? (
            <Reveal>
              <div className="max-w-xl mx-auto text-center rounded-2xl border border-dashed border-primary/30 bg-card/40 backdrop-blur-sm p-10">
                <PartyPopper className="w-10 h-10 mx-auto text-primary" />
                <h3 className="mt-4 font-display text-2xl">Packages Coming Soon</h3>
                <p className="mt-2 text-muted-foreground" style={bodyStyle}>
                  We're finalising our party packages right now. Send us an enquiry
                  below and we'll talk you through everything we can put on for your
                  dancer.
                </p>
                <Button asChild className="mt-6 font-semibold uppercase tracking-wider">
                  <a href="#enquire">Enquire Now</a>
                </Button>
              </div>
            </Reveal>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {packages.map((pkg, i) => {
                const tint = CARD_TINTS[i % CARD_TINTS.length];
                return (
                  <Reveal key={pkg.id} delay={i * 90}>
                    <article
                      className="group relative h-full flex flex-col rounded-2xl border bg-card/60 backdrop-blur-sm overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl"
                      style={{ borderColor: `hsl(${tint} / 0.35)` }}
                    >
                      {/* decorative header band */}
                      <div className="relative h-28 overflow-hidden">
                        <div
                          className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                          style={{
                            background: `radial-gradient(120% 120% at 20% 0%, hsl(${tint} / 0.5), transparent 60%), linear-gradient(155deg, hsl(220 24% 9%), hsl(220 28% 5%))`,
                          }}
                        />
                        <GrainOverlay />
                        <span
                          aria-hidden
                          className="pointer-events-none select-none absolute -bottom-5 right-3 font-display font-bold text-[5.5rem] leading-none text-stroke-faint tracking-tighter opacity-70"
                        >
                          {pkg.name.charAt(0)}
                        </span>
                        <div className="relative h-full flex items-center px-6">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center border"
                            style={{
                              borderColor: `hsl(${tint} / 0.5)`,
                              background: `hsl(${tint} / 0.14)`,
                            }}
                          >
                            <Gift className="w-6 h-6" style={{ color: `hsl(${tint})` }} />
                          </div>
                        </div>
                        <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/70 backdrop-blur-sm border border-border text-[10px] uppercase tracking-[0.18em] text-foreground/80">
                          <Star className="w-3 h-3 text-accent" fill="currentColor" />
                          Fully Hosted
                        </div>
                      </div>

                      {/* body */}
                      <div className="relative flex flex-col flex-1 p-6">
                        <h3 className="font-display text-2xl leading-tight">{pkg.name}</h3>
                        {pkg.description && (
                          <p className="mt-2 text-sm text-muted-foreground" style={bodyStyle}>
                            {pkg.description}
                          </p>
                        )}

                        {/* pricing */}
                        <div className="mt-5 flex flex-wrap gap-4">
                          {pkg.price_1hr != null && (
                            <div>
                              <p
                                className="font-display font-bold text-3xl"
                                style={{ color: `hsl(${tint})` }}
                              >
                                £{pkg.price_1hr}
                              </p>
                              <p
                                className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground"
                              >
                                1 hour
                              </p>
                            </div>
                          )}
                          {pkg.price_1_5hr != null && (
                            <div>
                              <p
                                className="font-display font-bold text-3xl"
                                style={{ color: `hsl(${tint})` }}
                              >
                                £{pkg.price_1_5hr}
                              </p>
                              <p
                                className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground"
                              >
                                1.5 hours
                              </p>
                            </div>
                          )}
                        </div>

                        {/* included */}
                        {pkg.included_items.length > 0 && (
                          <ul className="mt-5 space-y-2">
                            {pkg.included_items.map((item, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-sm text-muted-foreground"
                                style={bodyStyle}
                              >
                                <CheckCircle2
                                  className="w-4 h-4 mt-0.5 shrink-0"
                                  style={{ color: `hsl(${tint})` }}
                                />
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-auto pt-6">
                          <p
                            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground/80"
                          >
                            <Users className="w-3.5 h-3.5" />
                            Up to {pkg.max_guests} dancers
                            {pkg.extra_guest_price > 0 &&
                              ` · £${pkg.extra_guest_price} per extra`}
                          </p>
                          <Button
                            asChild
                            className="mt-4 w-full font-semibold uppercase tracking-wider"
                            style={{ background: `hsl(${tint})`, color: "hsl(220 20% 6%)" }}
                          >
                            <a href="#enquire">
                              Enquire <ArrowRight className="w-4 h-4 ml-2" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────── ENQUIRY FORM ───────────────── */}
      <section id="enquire" className="relative py-24 px-4 overflow-hidden scroll-mt-24">
        <div className="absolute inset-0 stage-light-mag opacity-60" />
        <GrainOverlay />
        <div className="relative container max-w-3xl">
          <Reveal className="text-center mb-12">
            <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              Start the Party
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">
              Send Us an Enquiry
            </h2>
            <p className="mt-4 text-muted-foreground" style={bodyStyle}>
              Tell us a little about your dancer and the day you have in mind. A real
              human from the crew will get back to you — usually the same day.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="relative rounded-3xl border border-border bg-card/60 backdrop-blur-sm p-7 md:p-10 overflow-hidden">
              <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
              <form onSubmit={handleSubmit} className="relative space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="party-parent"
                      className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Your name
                    </label>
                    <Input
                      id="party-parent"
                      value={form.parent_name}
                      onChange={(e) => set("parent_name", e.target.value)}
                      placeholder="Jordan Smith"
                      required
                      className="h-12 bg-background/60"
                      style={bodyStyle}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="party-email"
                      className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Email
                    </label>
                    <Input
                      id="party-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="you@email.com"
                      required
                      className="h-12 bg-background/60"
                      style={bodyStyle}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="party-phone"
                      className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Phone
                    </label>
                    <Input
                      id="party-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="07123 456789"
                      className="h-12 bg-background/60"
                      style={bodyStyle}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="party-package"
                      className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Package
                    </label>
                    <Select
                      value={form.party_package_id || NO_PACKAGE}
                      onValueChange={(v) => set("party_package_id", v)}
                    >
                      <SelectTrigger id="party-package" className="h-12 bg-background/60" style={bodyStyle}>
                        <SelectValue placeholder="Not sure yet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_PACKAGE}>Not sure yet</SelectItem>
                        {packages.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="party-child-name"
                      className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Birthday child's name
                    </label>
                    <Input
                      id="party-child-name"
                      value={form.birthday_child_name}
                      onChange={(e) => set("birthday_child_name", e.target.value)}
                      placeholder="Ava"
                      required
                      className="h-12 bg-background/60"
                      style={bodyStyle}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="party-child-age"
                      className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Turning age
                    </label>
                    <Input
                      id="party-child-age"
                      type="number"
                      min={1}
                      max={18}
                      value={form.birthday_child_age}
                      onChange={(e) => set("birthday_child_age", e.target.value)}
                      placeholder="8"
                      className="h-12 bg-background/60"
                      style={bodyStyle}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="party-date"
                      className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Preferred date
                    </label>
                    <Input
                      id="party-date"
                      type="date"
                      value={form.preferred_date}
                      onChange={(e) => set("preferred_date", e.target.value)}
                      className="h-12 bg-background/60"
                      style={bodyStyle}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="party-time"
                      className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Preferred time
                    </label>
                    <Input
                      id="party-time"
                      type="time"
                      value={form.preferred_time}
                      onChange={(e) => set("preferred_time", e.target.value)}
                      className="h-12 bg-background/60"
                      style={bodyStyle}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="party-guests"
                      className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Number of children
                    </label>
                    <Input
                      id="party-guests"
                      type="number"
                      min={1}
                      value={form.guest_count}
                      onChange={(e) => set("guest_count", e.target.value)}
                      placeholder="15"
                      className="h-12 bg-background/60"
                      style={bodyStyle}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="party-venue"
                    className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    Preferred venue / area
                  </label>
                  <Input
                    id="party-venue"
                    value={form.venue_preference}
                    onChange={(e) => set("venue_preference", e.target.value)}
                    placeholder="Kelvedon, Braintree, Chelmsford…"
                    className="h-12 bg-background/60"
                    style={bodyStyle}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="party-notes"
                    className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    Anything else?
                  </label>
                  <Textarea
                    id="party-notes"
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Favourite music, dance styles, special requests…"
                    rows={5}
                    className="bg-background/60 resize-none"
                    style={bodyStyle}
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="w-full sm:w-auto px-8 py-6 text-base font-semibold uppercase tracking-wider"
                >
                  {submitting ? "Sending…" : "Send Enquiry"}
                  <Send className="ml-2 h-4 w-4" />
                </Button>

                <p className="flex items-center gap-2 text-xs text-muted-foreground pt-1" style={bodyStyle}>
                  <Clock className="h-3.5 w-3.5 text-accent" />
                  No payment needed now — this is just an enquiry. We'll reply within 24
                  hours to confirm availability.
                </p>
              </form>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default Parties;
