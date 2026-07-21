import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FadeRise, Stagger, AnimatedNumber, AmbientGlow } from "@/components/motion";
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

/* ───────────────────────── DATA ───────────────────────── */

const QUICK_LINKS = [
  { id: "faq", label: "FAQs", Icon: HelpCircle },
  { id: "uniform", label: "What to wear", Icon: Shirt },
  { id: "terms", label: "Term dates", Icon: CalendarDays },
  { id: "safeguarding", label: "Safeguarding", Icon: ShieldCheck },
  { id: "contact", label: "Ask us", Icon: MessageCircleQuestion },
] as const;

const REASSURANCE = [
  "Free first trial",
  "DBS-checked coaches",
  "Fully insured",
  "First-aid trained",
  "All levels welcome",
  "Family-run energy",
];

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
    term: "Autumn term",
    dates: "Mon 1 Sep – Fri 19 Dec 2025",
    half: "Half-term break: 27–31 Oct",
    tone: "text-primary",
    tile: "bg-primary/10 text-primary",
  },
  {
    term: "Spring term",
    dates: "Mon 5 Jan – Fri 27 Mar 2026",
    half: "Half-term break: 16–20 Feb",
    tone: "text-success",
    tile: "bg-success/10 text-success",
  },
  {
    term: "Summer term",
    dates: "Mon 13 Apr – Fri 17 Jul 2026",
    half: "Half-term break: 25–29 May",
    tone: "text-accent",
    tile: "bg-accent/10 text-accent",
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
  { value: 100, suffix: "%", label: "DBS-checked staff" },
  { value: 5, suffix: "", label: "Essex venues" },
  { value: 3, suffix: "", label: "Terms a year" },
  { value: 24, suffix: "h", label: "We aim to reply in" },
];

const STEPS = [
  {
    Icon: Compass,
    step: "Step 01",
    title: "Find your fit",
    copy: "Browse the timetable by venue and age band, or just tell us your child's age and we'll point you to the right room.",
  },
  {
    Icon: Sparkles,
    step: "Step 02",
    title: "Book a free trial",
    copy: "Reserve a no-commitment trial in a few taps. Instant confirmation by email — nothing to pay until you're sure.",
  },
  {
    Icon: Users,
    step: "Step 03",
    title: "Come and dance",
    copy: "Turn up in comfy kit, feel the energy, and decide from there. Love it? Enrol for the term and join the crew.",
  },
];

const PRACTICAL = [
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
];

/* ───────────────────────── PAGE ───────────────────────── */

const ParentInfo = () => {
  return (
    <div className="overflow-x-clip bg-background text-foreground">
      {/* ───────────── HERO ───────────── */}
      <section className="relative overflow-hidden px-4 py-20 text-center md:py-28">
        <AmbientGlow variant="light" />

        <FadeRise className="relative mx-auto max-w-3xl">
          <p className="eyebrow mb-5">Everything you need · one place</p>
          <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-7xl">
            Parent{" "}
            <em className="font-serif font-normal italic text-primary">info</em>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            The calm, clear answers to every question a new dance parent has —
            trials, kit, term dates, safeguarding and how booking works. Take a
            breath; we've got you.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {REASSURANCE.map((item) => (
              <Badge key={item}>{item}</Badge>
            ))}
          </div>
        </FadeRise>
      </section>

      {/* ───────────── QUICK-LINK ANCHOR ROW ───────────── */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex flex-wrap items-center justify-center gap-2 py-3 sm:gap-3">
          {QUICK_LINKS.map(({ id, label, Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="group inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <Icon className="h-4 w-4 text-primary/70 transition-colors group-hover:text-primary" />
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* ───────────── TRUST STAT BAND ───────────── */}
      <section className="px-4 py-16">
        <Stagger
          className="container grid max-w-6xl grid-cols-2 gap-8 text-center md:grid-cols-4"
          childClassName="h-full"
        >
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

      {/* ───────────── FAQ ───────────── */}
      <section
        id="faq"
        className="scroll-mt-24 bg-secondary/40 px-4 py-16 md:py-24"
      >
        <div className="container max-w-3xl">
          <FadeRise className="mb-12 text-center">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <HelpCircle className="h-6 w-6" />
            </div>
            <p className="eyebrow mb-3">The questions every parent asks</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Frequently asked
            </h2>
            <p className="mt-3 text-muted-foreground">
              Real answers to the things you actually want to know before your
              child's first class. Can't find yours? We're one message away.
            </p>
          </FadeRise>

          <FadeRise delay={120}>
            <Accordion type="single" collapsible className="space-y-3 md:space-y-4">
              {FAQS.map((f, i) => (
                <AccordionItem
                  key={f.q}
                  value={`faq-${i}`}
                  className="rounded-3xl border-b-0 bg-card px-6 shadow-soft transition-shadow hover:shadow-soft-md"
                >
                  <AccordionTrigger className="py-5 text-left font-display text-base font-semibold tracking-tight hover:no-underline hover:text-primary sm:text-lg">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="pb-2 leading-relaxed text-muted-foreground">
                      {f.a}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </FadeRise>
        </div>
      </section>

      {/* ───────────── UNIFORM & WHAT TO WEAR ───────────── */}
      <section id="uniform" className="scroll-mt-24 px-4 py-16 md:py-24">
        <div className="container max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <FadeRise>
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Shirt className="h-6 w-6" />
              </div>
              <p className="eyebrow mb-3">Look sharp · move free</p>
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                Uniform &amp; what to wear
              </h2>
              <p className="mt-4 text-muted-foreground">
                No shopping list before you start — just comfy clothes they can
                move and sweat in. Once your dancer's settled, our branded TDE
                kit pulls the whole crew together for class, showcases and
                competitions.
              </p>

              {/* placeholder kit visual */}
              <Card className="relative mt-8 aspect-[4/3] overflow-hidden">
                <AmbientGlow variant="light" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Shirt className="h-7 w-7" />
                  </div>
                  <span className="eyebrow">Branded TDE kit · coming soon</span>
                </div>
              </Card>
            </FadeRise>

            <Stagger className="grid gap-4 sm:grid-cols-2" childClassName="h-full">
              {UNIFORM.map(({ Icon, title, copy }) => (
                <Card
                  key={title}
                  className="h-full p-6 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 font-display text-lg font-bold tracking-tight">
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{copy}</p>
                </Card>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* ───────────── TERM DATES ───────────── */}
      <section
        id="terms"
        className="scroll-mt-24 bg-secondary/40 px-4 py-16 md:py-24"
      >
        <div className="container max-w-6xl">
          <FadeRise className="mx-auto mb-12 max-w-2xl text-center">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <CalendarDays className="h-6 w-6" />
            </div>
            <p className="eyebrow mb-3">Plan the year ahead</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Term dates 2025/26
            </h2>
            <p className="mt-3 text-muted-foreground">
              We follow the standard Essex school-term pattern, with breaks for
              every half-term and holiday. Camps and workshops fill the gaps for
              dancers who just can't sit still.
            </p>
          </FadeRise>

          <Stagger className="grid gap-4 md:grid-cols-3" childClassName="h-full">
            {TERMS.map((t, i) => (
              <Card
                key={t.term}
                className="h-full p-7 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${t.tile}`}
                >
                  <Clock className="h-5 w-5" />
                </div>
                <p className={`eyebrow ${t.tone}`}>Term 0{i + 1}</p>
                <h3 className="mt-2 font-display text-xl font-bold tracking-tight">
                  {t.term}
                </h3>
                <p className="mt-3 font-display font-semibold tabular-nums">
                  {t.dates}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{t.half}</p>
              </Card>
            ))}
          </Stagger>

          <FadeRise delay={120}>
            <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
              Dates align with the Essex local-authority calendar and may flex
              slightly by venue. Show weeks, closures and any snow-day changes
              are always confirmed in advance through your parent account.
            </p>
          </FadeRise>
        </div>
      </section>

      {/* ───────────── SAFEGUARDING & WELLBEING ───────────── */}
      <section id="safeguarding" className="scroll-mt-24 px-4 py-16 md:py-24">
        <div className="container max-w-6xl">
          <FadeRise className="mx-auto mb-12 max-w-2xl text-center">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="eyebrow mb-3">Safe hands · every class</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Safeguarding &amp; wellbeing
            </h2>
            <p className="mt-3 text-muted-foreground">
              Before the choreography, the costumes or the trophies, this is the
              promise we make to every family who trusts us with their dancer.
            </p>
          </FadeRise>

          <Stagger
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            childClassName="h-full"
          >
            {SAFEGUARDING.map(({ Icon, title, copy }) => (
              <Card
                key={title}
                className="h-full p-7 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-display text-lg font-bold tracking-tight">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground">{copy}</p>
              </Card>
            ))}
          </Stagger>

          {/* parking & viewing inline strip */}
          <Stagger className="mt-6 grid gap-4 sm:grid-cols-2" childClassName="h-full">
            {PRACTICAL.map(({ Icon, title, copy }) => (
              <Card key={title} className="flex h-full gap-4 p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1 font-display text-lg font-bold tracking-tight">
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{copy}</p>
                </div>
              </Card>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ───────────── WHERE TO START STRIP ───────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-6xl">
          <FadeRise className="mx-auto mb-12 max-w-2xl text-center">
            <p className="eyebrow mb-3">Brand new here?</p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Three steps to your first class
            </h2>
          </FadeRise>

          <Stagger className="grid gap-4 sm:grid-cols-3" childClassName="h-full">
            {STEPS.map(({ Icon, step, title, copy }) => (
              <Card
                key={title}
                className="h-full p-7 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="eyebrow mb-2">{step}</p>
                <h3 className="mb-2 font-display text-lg font-bold tracking-tight">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground">{copy}</p>
              </Card>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ───────────── CONTACT CTA ───────────── */}
      <section
        id="contact"
        className="relative scroll-mt-24 overflow-hidden px-4 py-20 text-center md:py-28"
      >
        <AmbientGlow variant="duo" />
        <FadeRise className="relative mx-auto max-w-3xl">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <MessageCircleQuestion className="h-7 w-7" />
          </div>
          <h2 className="font-display text-4xl font-extrabold tracking-tight md:text-6xl">
            Still have{" "}
            <em className="font-serif font-normal italic text-primary">
              questions?
            </em>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            If there's anything we haven't covered, ask us — a real person from
            the team will get back to you, usually within a day.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/contact">
                <Phone className="mr-2 h-4 w-4" /> Contact us
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/classes/children">
                Browse classes <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <PoundSterling className="h-3.5 w-3.5 text-primary" />
            No pressure, no surprise costs — just a friendly answer.
          </p>
        </FadeRise>
      </section>
    </div>
  );
};

export default ParentInfo;
