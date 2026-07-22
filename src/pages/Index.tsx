import { useAuth } from "@/contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Zap,
  Sparkles,
  Heart,
  Award,
  ShieldCheck,
  MapPin,
  Star,
} from "lucide-react";
import logo from "@/assets/logo-dark.png";
import GoogleReviews from "@/components/GoogleReviews";
import GrainOverlay from "@/components/immersive/GrainOverlay";
import { Reveal } from "@/components/immersive/Reveal";
import { Marquee } from "@/components/immersive/Marquee";
import { StatCounter } from "@/components/immersive/StatCounter";
import { useMagnetic } from "@/hooks/useMagnetic";
import { useParallax } from "@/hooks/useParallax";
import { ScrollProgress } from "@/components/immersive/ScrollProgress";
import FeaturedVenueCarousel from "@/components/FeaturedVenueCarousel";

const JOURNEY = [
  { stage: "Tots", age: "Ages 3–5", copy: "First steps, big smiles. Rhythm, confidence and play.", tint: "193 100% 44%" },
  { stage: "Juniors", age: "Ages 6–10", copy: "Street & commercial foundations. Crews, routines, showcases.", tint: "260 75% 62%" },
  { stage: "Seniors", age: "Ages 11–17", copy: "Competition-level technique. Stage craft and serious skills.", tint: "300 80% 58%" },
  { stage: "Adults", age: "19+", copy: "Heels, commercial & street. Train hard, feel unstoppable.", tint: "330 90% 55%" },
];

const STATS = [
  { value: 7, suffix: "+", label: "Award-Winning Years" },
  { value: 500, suffix: "+", label: "Dancers & Counting" },
  { value: 12, suffix: "", label: "Classes Every Week" },
  { value: 5, suffix: "", label: "Essex Venues" },
];

const TESTIMONIALS = [
  { quote: "My daughter walked in shy and walked out unstoppable. The energy here is something else.", name: "Sarah M.", role: "Parent, Chelmsford" },
  { quote: "Best decision I made this year. The adult heels class is addictive — proper technique, zero judgement.", name: "Olivia R.", role: "Adult dancer" },
  { quote: "Competition-level coaching with a family feel. The team genuinely care about every kid.", name: "James & Kate", role: "Parents, Braintree" },
];

const Index = () => {
  const { user, role, loading, profile } = useAuth();
  const magBlue = useMagnetic<HTMLDivElement>(0.22);
  const magMag = useMagnetic<HTMLDivElement>(0.22);
  const heroParallax = useParallax<HTMLDivElement>(0.18);

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
      {/* ───────────────── HERO ───────────────── */}
      <section className="relative min-h-[92vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        {/* parallax photographic backdrop */}
        <div ref={heroParallax} className="absolute inset-x-0 -top-[12%] h-[124%] will-change-transform">
          <img src="/img/hero-dancers.jpg" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-background/55" />
        <div className="absolute inset-0 stage-light-blue opacity-60 mix-blend-screen" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent,hsl(220_20%_4%)_84%)]" />
        <GrainOverlay />

        <div className="relative z-10 max-w-4xl animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-8">
            <img src={logo} alt="" className="w-6 h-6 object-contain" />
            Essex's Award-Winning Dance School
          </div>

          <h1 className="font-display font-bold leading-[0.92] tracking-tight text-foreground text-[18vw] sm:text-8xl md:text-[8.5rem] drop-shadow-[0_4px_30px_rgba(0,0,0,0.7)]">
            <span className="block">Move</span>
            <span className="block text-primary drop-shadow-[0_0_40px_hsl(193_100%_44%/0.45)]">Different</span>
          </h1>

          <p
            className="mt-7 text-base md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed"
            style={{ fontFamily: "var(--font-body)", textTransform: "none", letterSpacing: "normal" }}
          >
            High-energy commercial &amp; street dance for children and adults across Essex.
            Step into the spotlight — your first class is waiting.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div ref={magBlue} className="inline-block will-change-transform">
              <Button asChild size="lg" className="text-base px-8 py-6 font-semibold uppercase tracking-wider animate-glow-pulse">
                <Link to={primaryLink}>
                  <Sparkles className="w-4 h-4 mr-2" /> Children's Classes
                </Link>
              </Button>
            </div>
            <div ref={magMag} className="inline-block will-change-transform">
              <Button
                asChild
                size="lg"
                className="text-base px-8 py-6 font-semibold uppercase tracking-wider bg-[hsl(330,90%,55%)] text-white hover:bg-[hsl(330,90%,60%)] shadow-lg shadow-[hsl(330,90%,55%)]/30"
              >
                <Link to={secondaryLink}>
                  <Heart className="w-4 h-4 mr-2" /> Adult Classes
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">Scroll</span>
          <div className="w-5 h-8 rounded-full border border-muted-foreground/30 flex justify-center pt-1.5">
            <span className="w-1 h-1.5 rounded-full bg-primary animate-scroll-cue" />
          </div>
        </div>
      </section>

      {/* ───────────────── MARQUEE TRUST STRIP ───────────────── */}
      <div className="border-y border-border bg-card/40 py-4 text-foreground/90">
        <Marquee
          items={["Award-Winning", "Commercial", "Street", "Heels", "Camps", "Workshops", "Showcases", "Kids", "Adults"]}
          speed={36}
        />
      </div>
      <div className="border-b border-border bg-background py-3 text-muted-foreground/70">
        <Marquee
          items={["As Seen At · UDO", "UK Street Dance Champs", "BDO · Blackpool Tower", "Nation's Best Dance Crew"]}
          reverse
          speed={44}
          accent="text-accent"
        />
      </div>

      {/* ───────────────── FEATURED VENUES (admin-configurable) ───────────────── */}
      <FeaturedVenueCarousel />

      {/* ───────────────── STAT BAND ───────────────── */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-duo opacity-60" />
        <div className="relative container grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s, i) => (
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

      {/* ───────────────── YOUR JOURNEY (blue → magenta grade) ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(180deg, hsl(220 20% 4%), hsl(220 22% 6%)), radial-gradient(80% 60% at 0% 0%, hsl(193 100% 40% / 0.10), transparent 60%), radial-gradient(80% 60% at 100% 100%, hsl(330 90% 55% / 0.12), transparent 60%)",
          }}
        />
        <GrainOverlay />
        <div className="relative container">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">The Journey</p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">From First Steps to the Spotlight</h2>
            <p className="mt-4 text-muted-foreground" style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}>
              One school, every stage of the journey — the lights shift from blue to magenta as our dancers grow.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {JOURNEY.map((j, i) => (
              <Reveal key={j.stage} delay={i * 100}>
                <div
                  className="group relative h-full rounded-2xl border p-6 bg-card/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1.5 overflow-hidden"
                  style={{ borderColor: `hsl(${j.tint} / 0.35)` }}
                >
                  <div
                    className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-40 transition-opacity duration-500 group-hover:opacity-70"
                    style={{ background: `hsl(${j.tint} / 0.5)` }}
                  />
                  <div className="relative">
                    <span className="font-display font-bold text-6xl" style={{ color: `hsl(${j.tint})` }}>
                      0{i + 1}
                    </span>
                    <h3 className="mt-3 font-display text-2xl">{j.stage}</h3>
                    <p className="text-xs uppercase tracking-[0.18em] mt-1" style={{ color: `hsl(${j.tint})` }}>
                      {j.age}
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground" style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}>
                      {j.copy}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── TWO-TRACK SPLIT ───────────────── */}
      <section className="grid md:grid-cols-2">
        {[
          { to: "/classes/children", label: "Children", sub: "Ages 3–17", blurb: "Street, commercial & competition crews", cls: "stage-light-blue", color: "193 100% 44%", Icon: Sparkles, img: "/img/kids-energy.jpg" },
          { to: "/classes/adult", label: "Adults", sub: "19+", blurb: "Heels, commercial & street technique", cls: "stage-light-mag", color: "330 90% 55%", Icon: Heart, img: "/img/adult-heels.jpg" },
        ].map(({ to, label, sub, blurb, cls, color, Icon, img }) => (
          <Link
            key={label}
            to={to}
            className="group relative min-h-[60vh] flex flex-col justify-end p-10 md:p-14 overflow-hidden border-b border-border md:border-b-0 md:[&:first-child]:border-r"
          >
            <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className={`absolute inset-0 ${cls} mix-blend-overlay opacity-50`} />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
            <GrainOverlay />
            <span
              aria-hidden
              className="pointer-events-none absolute right-6 top-6 font-display font-bold text-[14vw] md:text-[8rem] leading-none text-stroke-faint"
            >
              {sub}
            </span>
            <div className="relative">
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-5 border"
                style={{ background: `hsl(${color} / 0.15)`, borderColor: `hsl(${color} / 0.4)`, color: `hsl(${color})` }}
              >
                <Icon className="w-6 h-6" />
              </div>
              <h2 className="font-display font-bold text-5xl md:text-7xl">{label}</h2>
              <p className="mt-2 text-muted-foreground" style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}>
                {blurb}
              </p>
              <span className="mt-6 inline-flex items-center gap-2 font-semibold uppercase tracking-wider text-sm" style={{ color: `hsl(${color})` }}>
                Explore classes
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" />
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* ───────────────── WHY TDE (trust) ───────────────── */}
      <section className="py-24 px-4">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-primary uppercase tracking-[0.3em] text-xs font-semibold mb-3">Why The Dance Exclusive</p>
            <h2 className="font-display font-bold text-4xl md:text-6xl">Serious Training, Proper Family</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { Icon: Award, title: "Award-Winning", copy: "A multi-award-winning school with competition titles and showcase pedigree across Essex and beyond." },
              { Icon: ShieldCheck, title: "DBS-Checked & Insured", copy: "Every instructor is DBS-checked, fully insured and safeguarding-trained. Your child is in safe hands." },
              { Icon: MapPin, title: "5 Essex Venues", copy: "Kelvedon, Braintree, White Notley, Chelmsford & Clacton — a high-energy class near you." },
            ].map(({ Icon, title, copy }, i) => (
              <Reveal key={title} delay={i * 100}>
                <div className="h-full rounded-2xl border border-border bg-card/60 p-8 transition-colors hover:border-primary/40">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-2xl mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground" style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}>
                    {copy}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── TESTIMONIALS ───────────────── */}
      <section className="relative py-24 px-4 overflow-hidden border-y border-border">
        <div className="absolute inset-0 stage-light-mag opacity-40" />
        <div className="relative container">
          <Reveal className="text-center mb-14">
            <div className="flex justify-center gap-1 mb-4 text-accent">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-current" />
              ))}
            </div>
            <h2 className="font-display font-bold text-4xl md:text-6xl">Loved by Essex Families</h2>
          </Reveal>
          <GoogleReviews fallback={TESTIMONIALS} />
        </div>
      </section>

      {/* ───────────────── FINAL CTA ───────────────── */}
      <section className="relative py-28 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 stage-light-duo" />
        <GrainOverlay />
        <Reveal className="relative max-w-3xl mx-auto">
          <h2 className="font-display font-bold text-5xl md:text-8xl leading-[0.95]">
            Ready to <span className="text-primary">move</span> <span className="text-accent">different?</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg" style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}>
            Book your first class today and feel the difference in one session.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="px-9 py-6 text-base font-semibold uppercase tracking-wider">
              <Link to={primaryLink}>
                <Zap className="w-4 h-4 mr-2" /> Book a Class
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="px-9 py-6 text-base font-semibold uppercase tracking-wider border-accent/40 text-foreground hover:bg-accent/10">
              <Link to={secondaryLink}>
                Adult Classes <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
};

export default Index;
