import { useAuth } from "@/contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Zap,
  Sparkles,
  Heart,
  Award,
  ShieldCheck,
  MapPin,
  Star,
  Quote,
  QrCode,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import logo from "@/assets/logo-dark.png";
import { ScrollProgress } from "@/components/immersive/ScrollProgress";
import { FadeRise, Stagger, AnimatedNumber, AmbientGlow } from "@/components/motion";
import FeaturedVenueCarousel from "@/components/FeaturedVenueCarousel";

const JOURNEY = [
  {
    stage: "Tots",
    age: "Ages 3–5",
    copy: "First steps, big smiles. Rhythm, confidence and play.",
    Icon: Sparkles,
    tile: "bg-primary/10 text-primary",
    accent: "text-primary",
  },
  {
    stage: "Juniors",
    age: "Ages 6–10",
    copy: "Street & commercial foundations. Crews, routines, showcases.",
    Icon: Zap,
    tile: "bg-primary/15 text-primary",
    accent: "text-primary",
  },
  {
    stage: "Seniors",
    age: "Ages 11–16",
    copy: "Competition-level technique. Stage craft and serious skills.",
    Icon: Star,
    tile: "bg-accent/10 text-accent",
    accent: "text-accent",
  },
  {
    stage: "Adults",
    age: "16+",
    copy: "Heels, commercial & street. Train hard, feel unstoppable.",
    Icon: Heart,
    tile: "bg-accent/15 text-accent",
    accent: "text-accent",
  },
];

const STATS = [
  { value: 10, suffix: "+", label: "Award-winning years" },
  { value: 500, suffix: "+", label: "Dancers & counting" },
  { value: 12, suffix: "", label: "Classes every week" },
  { value: 5, suffix: "", label: "Essex venues" },
];

const SEEN_AT = ["UDO", "UK Street Dance Champs", "BDO · Blackpool Tower", "Nation's Best Dance Crew"];

const DISCIPLINES = [
  "Award-winning",
  "Commercial",
  "Street",
  "Heels",
  "Camps",
  "Workshops",
  "Showcases",
  "Kids",
  "Adults",
];

const TESTIMONIALS = [
  { quote: "My daughter walked in shy and walked out unstoppable. The energy here is something else.", name: "Sarah M.", role: "Parent, Chelmsford" },
  { quote: "Best decision I made this year. The adult heels class is addictive — proper technique, zero judgement.", name: "Olivia R.", role: "Adult dancer" },
  { quote: "Competition-level coaching with a family feel. The team genuinely care about every kid.", name: "James & Kate", role: "Parents, Braintree" },
];

const WHY_TDE = [
  { Icon: Award, title: "Award-winning", copy: "A multi-award-winning school with competition titles and showcase pedigree across Essex and beyond." },
  { Icon: ShieldCheck, title: "DBS-checked & insured", copy: "Every instructor is DBS-checked, fully insured and safeguarding-trained. Your child is in safe hands." },
  { Icon: MapPin, title: "5 Essex venues", copy: "Kelvedon, Braintree, White Notley, Chelmsford & Clacton — a high-energy class near you." },
];

const POCKET_FEATURES = [
  { Icon: QrCode, title: "QR check-in", copy: "Scan in at the door — no paper registers, no queues.", tile: "bg-primary/10 text-primary" },
  { Icon: CalendarDays, title: "Book in seconds", copy: "Classes, camps and payments managed in one calm place.", tile: "bg-accent/10 text-accent" },
  { Icon: TrendingUp, title: "Watch them grow", copy: "Attendance and progress, always at a glance.", tile: "bg-success/10 text-success" },
];

const Index = () => {
  const { user, role, loading, profile } = useAuth();

  if (!loading && user && role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  const customerType = profile?.customer_type as string | null;
  const primaryIsAdult = customerType === "adult_dancer";
  const primaryLink = primaryIsAdult ? "/classes/adult" : "/classes/children";
  const secondaryLink = primaryIsAdult ? "/classes/children" : "/classes/adult";

  return (
    <div className="bg-background text-foreground overflow-x-clip">
      <ScrollProgress />

      {/* ───────────────── HERO — aurora light ───────────────── */}
      <section className="relative overflow-hidden px-4 pt-20 md:pt-28 pb-16 md:pb-24">
        <AmbientGlow variant="light" />
        <div className="relative container max-w-7xl text-center">
          <FadeRise>
            <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 shadow-soft">
              <img src={logo} alt="" className="w-6 h-6 object-contain" />
              <span className="eyebrow">Essex's award-winning dance school</span>
            </span>
          </FadeRise>

          <FadeRise delay={80}>
            <h1 className="mt-8 font-display font-extrabold tracking-tight text-5xl md:text-7xl">
              Move <em className="font-serif italic font-normal text-primary">different.</em>
            </h1>
            <p className="mt-6 text-base md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
              High-energy commercial &amp; street dance for children and adults across Essex.
              Step into the spotlight — your first class is waiting.
            </p>
          </FadeRise>

          <FadeRise delay={160}>
            <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild size="lg" className="px-8 text-base">
                <Link to={primaryLink}>
                  <Sparkles className="w-4 h-4 mr-2" /> Children's classes
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="px-8 text-base bg-foreground text-background hover:bg-foreground/90"
              >
                <Link to={secondaryLink}>
                  <Heart className="w-4 h-4 mr-2 text-accent" /> Adult classes
                </Link>
              </Button>
            </div>
          </FadeRise>

          <FadeRise delay={240} className="mt-14">
            <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl shadow-soft-xl">
              <img
                src="/img/hero-dancers.jpg"
                alt="Dancers from The Dance Exclusive performing"
                className="w-full aspect-[16/9] object-cover"
              />
              <div aria-hidden className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-foreground/10" />
            </div>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── QUIET TRUST STRIP ───────────────── */}
      <section className="border-y border-border/60 bg-card/60 py-8 px-4">
        <FadeRise className="container max-w-7xl flex flex-col items-center gap-4 text-center">
          <p className="eyebrow">As seen at</p>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-2 text-sm font-semibold text-muted-foreground">
            {SEEN_AT.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {DISCIPLINES.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </FadeRise>
      </section>

      {/* ───────────────── FEATURED VENUES (admin-configurable) ───────────────── */}
      <FeaturedVenueCarousel />

      {/* ───────────────── STAT BAND ───────────────── */}
      <section className="py-16 md:py-24 px-4">
        <Stagger className="container max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5" childClassName="h-full">
          {STATS.map((s) => (
            <Card
              key={s.label}
              className="h-full p-6 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
            >
              <p className="eyebrow">{s.label}</p>
              <p className="mt-3 text-3xl md:text-4xl font-display font-bold tabular-nums text-foreground">
                <AnimatedNumber value={s.value} suffix={s.suffix} />
              </p>
            </Card>
          ))}
        </Stagger>
      </section>

      {/* ───────────────── YOUR JOURNEY (blue → magenta) ───────────────── */}
      <section className="relative overflow-hidden bg-secondary/40 py-16 md:py-24 px-4">
        <AmbientGlow variant="duo" />
        <div className="relative container max-w-7xl">
          <FadeRise className="text-center max-w-2xl mx-auto mb-12">
            <p className="eyebrow mb-3">The journey</p>
            <h2 className="font-display font-bold tracking-tight text-3xl md:text-5xl">
              From first steps to the spotlight
            </h2>
            <p className="mt-3 text-muted-foreground">
              One school, every stage of the journey — the lights shift from blue to magenta as our dancers grow.
            </p>
          </FadeRise>

          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5" childClassName="h-full">
            {JOURNEY.map(({ stage, age, copy, Icon, tile, accent }) => (
              <Card
                key={stage}
                className="h-full p-6 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tile}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <h3 className="mt-4 font-display font-bold tracking-tight text-xl">{stage}</h3>
                <p className={`mt-0.5 text-sm font-medium ${accent}`}>{age}</p>
                <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
              </Card>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── TWO-TRACK SPLIT ───────────────── */}
      <section className="py-16 md:py-24 px-4">
        <div className="container max-w-7xl grid md:grid-cols-2 gap-5 md:gap-6">
          {/* Children — light with a blue wash */}
          <FadeRise>
            <Link
              to="/classes/children"
              className="group relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-[2rem] p-8 md:p-10 shadow-soft-lg transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-xl"
            >
              <img
                src="/img/kids-energy.jpg"
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div aria-hidden className="absolute inset-0 bg-primary/20 mix-blend-multiply" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              <div className="relative">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card/85 text-primary shadow-soft backdrop-blur">
                  <Sparkles className="w-6 h-6" />
                </span>
                <h2 className="mt-5 font-display font-bold tracking-tight text-3xl md:text-4xl">Children</h2>
                <p className="mt-1 text-sm font-medium text-primary">Ages 3–16</p>
                <p className="mt-2 text-muted-foreground">Street, commercial &amp; competition crews</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Explore classes
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" />
                </span>
              </div>
            </Link>
          </FadeRise>

          {/* Adults — the night panel (club flavour) */}
          <FadeRise delay={100}>
            <Link
              to="/classes/adult"
              className="dark group relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-[2rem] bg-background p-8 md:p-10 shadow-soft-lg transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-xl"
            >
              <img
                src="/img/adult-heels.jpg"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-80 transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <AmbientGlow variant="night" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              <div className="relative text-foreground">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent backdrop-blur">
                  <Heart className="w-6 h-6" />
                </span>
                <h2 className="mt-5 font-display font-bold tracking-tight text-3xl md:text-4xl">Adults</h2>
                <p className="mt-1 text-sm font-medium text-accent">16+</p>
                <p className="mt-2 text-muted-foreground">Heels, commercial &amp; street technique</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">
                  Explore classes
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" />
                </span>
              </div>
            </Link>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── WHY TDE (trust) ───────────────── */}
      <section className="bg-secondary/40 py-16 md:py-24 px-4">
        <div className="container max-w-7xl">
          <FadeRise className="text-center max-w-2xl mx-auto mb-12">
            <p className="eyebrow mb-3">Why The Dance Exclusive</p>
            <h2 className="font-display font-bold tracking-tight text-3xl md:text-5xl">
              Serious training, proper family
            </h2>
          </FadeRise>
          <Stagger className="grid md:grid-cols-3 gap-4 md:gap-5" childClassName="h-full">
            {WHY_TDE.map(({ Icon, title, copy }) => (
              <Card
                key={title}
                className="h-full p-8 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="w-5 h-5" />
                </span>
                <h3 className="mt-5 font-display font-bold tracking-tight text-xl">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
              </Card>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── TESTIMONIALS ───────────────── */}
      <section className="py-16 md:py-24 px-4">
        <div className="container max-w-7xl">
          <FadeRise className="text-center mb-12">
            <div className="flex justify-center gap-1 mb-4 text-accent">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-current" />
              ))}
            </div>
            <h2 className="font-display font-bold tracking-tight text-3xl md:text-5xl">
              Loved by Essex families
            </h2>
          </FadeRise>
          <Stagger className="grid md:grid-cols-3 gap-4 md:gap-5" childClassName="h-full">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="h-full p-8 flex flex-col">
                <figure className="flex h-full flex-col">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Quote className="w-5 h-5" />
                  </span>
                  <blockquote className="mt-4 flex-1 text-foreground/90 leading-relaxed">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-6 pt-4 border-t border-border/50">
                    <span className="block text-sm font-semibold">{t.name}</span>
                    <span className="block text-xs text-muted-foreground">{t.role}</span>
                  </figcaption>
                </figure>
              </Card>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ───────────────── EVERYTHING IN YOUR POCKET ───────────────── */}
      <section className="relative overflow-hidden bg-secondary/40 py-16 md:py-24 px-4">
        <AmbientGlow variant="light" />
        <div className="relative container max-w-7xl grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <FadeRise>
            <p className="eyebrow mb-3">The TDE portal</p>
            <h2 className="font-display font-bold tracking-tight text-3xl md:text-5xl">
              Everything in your pocket
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md">
              Bookings, payments and check-ins live in one calm portal — built for busy
              parents and busy dancers.
            </p>
            <div className="mt-8 space-y-4">
              {POCKET_FEATURES.map(({ Icon, title, copy, tile }) => (
                <div key={title} className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tile}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-muted-foreground">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeRise>

          {/* CSS-built iPhone frame with a miniature portal UI */}
          <FadeRise delay={120}>
            <div aria-hidden className="relative mx-auto w-[19rem] md:rotate-2">
              <div className="rounded-[3rem] bg-foreground p-2.5 shadow-soft-xl">
                <div className="overflow-hidden rounded-[2.5rem] bg-background">
                  <div className="mx-auto mt-2.5 h-1.5 w-20 rounded-full bg-foreground/20" />
                  <div className="p-4 pb-6 space-y-3">
                    <div className="pt-1">
                      <p className="eyebrow">Good evening</p>
                      <p className="font-display font-bold tracking-tight text-lg">Ava's classes</p>
                    </div>

                    {/* QR check-in card */}
                    <Card className="p-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <QrCode className="w-5 h-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">QR check-in</p>
                        <p className="text-xs text-muted-foreground">Scan at the door</p>
                      </div>
                      <Badge variant="success">Ready</Badge>
                    </Card>

                    {/* Booking row */}
                    <Card className="p-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                        <CalendarDays className="w-5 h-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Street &amp; commercial</p>
                        <p className="text-xs text-muted-foreground">Tue 5:30pm · Kelvedon</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </Card>

                    {/* Stat ring */}
                    <Card className="p-4 flex items-center gap-4">
                      <span className="relative h-12 w-12 shrink-0">
                        <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
                          <circle cx="24" cy="24" r="20" fill="none" strokeWidth="5" className="stroke-secondary" />
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            fill="none"
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray="125.6"
                            strokeDashoffset="31.4"
                            className="stroke-primary"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center font-display text-[10px] font-bold tabular-nums">
                          75%
                        </span>
                      </span>
                      <div>
                        <p className="text-sm font-semibold">This term</p>
                        <p className="text-xs text-muted-foreground">9 of 12 classes attended</p>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </FadeRise>
        </div>
      </section>

      {/* ───────────────── FINAL CTA — night band ───────────────── */}
      <section className="px-4 py-16 md:py-24">
        <FadeRise className="container max-w-7xl">
          <div className="dark relative overflow-hidden rounded-[2.5rem] bg-background px-6 py-16 md:py-24 text-center shadow-soft-xl">
            <AmbientGlow variant="night" />
            <div className="relative max-w-3xl mx-auto">
              <h2 className="font-display font-extrabold tracking-tight text-4xl md:text-6xl text-foreground">
                Ready to move <em className="font-serif italic font-normal text-accent">different?</em>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Book your first class today and feel the difference in one session.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="px-8 text-base">
                  <Link to={primaryLink}>
                    <Zap className="w-4 h-4 mr-2" /> Book a class
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary" className="px-8 text-base">
                  <Link to={secondaryLink}>
                    Adult classes <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </FadeRise>
      </section>
    </div>
  );
};

export default Index;
