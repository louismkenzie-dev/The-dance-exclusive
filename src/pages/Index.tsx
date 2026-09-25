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
import { venuePath, coachPath, publicClassPath } from "@/lib/publicSchool";
import { supabase } from "@/integrations/supabase/client";
import { PageMeta } from "@/components/marketing/PageMeta";

const photo = (path: string | null) =>
  path?.startsWith("http")
    ? path
    : path
      ? supabase.storage.from("staff-photos").getPublicUrl(path).data.publicUrl
      : null;

export default function Index() {
  const { user, role, loading } = useAuth();
  const { data: school, isError, isLoading } = usePublicSchool();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [motion, setMotion] = useState(true);
  const move = motion && !reducedMotion;
  if (!loading && user && role === "admin")
    return <Navigate to="/admin" replace />;
  if (!loading && user && role === "staff")
    return <Navigate to="/staff" replace />;

  return (
    <div className="tde-home" data-motion={move ? "on" : "off"}>
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
        <div className="tde-hero-top">
          <span className="tde-eyebrow">The Dance Exclusive / Essex, UK</span>
          <span className="tde-eyebrow">
            Commercial. Street. Your kind of energy.
          </span>
        </div>
        <div className="tde-hero-content">
          <h1 id="hero-title">
            STEP IN.
            <br />
            <span>STAND OUT.</span>
          </h1>
          <div className="tde-hero-bottom">
            <p>
              A place to find your rhythm.
              <br />
              And a whole lot more.
            </p>
            <a href="#find-your-class" className="tde-button">
              Find your class <ArrowUpRight size={22} aria-hidden />
            </a>
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
              GOOD MUSIC. GOOD PEOPLE. GREAT ENERGY. <i>✳</i> MADE TO MOVE.{" "}
              <i>✳</i>{" "}
            </span>
          ))}
        </div>
      </div>

      <section className="tde-intro tde-paper" id="the-feeling">
        <div className="tde-section-note">
          <span>01 / MORE THAN MOVEMENT</span>
          <span>THIS IS THE DANCE EXCLUSIVE</span>
        </div>
        <div className="tde-intro-grid">
          <div className="tde-intro-images">
            <MotionMedia
              image="/media/tde-community.jpg"
              alt="The Dance Exclusive dancers together"
              active={move}
            />
            <span className="tde-image-stamp">
              FIND YOUR
              <br />
              PEOPLE.
            </span>
          </div>
          <div className="tde-intro-copy">
            <h2>
              COME FOR
              <br />
              THE DANCE.
              <br />
              <span>
                STAY FOR
                <br />
                THE FEELING.
              </span>
            </h2>
            <p>
              The music comes on. The outside world switches off. From that
              first eight-count to your next big moment, there's a place for you
              here.
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
        {school && (
          <div className="tde-live-stats">
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
        <div className="tde-section-note">
          <span>02 / YOUR FLOOR IS WAITING</span>
          <span>FIRST TIMERS TO FULL-TIMERS</span>
        </div>
        <div className="tde-section-heading">
          <h2>
            FIND YOUR
            <br />
            <em>FREQUENCY.</em>
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
              title: "THE NEXT\nGENERATION.",
              sub: "Children's classes",
              image: "/img/kids-energy.jpg",
              copy: "Big energy. Growing confidence. A place to be themselves.",
            },
            {
              type: "adult",
              title: "YOUR TIME.\nYOUR ENERGY.",
              sub: "Adult classes",
              image: "/img/adult-heels.jpg",
              copy: "Switch off the day. Turn up the music. Make your move.",
            },
          ].map((item, i) => (
            <Link
              to={`/classes?type=${item.type}`}
              key={item.type}
              className={`tde-class-panel tde-class-panel-${item.type}`}
            >
              <MotionMedia
                image={item.image}
                alt={
                  item.type === "adult"
                    ? "Dancers in a heels class"
                    : "Young dancers in a studio"
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
          <span className="tde-eyebrow">ON THE TIMETABLE</span>
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
            school?.classes.slice(0, 4).map((item) => {
              const venue = school.venues.find((v) => v.id === item.venue_id);
              const price = classPriceSummary(item, item.remainingSessions);
              return (
                <Link
                  to={publicClassPath(item)}
                  key={item.id}
                  className="tde-class-row"
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
        <div className="tde-section-note">
          <span>03 / FEEL THE ROOM</span>
          <span>REAL PEOPLE. ALL ENERGY.</span>
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
        <div className="tde-film-bottom">
          <h2>
            THERE'S SOMETHING
            <br />
            ABOUT THIS PLACE.
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
        <div className="tde-section-note">
          <span>04 / CLOSE TO HOME</span>
          <span>ALL ACROSS ESSEX</span>
        </div>
        <div className="tde-venues-grid">
          <div>
            <h2>
              BIG ENERGY.
              <br />
              <em>LOCAL ROOTS.</em>
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
                image="/media/tde-school.jpg"
                alt="The Dance Exclusive dancers performing together"
                active={move}
              />
            </div>
          </div>
          <div className="tde-venue-list">
            {school?.venues.slice(0, 7).map((venue, index) => (
              <Link to={venuePath(venue)} key={venue.id}>
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
              GOOD PEOPLE.
              <br />
              <em>GREAT MOVES.</em>
            </h2>
            <Link to="/team" className="tde-text-link">
              Meet the whole team <ArrowUpRight size={20} aria-hidden />
            </Link>
          </div>
          <div className="tde-crew-grid">
            {school.coaches
              .filter((coach) => coach.profile_photo)
              .slice(0, 4)
              .map((coach, i) => (
                <Link
                  to={coachPath(coach)}
                  key={coach.id}
                  className="tde-coach-card"
                >
                  <div className="tde-coach-photo">
                    <MotionMedia
                      image={photo(coach.profile_photo) ?? ""}
                      alt={`${coach.first_name}, The Dance Exclusive coach`}
                      active={move}
                      travel={30}
                    />
                    <span>0{i + 1}</span>
                  </div>
                  <div>
                    <h3>{coach.first_name}</h3>
                    <ArrowUpRight size={22} aria-hidden />
                  </div>
                  <p>
                    {coach.dance_skills?.slice(0, 2).join(" / ") ||
                      "The Dance Exclusive team"}
                  </p>
                </Link>
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
              MORE REASONS
              <br />
              <em>TO MOVE.</em>
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
