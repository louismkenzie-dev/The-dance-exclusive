import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Clock,
  Send,
  ArrowRight,
  MessageCircle,
  Phone,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import GrainOverlay from "@/components/immersive/GrainOverlay";
import { Reveal } from "@/components/immersive/Reveal";
import { Marquee } from "@/components/immersive/Marquee";
import { StatCounter } from "@/components/immersive/StatCounter";
import { useMagnetic } from "@/hooks/useMagnetic";
import { useToast } from "@/hooks/use-toast";

const bodyStyle = {
  textTransform: "none" as const,
  letterSpacing: "normal",
  fontFamily: "var(--font-body)",
};

const VENUES: { name: string; area: string; note: string }[] = [
  { name: "Kelvedon", area: "Studio HQ", note: "Tots, Juniors & Seniors" },
  { name: "Braintree", area: "Town centre", note: "Street & commercial" },
  { name: "White Notley", area: "Village hall", note: "Junior crews" },
  { name: "Chelmsford", area: "City studio", note: "Seniors & adult heels" },
  { name: "Clacton", area: "Coastal venue", note: "All ages welcome" },
];

const HOURS: { day: string; time: string }[] = [
  { day: "Mon – Thu", time: "16:00 – 21:00" },
  { day: "Friday", time: "16:00 – 20:00" },
  { day: "Saturday", time: "09:00 – 16:00" },
  { day: "Sunday", time: "Adult workshops only" },
];

const REASONS: { q: string; a: string }[] = [
  {
    q: "Booking a class or trial",
    a: "Tell us your child's age (or that it's for you) and we'll point you to the right class and the nearest venue.",
  },
  {
    q: "Birthday parties & events",
    a: "Dance parties, choreography for your big day, school workshops and brand performances — we love a bespoke brief.",
  },
  {
    q: "Joining the team",
    a: "Teachers, assistants and front-of-house — if you live and breathe movement, we want to hear from you.",
  },
];

const Contact = () => {
  const { toast } = useToast();
  const magBlue = useMagnetic<HTMLDivElement>(0.22);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast({
      title: "Message sent",
      description: "We'll be in touch within 24 hours.",
    });
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
  };

  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────────── HERO ───────────────── */}
      <section className="relative min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-24 overflow-hidden">
        <div className="absolute inset-0 stage-light-duo opacity-80" />
        <GrainOverlay />
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none select-none flex items-center justify-center"
          aria-hidden
        >
          <span className="font-display uppercase text-[22vw] leading-none text-stroke-faint">
            Hello
          </span>
        </div>

        <div className="relative container max-w-3xl">
          <Reveal>
            <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-5">
              We're listening · After Dark
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="font-display font-bold text-5xl md:text-7xl leading-[0.95]">
              Get in{" "}
              <span className="text-accent" style={{ color: "hsl(330,90%,55%)" }}>
                Touch
              </span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p
              className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
              style={bodyStyle}
            >
              Questions about classes, parties, auditions or just want to say hi?
              Drop us a line and a real human from the crew will get straight back
              to you — usually the same day.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href="mailto:hello@thedanceexclusive.co.uk"
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-5 py-2.5 text-sm font-semibold uppercase tracking-wider transition-colors hover:bg-primary/10"
              >
                <Mail className="h-4 w-4 text-primary" />
                hello@thedanceexclusive.co.uk
              </a>
              <span
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-5 py-2.5 text-sm text-muted-foreground"
                style={bodyStyle}
              >
                <Clock className="h-4 w-4 text-accent" />
                Reply within 24 hours
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── MARQUEE ───────────────── */}
      <div className="relative py-6 border-y border-border/60 bg-card/30">
        <Marquee
          items={[
            "Kelvedon",
            "Braintree",
            "White Notley",
            "Chelmsford",
            "Clacton",
            "Five Essex Venues",
          ]}
          speed={38}
          accent="text-accent"
        />
      </div>

      {/* ───────────────── FORM + DETAILS ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue opacity-60" />
        <GrainOverlay />
        <div className="relative container">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-start">
            {/* ── LEFT: FORM ── */}
            <Reveal>
              <div className="relative rounded-3xl border border-border bg-card/60 backdrop-blur-sm p-7 md:p-10 overflow-hidden">
                <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
                <div className="relative">
                  <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">
                    Send a message
                  </p>
                  <h2 className="font-display font-bold text-3xl md:text-4xl">
                    Let's start the conversation
                  </h2>
                  <p
                    className="mt-3 text-muted-foreground"
                    style={bodyStyle}
                  >
                    Fill in the form and we'll match you with the right class,
                    venue or member of the team.
                  </p>

                  <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label
                          htmlFor="contact-name"
                          className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                        >
                          Your name
                        </label>
                        <Input
                          id="contact-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Jordan Smith"
                          required
                          className="h-12 bg-background/60"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="contact-email"
                          className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                        >
                          Email
                        </label>
                        <Input
                          id="contact-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@email.com"
                          required
                          className="h-12 bg-background/60"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="contact-subject"
                        className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                      >
                        Subject
                      </label>
                      <Input
                        id="contact-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Trial class for my 7-year-old"
                        required
                        className="h-12 bg-background/60"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="contact-message"
                        className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                      >
                        Message
                      </label>
                      <Textarea
                        id="contact-message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tell us a little about what you're looking for…"
                        required
                        rows={6}
                        className="bg-background/60 resize-none"
                      />
                    </div>

                    <div ref={magBlue} className="inline-block">
                      <Button
                        type="submit"
                        size="lg"
                        className="px-8 py-6 text-base font-semibold uppercase tracking-wider w-full sm:w-auto"
                      >
                        Send message
                        <Send className="ml-2 h-4 w-4" />
                      </Button>
                    </div>

                    <p
                      className="text-xs text-muted-foreground pt-1"
                      style={bodyStyle}
                    >
                      By sending this you agree we can reply to your enquiry. We
                      never share your details. Promise.
                    </p>
                  </form>
                </div>
              </div>
            </Reveal>

            {/* ── RIGHT: DETAILS ── */}
            <div className="space-y-8">
              {/* Direct contact */}
              <Reveal delay={120}>
                <div className="rounded-3xl border border-border bg-card/50 p-7 md:p-8">
                  <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-5">
                    Talk to us directly
                  </p>
                  <div className="space-y-5">
                    <a
                      href="mailto:hello@thedanceexclusive.co.uk"
                      className="group flex items-start gap-4"
                    >
                      <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                        <Mail className="h-5 w-5 text-primary" />
                      </span>
                      <span>
                        <span className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Email
                        </span>
                        <span
                          className="block text-base font-medium group-hover:text-primary transition-colors"
                          style={bodyStyle}
                        >
                          hello@thedanceexclusive.co.uk
                        </span>
                      </span>
                    </a>

                    <div className="flex items-start gap-4">
                      <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                        <Phone className="h-5 w-5 text-accent" />
                      </span>
                      <span>
                        <span className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Prefer to chat?
                        </span>
                        <span
                          className="block text-base font-medium"
                          style={bodyStyle}
                        >
                          Pop your number in the form — we'll call you back.
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Socials */}
                  <div className="mt-7 pt-6 border-t border-border/70">
                    <span className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
                      Follow the journey
                    </span>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href="https://instagram.com/thedanceexclusive"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent/10"
                      >
                        <Instagram className="h-4 w-4 text-accent" />
                        Instagram
                      </a>
                      <a
                        href="https://facebook.com/thedanceexclusive"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-primary/10"
                      >
                        <Facebook className="h-4 w-4 text-primary" />
                        Facebook
                      </a>
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Opening hours */}
              <Reveal delay={200}>
                <div className="rounded-3xl border border-border bg-card/50 p-7 md:p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <Clock className="h-5 w-5 text-accent" />
                    <p className="uppercase tracking-[0.2em] text-xs font-semibold text-muted-foreground">
                      Studio hours
                    </p>
                  </div>
                  <ul className="divide-y divide-border/60">
                    {HOURS.map((h) => (
                      <li
                        key={h.day}
                        className="flex items-center justify-between py-3"
                      >
                        <span className="font-medium" style={bodyStyle}>
                          {h.day}
                        </span>
                        <span
                          className="text-muted-foreground text-sm"
                          style={bodyStyle}
                        >
                          {h.time}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p
                    className="mt-4 text-xs text-muted-foreground"
                    style={bodyStyle}
                  >
                    Term-time timetable varies by venue — message us for the
                    exact schedule near you.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── VENUES ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-mag opacity-50" />
        <GrainOverlay />
        <div className="relative container">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-4">
                Find your floor
              </p>
              <h2 className="font-display font-bold text-4xl md:text-6xl">
                Five Essex Venues
              </h2>
              <p
                className="mt-4 text-muted-foreground text-lg"
                style={bodyStyle}
              >
                Wherever you are in the county, there's a high-energy class with
                your name on it. Here's where you'll find us.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VENUES.map((v, i) => (
              <Reveal key={v.name} delay={i * 90}>
                <div className="group relative h-full rounded-2xl border border-border bg-card/60 p-6 overflow-hidden transition-colors hover:border-accent/40">
                  <div className="absolute inset-0 stage-light-blue opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                  <div className="relative">
                    {/* placeholder map block */}
                    <div className="aspect-[16/9] w-full rounded-xl border border-border/60 bg-background/40 stage-light-duo flex items-center justify-center mb-5 overflow-hidden">
                      <MapPin className="h-8 w-8 text-primary/70" />
                    </div>
                    <h3 className="font-display text-2xl">{v.name}</h3>
                    <p
                      className="text-xs uppercase tracking-[0.2em] text-accent mt-1"
                    >
                      {v.area}
                    </p>
                    <p
                      className="mt-3 text-sm text-muted-foreground"
                      style={bodyStyle}
                    >
                      {v.note}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}

            {/* Stat tile */}
            <Reveal delay={VENUES.length * 90}>
              <div className="relative h-full rounded-2xl border border-accent/30 bg-card/60 p-6 flex flex-col justify-center items-center text-center overflow-hidden">
                <div className="absolute inset-0 stage-light-mag opacity-60" />
                <div className="relative">
                  <p className="font-display text-5xl md:text-6xl text-accent leading-none">
                    <StatCounter value={500} suffix="+" />
                  </p>
                  <p
                    className="mt-3 text-sm uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    Dancers across Essex
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────────────── FAQ / REASONS TO REACH OUT ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue opacity-50" />
        <GrainOverlay />
        <div className="relative container max-w-5xl">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-4">
                Not sure where to start?
              </p>
              <h2 className="font-display font-bold text-4xl md:text-6xl">
                What's on your mind?
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5">
            {REASONS.map((r, i) => (
              <Reveal key={r.q} delay={i * 110}>
                <div className="h-full rounded-2xl border border-border bg-card/50 p-7 transition-colors hover:border-primary/40">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 mb-5">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </span>
                  <h3 className="font-display text-xl mb-2">{r.q}</h3>
                  <p
                    className="text-sm text-muted-foreground"
                    style={bodyStyle}
                  >
                    {r.a}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── PREFER TO BOOK CTA STRIP ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-duo opacity-80" />
        <GrainOverlay />
        <div className="relative container">
          <Reveal>
            <div className="relative rounded-3xl border border-accent/30 bg-card/60 backdrop-blur-sm px-7 py-14 md:px-16 md:py-16 text-center overflow-hidden">
              <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
              <div className="relative">
                <p className="inline-flex items-center gap-2 text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-5">
                  <Sparkles className="h-4 w-4" />
                  Skip the small talk
                </p>
                <h2 className="font-display font-bold text-4xl md:text-6xl leading-[0.95]">
                  Prefer to just book?
                </h2>
                <p
                  className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto"
                  style={bodyStyle}
                >
                  You don't have to message first. Browse the full timetable,
                  grab a trial and meet us on the floor — your first class is
                  where it all clicks.
                </p>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                  <Button
                    asChild
                    size="lg"
                    className="px-9 py-6 text-base font-semibold uppercase tracking-wider animate-glow-pulse"
                  >
                    <Link to="/classes">
                      Explore classes
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="px-9 py-6 text-base font-semibold uppercase tracking-wider border-accent/40 text-foreground hover:bg-accent/10"
                  >
                    <a href="mailto:hello@thedanceexclusive.co.uk">
                      Email the team
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default Contact;
