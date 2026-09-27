import { tdePhoto } from "@/lib/tdeMedia";
import { ClassMedia } from "@/components/marketing/ClassMedia";
import { useState } from "react";
import { RhythmHero } from "@/components/marketing/RhythmHero";
import { Link, Navigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicSchool } from "@/hooks/usePublicSchool";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MotionMedia } from "@/components/marketing/MotionMedia";
import {
  shortDateRange,
} from "@/lib/classPresentation";
import { HomeLocations } from "@/components/marketing/HomeDiscovery";
import { CoachPhotoGrid } from "@/components/marketing/CoachProfiles";
import { PageMeta } from "@/components/marketing/PageMeta";
import { useHomeChoreography } from "@/hooks/useHomeChoreography";
import { DanceScrollScene } from "@/components/marketing/DanceScrollScene";

export default function Index() {
  const { user, role, loading } = useAuth();
  const { data: school, isError, isLoading } = usePublicSchool();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [motion, setMotion] = useState(true);
  const move = motion && !reducedMotion;
  const home = useHomeChoreography(move);
  if (!loading && user && role === "admin")
    return <Navigate to="/admin" replace />;
  if (!loading && user && role === "staff")
    return <Navigate to="/staff" replace />;

  return (
    <div ref={home} className="tde-home tde-home-v2" data-motion={move ? "on" : "off"}>
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
      <RhythmHero active={move} reduced={reducedMotion} onToggle={() => setMotion(value => !value)} />

      <section className="tde-classes tde-paper" id="find-your-class">
        <div className="tde-section-note" data-entrance="">
          <span>FIND YOUR CREW</span>
          <span>FIRST TIMERS TO FULL-TIMERS</span>
        </div>
        <div className="tde-section-heading" data-entrance="">
          <h2>
            Find your
            <br />
            <em>crew.</em>
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
              image: tdePhoto("young-crew").src,
              copy: "Big energy. Growing confidence. A place to be themselves.",
            },
            {
              type: "adult",
              title: "Your time.\nYour energy.",
              sub: "Adult classes",
              image: tdePhoto("studio-energy").src,
              copy: "Switch off the day. Turn up the music. Make your move.",
            },
          ].map((item, i) => (
            <Link
              to={`/classes?type=${item.type}`}
              key={item.type}
              className={`tde-class-panel tde-class-panel-${item.type}`}
              data-audience={item.type}
              data-entrance=""
              data-delay={i * 120}
            >
              <MotionMedia
                image={item.image}
                alt={
                  item.type === "adult"
                    ? "A Dance Exclusive dancer in a blue and pink-lit studio"
                    : "The Dance Exclusive young dancers performing on stage"
                }
                active={move}
              />
              <div className="tde-panel-top">
                <span>
                  {item.sub}
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
      </section>

      <DanceScrollScene active={move} reduced={reducedMotion} onToggle={() => setMotion(value => !value)} />
      <section className="tde-intro" id="the-feeling">
        <div className="tde-section-note" data-entrance="">
          <span>YOUR FIRST SESSION</span>
          <span>LET’S GET YOU STARTED</span>
        </div>
        <div className="tde-intro-grid">
          <div className="tde-intro-images" data-entrance="">
            <div className="tde-intro-main-photo">
              <MotionMedia
                image="/media/tde-film-poster.jpg"
                video="/media/tde-performance-film.mp4"
                alt="The Dance Exclusive dancers performing together on stage"
                active={move}
                travel={55}
              />
            </div>
            <div className="tde-intro-inset">
              <MotionMedia
                image={tdePhoto("first-moves").src}
                alt={tdePhoto("first-moves").alt}
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
            <h2 className="tde-signature">First class?<br /><span>Start here.</span></h2>
            <div className="tde-first-class">
              <p>Find a class that fits your age group, your week and your journey.</p>
              <ol>
                <li><strong>Find your fit.</strong><span>Check the age or school-year group, venue and timetable on the class page.</span></li>
                <li><strong>See your options.</strong><span>Each class page shows its current prices and booking options before you book.</span></li>
                <li><strong>Ask us anything.</strong><span>For clothing, footwear, arrival or extra support, speak to the team before your first session.</span></li>
              </ol>
              <div className="tde-first-links"><Link to="/info" className="tde-text-link">First-session guide <ArrowUpRight size={20} aria-hidden /></Link><Link to="/contact" className="tde-text-link">Ask the team <ArrowUpRight size={20} aria-hidden /></Link></div>
            </div>
          </div>
        </div>
      </section>

      <section className="tde-venues-section tde-paper" id="find-a-location">
        <div className="tde-section-note" data-entrance="">
          <span>CLOSE TO HOME</span>
          <span>ALL ACROSS ESSEX</span>
        </div>
        <div className="tde-venues-grid">
          <div data-entrance="">
            <h2>
              Find your
              <br />
              <em>local class.</em>
            </h2>
            <p>
              Choose your town to see our venues, then explore the classes at a location that works for you.
            </p>
            <Link to="/venues" className="tde-button tde-button-dark">
              Find a location <ArrowUpRight size={20} aria-hidden />
            </Link>
            <div className="tde-location-photo">
              <MotionMedia
                image={tdePhoto("showtime").src}
                alt="The Dance Exclusive dancers performing together"
                active={move}
              />
            </div>
          </div>
          <HomeLocations school={school} loading={isLoading} error={isError} />
        </div>
      </section>

      {school && school.coaches.length > 0 && (
        <section className="tde-crew-section">
          <div className="tde-section-note">
            <span>THE PEOPLE BEHIND IT</span>
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
          <CoachPhotoGrid coaches={school.coaches} />
        </section>
      )}

      {school && school.camps.length > 0 && (
        <section className="tde-events-section tde-paper">
          <div className="tde-section-note">
            <span>KEEP THE GOOD TIMES COMING</span>
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
              <Link key={camp.id} to={`/events/${camp.id}`} data-audience={camp.class_type} className="tde-photo-event">
                <ClassMedia item={camp} decorative sizes="(max-width: 640px) 100vw, 240px" />
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
