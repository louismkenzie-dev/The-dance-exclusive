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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FadeRise, Stagger, AmbientGlow } from "@/components/motion";

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

// token tints to cycle through the package cards (magenta-led, party energy)
const CARD_TINTS = [
  { tile: "bg-accent/10 text-accent", price: "text-accent" },
  { tile: "bg-primary/10 text-primary", price: "text-primary" },
];

const PARTY_FEATURES = [
  "Routines",
  "Spotlight moments",
  "Pro choreographers",
  "Games & prizes",
  "Big sound",
  "Happy faces",
];

const HIGHLIGHTS = [
  {
    icon: Music2,
    tile: "bg-primary/10 text-primary",
    title: "A real dance party",
    copy: "Pro choreographers lead the room through high-energy routines to the music your dancer loves — no sitting around, all moving and grinning.",
  },
  {
    icon: Cake,
    tile: "bg-accent/10 text-accent",
    title: "The birthday star",
    copy: "The birthday child takes centre stage with their own spotlight moment, a routine to show off and a room full of friends cheering them on.",
  },
  {
    icon: Sparkles,
    tile: "bg-warning/10 text-warning",
    title: "We bring the magic",
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
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative overflow-hidden px-4 pt-24 pb-16 md:pt-32 md:pb-20">
        <AmbientGlow variant="duo" />
        <div className="relative container max-w-7xl text-center">
          <FadeRise>
            <p className="eyebrow mb-5">Birthday parties · Essex</p>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-7xl">
              Dance-floor{" "}
              <em className="font-serif italic font-normal text-accent">birthdays</em>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-xl">
              The most unforgettable birthday in town. We turn the studio into your
              dancer's own pop video — lights, music, games and a whole crew of
              friends learning routines together. You just bring the cake.
            </p>
          </FadeRise>
          <FadeRise delay={140}>
            <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
              <Button asChild size="lg">
                <a href="#enquire">
                  <PartyPopper className="mr-2 h-4 w-4" /> Enquire now
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#packages">
                  See packages <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </FadeRise>
          <FadeRise delay={220}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              {PARTY_FEATURES.map((label) => (
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

      {/* ───────────────── Highlights ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <FadeRise className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
            <p className="eyebrow mb-3">Why our parties hit different</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Two hours they'll never forget
            </h2>
            <p className="mt-4 text-muted-foreground">
              Forget bouncy castles and soft play. We give your dancer a proper
              performance experience with their friends — the kind of party people
              talk about for the rest of the school year.
            </p>
          </FadeRise>

          <Stagger className="grid gap-4 sm:grid-cols-3 md:gap-5" childClassName="h-full">
            {HIGHLIGHTS.map((h) => {
              const Icon = h.icon;
              return (
                <Card
                  key={h.title}
                  className="h-full p-7 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${h.tile}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold tracking-tight">
                    {h.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {h.copy}
                  </p>
                </Card>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── Packages ───────────────── */}
      <section id="packages" className="scroll-mt-24 bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <FadeRise className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
            <p className="eyebrow mb-3">The packages</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Pick your party
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every package is fully hosted by our team. Choose your length, tell us a
              little about your dancer, and we'll build the perfect celebration around
              them.
            </p>
          </FadeRise>

          {isLoading ? (
            <p className="text-center text-muted-foreground">Loading packages…</p>
          ) : packages.length === 0 ? (
            <FadeRise>
              <Card className="mx-auto max-w-xl p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <PartyPopper className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-2xl font-bold tracking-tight">
                  Packages coming soon
                </h3>
                <p className="mt-2 text-muted-foreground">
                  We're finalising our party packages right now. Send us an enquiry
                  below and we'll talk you through everything we can put on for your
                  dancer.
                </p>
                <Button asChild className="mt-6">
                  <a href="#enquire">Enquire now</a>
                </Button>
              </Card>
            </FadeRise>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
              {packages.map((pkg, i) => {
                const tint = CARD_TINTS[i % CARD_TINTS.length];
                return (
                  <FadeRise key={pkg.id} delay={i * 90} className="h-full">
                    <Card className="flex h-full flex-col p-6 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg md:p-7">
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tint.tile}`}
                        >
                          <Gift className="h-6 w-6" />
                        </div>
                        <Badge variant="accent" className="gap-1">
                          <Star className="h-3 w-3" fill="currentColor" />
                          Fully hosted
                        </Badge>
                      </div>

                      <h3 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight">
                        {pkg.name}
                      </h3>
                      {pkg.description && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {pkg.description}
                        </p>
                      )}

                      {/* pricing */}
                      <div className="mt-5 flex flex-wrap gap-6">
                        {pkg.price_1hr != null && (
                          <div>
                            <p
                              className={`font-display text-3xl font-bold tabular-nums ${tint.price}`}
                            >
                              £{pkg.price_1hr}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              1 hour
                            </p>
                          </div>
                        )}
                        {pkg.price_1_5hr != null && (
                          <div>
                            <p
                              className={`font-display text-3xl font-bold tabular-nums ${tint.price}`}
                            >
                              £{pkg.price_1_5hr}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
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
                            >
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-auto pt-6">
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          Up to {pkg.max_guests} dancers
                          {pkg.extra_guest_price > 0 &&
                            ` · £${pkg.extra_guest_price} per extra`}
                        </p>
                        <Button asChild className="mt-4 w-full">
                          <a href="#enquire">
                            Enquire <ArrowRight className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </Card>
                  </FadeRise>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────── Enquiry form ───────────────── */}
      <section id="enquire" className="relative scroll-mt-24 overflow-hidden px-4 py-16 md:py-24">
        <AmbientGlow variant="light" />
        <div className="relative container max-w-3xl">
          <FadeRise className="mb-10 text-center md:mb-12">
            <p className="eyebrow mb-3">Start the party</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Send us an enquiry
            </h2>
            <p className="mt-4 text-muted-foreground">
              Tell us a little about your dancer and the day you have in mind. A real
              human from the crew will get back to you — usually the same day.
            </p>
          </FadeRise>

          <FadeRise delay={120}>
            <Card className="p-6 md:p-10">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="party-parent" className="block text-sm font-medium">
                      Your name
                    </label>
                    <Input
                      id="party-parent"
                      value={form.parent_name}
                      onChange={(e) => set("parent_name", e.target.value)}
                      placeholder="Jordan Smith"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="party-email" className="block text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="party-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="you@email.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="party-phone" className="block text-sm font-medium">
                      Phone
                    </label>
                    <Input
                      id="party-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="07123 456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="party-package" className="block text-sm font-medium">
                      Package
                    </label>
                    <Select
                      value={form.party_package_id || NO_PACKAGE}
                      onValueChange={(v) => set("party_package_id", v)}
                    >
                      <SelectTrigger id="party-package">
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

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="party-child-name"
                      className="block text-sm font-medium"
                    >
                      Birthday child's name
                    </label>
                    <Input
                      id="party-child-name"
                      value={form.birthday_child_name}
                      onChange={(e) => set("birthday_child_name", e.target.value)}
                      placeholder="Ava"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="party-child-age"
                      className="block text-sm font-medium"
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
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label htmlFor="party-date" className="block text-sm font-medium">
                      Preferred date
                    </label>
                    <Input
                      id="party-date"
                      type="date"
                      value={form.preferred_date}
                      onChange={(e) => set("preferred_date", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="party-time" className="block text-sm font-medium">
                      Preferred time
                    </label>
                    <Input
                      id="party-time"
                      type="time"
                      value={form.preferred_time}
                      onChange={(e) => set("preferred_time", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="party-guests" className="block text-sm font-medium">
                      Number of children
                    </label>
                    <Input
                      id="party-guests"
                      type="number"
                      min={1}
                      value={form.guest_count}
                      onChange={(e) => set("guest_count", e.target.value)}
                      placeholder="15"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="party-venue" className="block text-sm font-medium">
                    Preferred venue / area
                  </label>
                  <Input
                    id="party-venue"
                    value={form.venue_preference}
                    onChange={(e) => set("venue_preference", e.target.value)}
                    placeholder="Kelvedon, Braintree, Chelmsford…"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="party-notes" className="block text-sm font-medium">
                    Anything else?
                  </label>
                  <Textarea
                    id="party-notes"
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Favourite music, dance styles, special requests…"
                    rows={5}
                    className="resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting ? "Sending…" : "Send enquiry"}
                  <Send className="ml-2 h-4 w-4" />
                </Button>

                <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-accent" />
                  No payment needed now — this is just an enquiry. We'll reply within 24
                  hours to confirm availability.
                </p>
              </form>
            </Card>
          </FadeRise>
        </div>
      </section>
    </div>
  );
};

export default Parties;
