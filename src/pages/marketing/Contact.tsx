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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FadeRise, Stagger, AnimatedNumber, AmbientGlow } from "@/components/motion";
import { useToast } from "@/hooks/use-toast";

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
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative overflow-hidden px-4 pt-24 pb-16 md:pt-32 md:pb-24">
        <AmbientGlow variant="light" />
        <div className="relative container max-w-3xl text-center">
          <FadeRise>
            <p className="eyebrow mb-5">We're listening · After Dark</p>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-7xl">
              Get in{" "}
              <em className="font-serif italic font-normal text-accent">touch</em>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Questions about classes, parties, auditions or just want to say hi?
              Drop us a line and a real human from the crew will get straight back
              to you — usually the same day.
            </p>
          </FadeRise>
          <FadeRise delay={140}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href="mailto:hello@thedanceexclusive.co.uk"
                className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                <Mail className="h-4 w-4" />
                hello@thedanceexclusive.co.uk
              </a>
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-medium text-secondary-foreground">
                <Clock className="h-4 w-4 text-accent" />
                Reply within 24 hours
              </span>
            </div>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── Form + details ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            {/* Left: form card */}
            <FadeRise>
              <Card className="p-7 md:p-10">
                <p className="eyebrow mb-3">Send a message</p>
                <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                  Let's start the conversation
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Fill in the form and we'll match you with the right class,
                  venue or member of the team.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        htmlFor="contact-name"
                        className="block text-sm font-medium"
                      >
                        Your name
                      </label>
                      <Input
                        id="contact-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jordan Smith"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="contact-email"
                        className="block text-sm font-medium"
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
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="contact-subject"
                      className="block text-sm font-medium"
                    >
                      Subject
                    </label>
                    <Input
                      id="contact-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Trial class for my 7-year-old"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="contact-message"
                      className="block text-sm font-medium"
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
                      className="resize-none"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full sm:w-auto">
                    Send message
                    <Send className="ml-2 h-4 w-4" />
                  </Button>

                  <p className="pt-1 text-xs text-muted-foreground">
                    By sending this you agree we can reply to your enquiry. We
                    never share your details. Promise.
                  </p>
                </form>
              </Card>
            </FadeRise>

            {/* Right: info cards */}
            <div className="space-y-6">
              {/* Direct contact */}
              <FadeRise delay={120}>
                <Card className="p-7 md:p-8">
                  <p className="eyebrow mb-5">Talk to us directly</p>
                  <div className="space-y-5">
                    <a
                      href="mailto:hello@thedanceexclusive.co.uk"
                      className="group flex items-start gap-4"
                    >
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Mail className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-muted-foreground">
                          Email
                        </span>
                        <span className="block font-semibold transition-colors group-hover:text-primary">
                          hello@thedanceexclusive.co.uk
                        </span>
                      </span>
                    </a>

                    <div className="flex items-start gap-4">
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                        <Phone className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-muted-foreground">
                          Prefer to chat?
                        </span>
                        <span className="block font-semibold">
                          Pop your number in the form — we'll call you back.
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Socials */}
                  <div className="mt-7 border-t border-border/50 pt-6">
                    <p className="eyebrow mb-3">Follow the journey</p>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href="https://instagram.com/thedanceexclusive"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
                      >
                        <Instagram className="h-4 w-4" />
                        Instagram
                      </a>
                      <a
                        href="https://facebook.com/thedanceexclusive"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                      >
                        <Facebook className="h-4 w-4" />
                        Facebook
                      </a>
                    </div>
                  </div>
                </Card>
              </FadeRise>

              {/* Opening hours */}
              <FadeRise delay={200}>
                <Card className="p-7 md:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                      <Clock className="h-5 w-5" />
                    </span>
                    <p className="eyebrow">Studio hours</p>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {HOURS.map((h) => (
                      <li
                        key={h.day}
                        className="flex items-center justify-between py-3"
                      >
                        <span className="font-medium">{h.day}</span>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {h.time}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Term-time timetable varies by venue — message us for the
                    exact schedule near you.
                  </p>
                </Card>
              </FadeRise>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── Venues ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <FadeRise>
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="eyebrow mb-4">Find your floor</p>
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
                Five Essex venues
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Wherever you are in the county, there's a high-energy class with
                your name on it. Here's where you'll find us.
              </p>
            </div>
          </FadeRise>

          <Stagger
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            childClassName="h-full"
          >
            {VENUES.map((v) => (
              <Card
                key={v.name}
                className="h-full p-6 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold">{v.name}</h3>
                <p className="eyebrow mt-1">{v.area}</p>
                <p className="mt-3 text-sm text-muted-foreground">{v.note}</p>
              </Card>
            ))}

            {/* Stat tile */}
            <Card className="flex h-full flex-col items-center justify-center p-6 text-center">
              <p className="font-display text-4xl font-bold tabular-nums text-accent md:text-5xl">
                <AnimatedNumber value={500} suffix="+" />
              </p>
              <p className="eyebrow mt-3">Dancers across Essex</p>
            </Card>
          </Stagger>
        </div>
      </section>

      {/* ───────────────── Reasons to reach out ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="container max-w-5xl">
          <FadeRise>
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="eyebrow mb-4">Not sure where to start?</p>
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
                What's on your mind?
              </h2>
            </div>
          </FadeRise>

          <Stagger className="grid gap-5 md:grid-cols-3" childClassName="h-full">
            {REASONS.map((r) => (
              <Card
                key={r.q}
                className="h-full p-7 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <span className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <h3 className="font-display text-xl font-bold">{r.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {r.a}
                </p>
              </Card>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── Prefer to book CTA ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <FadeRise>
            <Card className="relative overflow-hidden px-7 py-14 text-center md:px-16 md:py-16">
              <AmbientGlow variant="duo" />
              <div className="relative">
                <p className="eyebrow mb-5 inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  Skip the small talk
                </p>
                <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
                  Prefer to just book?
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
                  You don't have to message first. Browse the full timetable,
                  grab a trial and meet us on the floor — your first class is
                  where it all clicks.
                </p>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                  <Button asChild size="lg">
                    <Link to="/classes">
                      Explore classes
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <a href="mailto:hello@thedanceexclusive.co.uk">
                      Email the team
                    </a>
                  </Button>
                </div>
              </div>
            </Card>
          </FadeRise>
        </div>
      </section>
    </div>
  );
};

export default Contact;
