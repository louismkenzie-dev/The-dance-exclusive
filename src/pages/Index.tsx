import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicSchool } from "@/hooks/usePublicSchool";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MotionMedia } from "@/components/marketing/MotionMedia";
import {
  classDaysLabel,
  classPriceSummary,
  shortDateRange,
} from "@/lib/classPresentation";
import { venuePath, publicClassPath } from "@/lib/publicSchool";
import { isFounderCoach } from "@/lib/publicCoaches";
import { CoachCard, FounderSpotlight } from "@/components/marketing/CoachProfiles";
import { PageMeta } from "@/components/marketing/PageMeta";
import { useEntranceMotion } from "@/hooks/useEntranceMotion";

export default function Index() {
  const { user, role, loading } = useAuth();
  const { data: school, isError, isLoading } = usePublicSchool();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [motion, setMotion] = useState(true);
  const move = motion && !reducedMotion;
  const home = useEntranceMotion(move, Boolean(school));
  const founder = school?.coaches.find(isFounderCoach);
  if (!loading && user && role === "admin")
    return <Navigate to="/admin" replace />;
  if (!loading && user && role === "staff")
    return <Navigate to="/staff" replace />;

  return (
    <div ref={home} className="tde-home" data-motion={move ? "on" : "off"}>
      <PageMeta
        title="Step in. Stand out."
        description="Find your rhythm at The Dance Exclusive. Commercial and street dance for children and adults across Essex. Explore live classes, venues and events."
        path="/"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "The Dance Exclusive",
          url: "https://www.thedanceexclusive.co.uk",
          areaServed: { "@type": "AdministrativeArea", name: "Essex, UK" },
        }}
      />
      <section className="tde-hero" aria-labelledby="hero-title">
        <MotionMedia
          image="/media/tde-film-poster.jpg"
          video="/media/tde-hero-film.mp4"
          alt="The Dance Exclusive dancers performing together on stage"
          className="tde-hero-media"
          active={move}
          eager
          travel={70}
        />
        <div className="tde-hero-shade" />
        <div className="tde-hero-top" data-entrance="hero">
          <span className="tde-eyebrow"><i aria-hidden="true" /> Essex. This is your stage.</span>
          <span className="tde-eyebrow">
            Commercial. Street. Your kind of energy.
          </span>
        </div>
        <div className="tde-hero-content">
          <h1 id="hero-title" aria-label="Step in. Stand out.">
            <span className="tde-hero-line"><span data-entrance="hero" data-delay="100">Step in<span className="tde-brand-dot">.</span></span></span>
            <span className="tde-hero-line"><span data-entrance="hero" data-delay="220">Stand out.</span></span>
          </h1>
          <div className="tde-hero-bottom" data-entrance="hero" data-delay="330">
            <p>
              Giving young people a stage<br />
              to become their best selves.
            </p>
            <div className="tde-hero-actions">
              <span>Children + adults. Beginners welcome.</span>
              <a href="#find-your-class" className="tde-button">
                Find your class <ArrowUpRight size={22} aria-hidden />
              </a>
            </div>
          </div>
        </div>
        <div className="tde-hero-caption">
          <a href="#the-feeling">
            Scroll to feel it <ArrowDown size={15} aria-hidden />
          </a>
          <button
            onClick={() => setMotion(!motion)}
            disabled={reducedMotion}
            aria-pressed={!move}
          >
            {move ? (
              <Pause size={14} aria-hidden />
            ) : (
              <Play size={14} aria-hidden />
            )}
            {reducedMotion
              ? "Reduced motion"
              : move
                ? "Pause motion"
                : "Play motion"}
          </button>
          <span>Children + adults / All levels</span>
        </div>
      </section>

      <div className="tde-ticker" aria-hidden="true">
        <div>
          {[0, 1, 2, 3].map((n) => (
            <span key={n}>
              DANCE. <i>✳</i> GROW. <i>✳</i> ACHIEVE. <i>✳</i>{" "}
            </span>
          ))}
        </div>
      </div>

      <section className="tde-intro" id="the-feeling">
        <div className="tde-section-note" data-entrance="">
          <span>01 / More than movement</span>
          <span>THIS IS THE DANCE EXCLUSIVE</span>
        </div>
        <div className="tde-intro-grid">
          <div className="tde-intro-images" data-entrance="">
            <div className="tde-intro-main-photo">
              <MotionMedia
                image="/media/tde-community.jpg"
                alt="The Dance Exclusive dancers performing together on stage"
                active={move}
                travel={55}
              />
            </div>
            <div className="tde-intro-inset">
              <MotionMedia
                image="/media/tde-class-confidence.jpg"
                alt="A smiling young dancer practising in a Dance Exclusive class"
                active={move}
                travel={-30}
              />
              <span>Little steps. Big confidence.</span>
            </div>
            <span className="tde-image-stamp">
              Your people.<br />Your place.
            </span>
          </div>
          <div className="tde-intro-copy">
            <h2 className="tde-signature" aria-label="Dance. Grow. Achieve.">
              <span data-entrance="">Dance<span>.</span></span>
              <span data-entrance="" data-delay="100">Grow<span>.</span></span>
              <span data-entrance="" data-delay="200">Achieve<span>.</span></span>
            </h2>
            <div data-entrance="" data-delay="200">
              <p>
                First steps or centre stage, confidence grows here. Real classes,
                brilliant teachers and people who cheer you on. This is your
                space to find out what you can do.
              </p>
              <p>
                Commercial and street dance for children and adults across Essex.
                Come as you are. We'll find your next move together.
              </p>
              <Link to="/about" className="tde-text-link">
                Get to know us <ArrowUpRight size={20} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
        {school && (
          <div className="tde-live-stats" data-entrance="">
            <div>
              <strong>
                {school.classes.length.toString().padStart(2, "0")}
              </strong>
              <span>Classes to discover</span>
            </div>
            <div>
              <strong>
                {school.venues.length.toString().padStart(2, "0")}
              </strong>
              <span>Places to move</span>
            </div>
            <div>
              <strong>
                {(
                  school.coaches.length ||
                  new Set(
                    school.classes
                      .map((item) => item.dance_style)
                      .filter(Boolean),
                  ).size
                )
                  .toString()
                  .padStart(2, "0")}
              </strong>
              <span>
                {school.coaches.length
                  ? "Faces behind the feeling"
                  : "Styles to explore"}
              </span>
            </div>
            <p>
              One dance family. <br />
              Room for your next chapter.
            </p>
          </div>
        )}
      </section>

      <section className="tde-classes tde-paper" id="find-your-class">
        <div className="tde-section-note" data-entrance="">
          <span>02 / YOUR FLOOR IS WAITING</span>
          <span>FIRST TIMERS TO FULL-TIMERS</span>
        </div>
        <div className="tde-section-heading" data-entrance="">
          <h2>
            Find your
            <br />
            <em>next move.</em>
          </h2>
          <p>
            A first class. A fresh challenge.
            <br />
            Something that's just for you.
          </p>
        </div>
        <div className="tde-class-panels">
          {[
            {
              type: "children",
              title: "The next\ngeneration.",
              sub: "Children's classes",
              image: "/media/tde-school.jpg",
              copy: "Big energy. Growing confidence. A place to be themselves.",
            },
            {
              type: "adult",
              title: "Your time.\nYour energy.",
              sub: "Adult classes",
              image: "/media/tde-adult-community.jpg",
              copy: "Switch off the day. Turn up the music. Make your move.",
            },
          ].map((item, i) => (
            <Link
              to={`/classes?type=${item.type}`}
              key={item.type}
              className={`tde-class-panel tde-class-panel-${item.type}`}
              data-entrance=""
              data-delay={i * 120}
            >
              <MotionMedia
                image={item.image}
                alt={
                  item.type === "adult"
                    ? "The Dance Exclusive adult dancers together in their studio"
                    : "The Dance Exclusive young dancers performing on stage"
                }
                active={move}
              />
              <div className="tde-panel-top">
                <span>
                  0{i + 1} / {item.sub}
                </span>
                <ArrowUpRight size={32} aria-hidden />
              </div>
              <div className="tde-panel-copy">
                <h3>
                  {item.title.split("\n").map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </h3>
                <p>{item.copy}</p>
                <span className="tde-panel-link">
                  Explore {item.sub.toLowerCase()}{" "}
                  <ArrowUpRight size={17} aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="tde-class-list-heading">
          <span className="tde-eyebrow">On the TIMETABLE</span>
          <Link to="/classes?type=children" className="tde-text-link">
            Explore classes <ArrowUpRight size={17} aria-hidden />
          </Link>
        </div>
        <div className="tde-class-list">
          {isLoading ? (
            <p className="tde-loading" role="status">
              Finding your next class…
            </p>
          ) : isError ? (
            <p className="tde-loading">
              The timetable is taking a moment.{" "}
              <Link to="/classes?type=children">Open the class browser</Link>.
            </p>
          ) : (
            school?.classes.slice(0, 4).map((item, index) => {
              const venue = school.venues.find((v) => v.id === item.venue_id);
              const price = classPriceSummary(item, item.remainingSessions);
              return (
                <Link
                  to={publicClassPath(item)}
                  key={item.id}
                  className="tde-class-row"
                  data-entrance=""
                  data-delay={index * 70}
                >
                  <span className="tde-class-type">
                    {item.class_type === "adult" ? "ADULTS" : "CHILDREN"}
                  </span>
                  <div>
                    <h3>{item.name}</h3>
                    <span>
                      {venue?.city || venue?.name || "View venue details"}
                    </span>
                  </div>
                  <span>
                    {classDaysLabel(item.days_of_week, item.day_of_week)}
                    <small>
                      {item.start_time.slice(0, 5)} –{" "}
                      {item.end_time.slice(0, 5)}
                    </small>
                  </span>
                  <span className="tde-class-price">
                    {price.priceLabel}
                    <small>{price.priceHint}</small>
                  </span>
                  <ArrowUpRight size={23} aria-hidden />
                </Link>
              );
            })
          )}
        </div>
      </section>

      <section className="tde-film-section">
        <div className="tde-section-note" data-entrance="">
          <span>03 / Feel the ROOM</span>
          <span>REAL people. ALL energy.</span>
        </div>
        <div className="tde-film-stage">
          <div className="tde-film-type" aria-hidden="true">
            ALL
            <br />
            <span>IN.</span>
          </div>
          <MotionMedia
            image="/media/tde-film-poster.jpg"
            video="/media/tde-performance-film.mp4"
            alt="The Dance Exclusive performing on stage"
            active={move}
            travel={65}
          />
          <span className="tde-film-label">THE MUSIC IS JUST THE START.</span>
        </div>
        <div className="tde-film-bottom" data-entrance="">
          <h2>
            There's something
            <br />
            about this place.
          </h2>
          <div>
            <p>
              The shared routine. The little breakthroughs. The friends cheering
              you on. Find out what happens when you give yourself room to move.
            </p>
            <Link to="/gallery" className="tde-text-link">
              Life at The Dance Exclusive <ArrowUpRight size={19} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="tde-venues-section tde-paper">
        <div className="tde-section-note" data-entrance="">
          <span>04 / CLOSE TO HOME</span>
          <span>ALL ACROSS ESSEX</span>
        </div>
        <div className="tde-venues-grid">
          <div data-entrance="">
            <h2>
              Big energy.
              <br />
              <em>Local roots.</em>
            </h2>
            <p>
              Your next class could be closer than you think. Find your local
              studio and see what's happening there.
            </p>
            <Link to="/venues" className="tde-button tde-button-dark">
              Find a location <ArrowUpRight size={20} aria-hidden />
            </Link>
            <div className="tde-location-photo">
              <MotionMedia
                image="/media/tde-children-stage.jpg"
                alt="The Dance Exclusive dancers performing together"
                active={move}
              />
            </div>
          </div>
          <div className="tde-venue-list">
            {school?.venues.slice(0, 7).map((venue, index) => (
              <Link to={venuePath(venue)} key={venue.id} data-entrance="" data-delay={index * 45}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{venue.city || venue.name}</h3>
                  <p>{venue.name}</p>
                </div>
                <ArrowUpRight size={24} aria-hidden />
              </Link>
            ))}
            {!school && (
              <Link to="/venues">
                <span>↗</span>
                <h3>Explore our locations</h3>
              </Link>
            )}
            {school && school.venues.length > 7 && (
              <Link to="/venues" className="tde-all-venues">
                All {school.venues.length} locations{" "}
                <ArrowUpRight size={20} aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </section>

      {school && school.coaches.length > 0 && (
        <section className="tde-crew-section">
          <div className="tde-section-note">
            <span>05 / THE PEOPLE BEHIND IT</span>
            <span>MEET YOUR HYPE TEAM</span>
          </div>
          <div className="tde-section-heading">
            <h2>
              GOOD people.
              <br />
              <em>Great moves.</em>
            </h2>
            <Link to="/team" className="tde-text-link">
              Meet the whole team <ArrowUpRight size={20} aria-hidden />
            </Link>
          </div>
          {founder && <FounderSpotlight coach={founder} active={move} />}
          <div className="tde-crew-grid">
            {school.coaches
              .filter((coach) => !isFounderCoach(coach))
              .slice(0, 4)
              .map((coach, i) => (
                <CoachCard key={coach.id} coach={coach} active={move} index={i} />
              ))}
          </div>
        </section>
      )}

      {school && school.camps.length > 0 && (
        <section className="tde-events-section tde-paper">
          <div className="tde-section-note">
            <span>06 / KEEP THE GOOD TIMES COMING</span>
            <span>CAMPS + WORKSHOPS</span>
          </div>
          <div className="tde-section-heading">
            <h2>
              More reasons
              <br />
              <em>to move.</em>
            </h2>
            <Link to="/events" className="tde-text-link">
              What's coming up <ArrowUpRight size={20} aria-hidden />
            </Link>
          </div>
          <div className="tde-event-list">
            {school.camps.slice(0, 3).map((camp) => (
              <Link key={camp.id} to={`/events/${camp.id}`}>
                <span>{shortDateRange(camp.start_date, camp.end_date)}</span>
                <h3>{camp.name}</h3>
                <span>
                  {camp.class_type === "adult" ? "Adults" : "Children"}
                </span>
                <ArrowUpRight size={26} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
