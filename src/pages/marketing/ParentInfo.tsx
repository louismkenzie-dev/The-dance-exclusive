import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import GrainOverlay from "@/components/immersive/GrainOverlay";
import { Reveal } from "@/components/immersive/Reveal";
import { Marquee } from "@/components/immersive/Marquee";
import { StatCounter } from "@/components/immersive/StatCounter";
import { useMagnetic } from "@/hooks/useMagnetic";
import {
  ArrowRight,
  Shirt,
  CalendarDays,
  ShieldCheck,
  HelpCircle,
  HeartHandshake,
  Sparkles,
  Car,
  Eye,
  BadgeCheck,
  Camera,
  Stethoscope,
  Lock,
  Clock,
  Footprints,
  Droplets,
  Tag,
  MessageCircleQuestion,
  Phone,
  Compass,
  PoundSterling,
  Users,
} from "lucide-react";

/* ── sentence-case body copy helper (Inter, no uppercase) ── */
const body = {
  textTransform: "none",
  letterSpacing: "normal",
  fontFamily: "var(--font-body)",
} as const;

/* ───────────────────────── DATA ───────────────────────── */

const QUICK_LINKS = [
  { id: "faq", label: "FAQs", Icon: HelpCircle },
  { id: "uniform", label: "What to Wear", Icon: Shirt },
  { id: "terms", label: "Term Dates", Icon: CalendarDays },
  { id: "safeguarding", label: "Safeguarding", Icon: ShieldCheck },
  { id: "contact", label: "Ask Us", Icon: MessageCircleQuestion },
] as const;

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do free trials work?",
    a: "Every new dancer is welcome to a no-pressure trial class before committing to a term. Just book a trial slot online for the class that matches your child's age, turn up in comfy kit, and dance. If it's a fit, you can enrol on the spot — if it isn't, there's absolutely nothing to pay and no hard feelings.",
  },
  {
    q: "What's included in the price, and how does payment work?",
    a: "Your termly fee covers your weekly class, your coach, full public-liability cover and your place in our end-of-term showcase rehearsals. Costumes for shows, competition entries and optional workshops are charged separately and always flagged well in advance — we never spring surprise costs on you. Fees are paid securely online by card; you'll only ever pay for the classes you've actually booked.",
  },
  {
    q: "What should my child wear to class?",
    a: "For their first few sessions, anything comfortable they can move and sweat in is perfect — leggings or joggers, a t-shirt, and clean indoor trainers. Once they settle in, we'll point you toward our branded TDE kit so the crew looks sharp together. Long hair tied back, no jewellery, and a labelled water bottle is all we ask. See the 'Uniform & what to wear' section below for the full rundown.",
  },
  {
    q: "What are the ages and levels?",
    a: "We run age-banded classes from age 3 right through to adults: Tots (3–5), Juniors (6–10), Seniors (11–16) and Adults (16+). Within each band, dancers are grouped by experience, not just age, so a confident eight-year-old and a nervous beginner both land somewhere they'll thrive. Not sure where your child fits? Tell us their age and experience and we'll place them perfectly.",
  },
  {
    q: "What are the term dates?",
    a: "We follow the standard Essex school-term calendar — three terms a year, broadly mirroring the local authority pattern, with a break for every half-term and school holiday. Holiday camps and workshops fill some of those gaps for dancers who can't get enough. The current year's dates are laid out in the 'Term dates' section further down this page.",
  },
  {
    q: "What happens if we miss a class, and can we get a refund?",
    a: "Life happens — illness, holidays, the school nativity. If you let us know in advance we'll do our best to offer a catch-up class in another group of the same level, subject to space. Termly fees aren't refunded for individual missed weeks, but we're fair and human about genuine long-term absences (a broken arm, a house move). Just talk to us early and we'll find a solution that feels right.",
  },
  {
    q: "Are your staff DBS-checked and trained in safeguarding?",
    a: "Yes — without exception. Every coach and assistant who works with our dancers holds an enhanced DBS check and up-to-date safeguarding training, and we have a named Designated Safeguarding Lead. We're fully insured, first-aid trained on site, and our policies are available to any parent who'd like to read them. Your child's safety is the foundation everything else is built on.",
  },
  {
    q: "Where do I park, and can I watch the class?",
    a: "Each venue has parking close by — details and directions are sent with your booking confirmation. To keep dancers focused (and the magic of the end-of-term reveal intact) most classes run without parents in the room, but we hold regular watch-weeks and a full showcase so you'll absolutely see how far they've come. Younger Tots parents are welcome to settle little ones in.",
  },
  {
    q: "How does booking actually work?",
    a: "Everything runs through your online parent account. Create a profile, add your dancer, browse the timetable by venue and age, and book your trial or term in a few taps. You'll get instant confirmation by email, and you can manage bookings, update details and see what's coming up anytime from your account dashboard.",
  },
  {
    q: "I'm completely new to this — where do I start?",
    a: "Start with a trial. Honestly, that's it. Pick the class that matches your child's age, book a free trial, and come and feel the energy for yourself. There's no audition, no experience needed, and no commitment until you're ready. If you'd rather chat it through with a human first, our contact page is at the bottom of this page.",
  },
  {
    q: "Do you offer classes for adults too?",
    a: "We do. Our adult classes — heels, commercial and street — are open to complete beginners and returning dancers alike, in a zero-judgement, all-levels-welcome room. Same expert coaching, same family feel, just with a slightly later finish and a much better playlist.",
  },
  {
    q: "How will you keep me updated through the term?",
    a: "All the important stuff — show dates, kit reminders, closures and snow days — comes to you by email and through your parent account, so you're never chasing information. We keep messages purposeful and infrequent; we'd rather you spent your evenings watching your child dance than reading our newsletters.",
  },
];

const UNIFORM = [
  {
    Icon: Shirt,
    title: "Comfortable kit",
    copy: "Leggings or joggers and a fitted t-shirt or vest for trials. Branded TDE kit once they're enrolled so the crew moves as one.",
  },
  {
    Icon: Footprints,
    title: "The right shoes",
    copy: "Clean indoor trainers for street & commercial. Adults' heels classes need a secure block heel — we'll advise before your first session.",
  },
  {
    Icon: Droplets,
    title: "Hair & hydration",
    copy: "Long hair tied back and out of the face, no loose jewellery, and a full water bottle. Classes are high-energy — they'll need it.",
  },
  {
    Icon: Tag,
    title: "Label everything",
    copy: "Name-label bottles, layers and shoes. Lost property in a busy studio finds its owner far faster when it's clearly marked.",
  },
];

const TERMS = [
  {
    term: "Autumn Term",
    dates: "Mon 1 Sep – Fri 19 Dec 2025",
    half: "Half-term break: 27–31 Oct",
    tint: "201 70% 65%",
  },
  {
    term: "Spring Term",
    dates: "Mon 5 Jan – Fri 27 Mar 2026",
    half: "Half-term break: 16–20 Feb",
    tint: "260 75% 62%",
  },
  {
    term: "Summer Term",
    dates: "Mon 13 Apr – Fri 17 Jul 2026",
    half: "Half-term break: 25–29 May",
    tint: "330 90% 55%",
  },
];

const SAFEGUARDING = [
  {
    Icon: BadgeCheck,
    title: "Enhanced DBS-checked",
    copy: "Every coach and assistant holds a current enhanced DBS check before they ever step into a studio with your child.",
  },
  {
    Icon: ShieldCheck,
    title: "Fully insured",
    copy: "Comprehensive public-liability cover across every venue, every class, every showcase — included in your fees.",
  },
  {
    Icon: Camera,
    title: "Photo consent first",
    copy: "We only photograph or film dancers with your explicit, on-the-record consent — and you can withdraw it anytime.",
  },
  {
    Icon: Stethoscope,
    title: "First-aid on site",
    copy: "First-aid-trained staff and a stocked kit at every session, with clear procedures for bumps, scrapes and the unexpected.",
  },
  {
    Icon: Lock,
    title: "Designated Safeguarding Lead",
    copy: "A named DSL oversees our safeguarding policy, so there's always a clear, confidential route for any concern.",
  },
  {
    Icon: HeartHandshake,
    title: "Wellbeing at the centre",
    copy: "An inclusive, encouraging room where confidence is coached as carefully as technique. Every dancer belongs here.",
  },
];

const STATS = [
  { value: 100, suffix: "%", label: "DBS-Checked Staff" },
  { value: 5, suffix: "", label: "Essex Venues" },
  { value: 3, suffix: "", label: "Terms a Year" },
  { value: 24, suffix: "h", label: "We Aim to Reply In" },
];

/* ───────────────────────── PAGE ───────────────────────── */

const ParentInfo = () => {
  const magCta = useMagnetic<HTMLDivElement>(0.22);

  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* ───────────── HERO ───────────── */}
      <section className="relative min-h-[64vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent,hsl(220_20%_4%)_78%)]" />
        <GrainOverlay />

        <span
          aria-hidden
          className="pointer-events-none select-none absolute inset-x-0 top-[18%] text-center font-display font-bold text-[22vw] leading-none text-stroke-faint tracking-tighter"
        >
          INFO
        </span>

        <Reveal className="relative z-10 max-w-3xl">
          <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-5">
            Everything You Need · One Place
          </p>
          <h1 className="font-display font-bold leading-[0.95] text-foreground text-[15vw] sm:text-7xl md:text-8xl">
            Parent Info
          </h1>
          <p
            className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
            style={body}
          >
            The calm, clear answers to every question a new dance parent has —
            trials, kit, term dates, safeguarding and how booking works. Take a
            breath; we've got you.
          </p>
        </Reveal>
      </section>

      {/* ───────────── QUICK-LINK ANCHOR ROW ───────────── */}
      <div className="sticky top-0 z-20 border-y border-border bg-background/80 backdrop-blur-md">
        <div className="container flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-3">
          {QUICK_LINKS.map(({ id, label, Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Icon className="w-3.5 h-3.5 text-primary/70 transition-colors group-hover:text-primary" />
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* ───────────── REASSURANCE MARQUEE ───────────── */}
      <div className="border-b border-border bg-card/40 py-4 text-foreground/90">
        <Marquee
          items={[
            "Free First Trial",
            "DBS-Checked Coaches",
            "Fully Insured",
            "First-Aid Trained",
            "All Levels Welcome",
            "Family-Run Energy",
          ]}
          speed={40}
        />
      </div>

      {/* ───────────── TRUST STAT BAND ───────────── */}
      <section className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-duo opacity-50" />
        <div className="relative container grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <div className="font-display font-bold text-4xl md:text-6xl text-primary">
                <StatCounter value={s.value} suffix={s.suffix} />
              </div>
              <div className="mt-2 text-xs md:text-sm uppercase tracking-[0.18em] text-muted-foreground">
                {s.label}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────────── FAQ ───────────── */}
      <section id="faq" className="relative scroll-mt-24 py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-blue opacity-50" />
        <GrainOverlay />
        <div className="relative container max-w-3xl">
          <Reveal className="text-center mb-14">
            <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              The Questions Every Parent Asks
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">
              Frequently Asked
            </h2>
            <p className="mt-4 text-muted-foreground" style={body}>
              Real answers to the things you actually want to know before your
              child's first class. Can't find yours? We're one message away.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <Accordion
              type="single"
              collapsible
              className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm px-5 sm:px-7"
            >
              {FAQS.map((f, i) => (
                <AccordionItem
                  key={f.q}
                  value={`faq-${i}`}
                  className="border-border/70 last:border-b-0"
                >
                  <AccordionTrigger className="text-left font-display uppercase tracking-wide text-base sm:text-lg hover:no-underline hover:text-primary py-5">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p
                      className="text-muted-foreground leading-relaxed pb-2"
                      style={body}
                    >
                      {f.a}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* ───────────── UNIFORM & WHAT TO WEAR ───────────── */}
      <section
        id="uniform"
        className="relative scroll-mt-24 py-24 px-4 overflow-hidden border-t border-border"
      >
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(180deg, hsl(220 20% 4%), hsl(220 22% 6%)), radial-gradient(80% 60% at 100% 0%, hsl(330 90% 55% / 0.12), transparent 60%)",
          }}
        />
        <GrainOverlay />
        <div className="relative container">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
            <Reveal>
              <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-3">
                Look Sharp · Move Free
              </p>
              <h2 className="font-display font-bold text-4xl md:text-5xl leading-[1]">
                Uniform &amp; What to Wear
              </h2>
              <p className="mt-5 text-muted-foreground" style={body}>
                No shopping list before you start — just comfy clothes they can
                move and sweat in. Once your dancer's settled, our branded TDE
                kit pulls the whole crew together for class, showcases and
                competitions.
              </p>

              {/* placeholder kit visual */}
              <div className="mt-8 relative aspect-[4/3] rounded-2xl border border-primary/25 overflow-hidden">
                <div className="absolute inset-0 stage-light-mag opacity-70" />
                <GrainOverlay />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                    <Shirt className="w-7 h-7" />
                  </div>
                  <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Branded TDE Kit · Coming Soon
                  </span>
                </div>
              </div>
            </Reveal>

            <div className="grid sm:grid-cols-2 gap-5">
              {UNIFORM.map(({ Icon, title, copy }, i) => (
                <Reveal key={title} delay={i * 90}>
                  <div className="h-full rounded-2xl border border-border bg-card/60 p-6 transition-colors hover:border-primary/40">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-display text-xl mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground" style={body}>
                      {copy}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── TERM DATES ───────────── */}
      <section id="terms" className="scroll-mt-24 py-24 px-4">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              Plan the Year Ahead
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">
              Term Dates 2025/26
            </h2>
            <p className="mt-4 text-muted-foreground" style={body}>
              We follow the standard Essex school-term pattern, with breaks for
              every half-term and holiday. Camps and workshops fill the gaps for
              dancers who just can't sit still.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5">
            {TERMS.map((t, i) => (
              <Reveal key={t.term} delay={i * 100}>
                <div
                  className="group relative h-full rounded-2xl border p-7 bg-card/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1.5 overflow-hidden"
                  style={{ borderColor: `hsl(${t.tint} / 0.35)` }}
                >
                  <div
                    className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-40 transition-opacity duration-500 group-hover:opacity-70"
                    style={{ background: `hsl(${t.tint} / 0.5)` }}
                  />
                  <div className="relative">
                    <div
                      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-semibold"
                      style={{ color: `hsl(${t.tint})` }}
                    >
                      <Clock className="w-4 h-4" />
                      Term 0{i + 1}
                    </div>
                    <h3 className="mt-3 font-display text-2xl">{t.term}</h3>
                    <p className="mt-3 text-lg text-foreground/90" style={body}>
                      {t.dates}
                    </p>
                    <p
                      className="mt-2 text-sm text-muted-foreground"
                      style={body}
                    >
                      {t.half}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <p
              className="mt-10 text-center text-xs text-muted-foreground/80 max-w-2xl mx-auto"
              style={body}
            >
              Dates align with the Essex local-authority calendar and may flex
              slightly by venue. Show weeks, closures and any snow-day changes
              are always confirmed in advance through your parent account.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ───────────── SAFEGUARDING & WELLBEING ───────────── */}
      <section
        id="safeguarding"
        className="relative scroll-mt-24 py-24 px-4 overflow-hidden border-y border-border"
      >
        <div className="absolute inset-0 stage-light-blue opacity-60" />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 text-primary mb-5">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              Safe Hands · Every Class
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">
              Safeguarding &amp; Wellbeing
            </h2>
            <p className="mt-4 text-muted-foreground" style={body}>
              Before the choreography, the costumes or the trophies, this is the
              promise we make to every family who trusts us with their dancer.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SAFEGUARDING.map(({ Icon, title, copy }, i) => (
              <Reveal key={title} delay={i * 90}>
                <div className="h-full rounded-2xl border border-border bg-card/70 backdrop-blur-sm p-7 transition-colors hover:border-primary/40">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-xl mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground" style={body}>
                    {copy}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* parking & viewing inline strip */}
          <div className="mt-8 grid sm:grid-cols-2 gap-6">
            {[
              {
                Icon: Car,
                title: "Parking",
                copy: "Every venue has parking close by, with directions sent in your booking confirmation. Arrive a few minutes early on week one.",
              },
              {
                Icon: Eye,
                title: "Viewing & watch-weeks",
                copy: "Most classes run focused and parent-free, but regular watch-weeks and a full end-of-term showcase let you see the progress for yourself.",
              },
            ].map(({ Icon, title, copy }, i) => (
              <Reveal key={title} delay={i * 90}>
                <div className="flex gap-4 rounded-2xl border border-border bg-card/50 p-6">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground" style={body}>
                      {copy}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── WHERE TO START STRIP ───────────── */}
      <section className="py-20 px-4">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">
              Brand New Here?
            </p>
            <h2 className="font-display font-bold text-3xl md:text-5xl">
              Three Steps to Your First Class
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                Icon: Compass,
                step: "01",
                title: "Find your fit",
                copy: "Browse the timetable by venue and age band, or just tell us your child's age and we'll point you to the right room.",
              },
              {
                Icon: Sparkles,
                step: "02",
                title: "Book a free trial",
                copy: "Reserve a no-commitment trial in a few taps. Instant confirmation by email — nothing to pay until you're sure.",
              },
              {
                Icon: Users,
                step: "03",
                title: "Come and dance",
                copy: "Turn up in comfy kit, feel the energy, and decide from there. Love it? Enrol for the term and join the crew.",
              },
            ].map(({ Icon, step, title, copy }, i) => (
              <Reveal key={title} delay={i * 100}>
                <div className="relative h-full rounded-2xl border border-border bg-card/60 p-7 overflow-hidden">
                  <span
                    aria-hidden
                    className="absolute -top-3 right-3 font-display font-bold text-7xl text-stroke-faint pointer-events-none select-none"
                  >
                    {step}
                  </span>
                  <div className="relative">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-display text-xl mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground" style={body}>
                      {copy}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── CONTACT CTA ───────────── */}
      <section
        id="contact"
        className="relative scroll-mt-24 py-28 px-4 text-center overflow-hidden border-t border-border"
      >
        <div className="absolute inset-0 stage-light-duo" />
        <GrainOverlay />
        <Reveal className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 text-accent mb-6">
            <MessageCircleQuestion className="w-7 h-7" />
          </div>
          <h2 className="font-display font-bold text-4xl md:text-7xl leading-[0.95]">
            Still Have <span className="text-primary">Questions?</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg" style={body}>
            If there's anything we haven't covered, ask us — a real person from
            the team will get back to you, usually within a day.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center">
            <div ref={magCta} className="inline-block will-change-transform">
              <Button
                asChild
                size="lg"
                className="px-9 py-6 text-base font-semibold uppercase tracking-wider animate-glow-pulse"
              >
                <Link to="/contact">
                  <Phone className="w-4 h-4 mr-2" /> Contact Us
                </Link>
              </Button>
            </div>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="px-9 py-6 text-base font-semibold uppercase tracking-wider border-accent/40 text-foreground hover:bg-accent/10"
            >
              <Link to="/classes/children">
                Browse Classes <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
          <p
            className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground/80"
            style={body}
          >
            <PoundSterling className="w-3.5 h-3.5 text-primary/70" />
            No pressure, no surprise costs — just a friendly answer.
          </p>
        </Reveal>
      </section>
    </div>
  );
};

export default ParentInfo;
