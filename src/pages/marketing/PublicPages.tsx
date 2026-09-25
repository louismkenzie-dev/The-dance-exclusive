import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, MapPin } from "lucide-react";
import { usePublicSchool } from "@/hooks/usePublicSchool";
import { PageMeta } from "@/components/marketing/PageMeta";
import { PUBLIC_ORIGIN } from "@/components/marketing/PageHeadContext";
import { PublicClassList } from "@/components/marketing/PublicClassList";
import { MotionMedia } from "@/components/marketing/MotionMedia";
import { coachPath, venuePath } from "@/lib/publicSchool";
import { campPriceLabel, shortDateRange } from "@/lib/classPresentation";
import { campBrowserPath } from "@/lib/classLinks";
import { supabase } from "@/integrations/supabase/client";

const staffPhoto = (path: string | null) =>
  path?.startsWith("http")
    ? path
    : path
      ? supabase.storage.from("staff-photos").getPublicUrl(path).data.publicUrl
      : null;

export default function PublicPages() {
  const { pathname } = useLocation();
  const { venueSlug, coachId, eventId } = useParams();
  const { data: school, isPending, isError, refetch } = usePublicSchool();
  const isVenue = pathname.startsWith("/venues");
  const isCoach = pathname.startsWith("/team");
  const label = isVenue
    ? "Locations"
    : isCoach
      ? "The team"
      : "Camps & workshops";
  if (isPending)
    return (
      <div className="tde-directory tde-paper">
        <div className="tde-page-top">
          <span className="tde-eyebrow">{label}</span>
          <h1>
            Find your
            <br />
            next move.
          </h1>
          <p role="status">Loading {label.toLowerCase()}…</p>
        </div>
      </div>
    );
  if (isError || !school)
    return (
      <div className="tde-directory tde-paper">
        <h1>
          Let's try
          <br />
          that again.
        </h1>
        <p>We couldn't load the latest {label.toLowerCase()}.</p>
        <button
          className="tde-button tde-button-dark"
          onClick={() => void refetch()}
        >
          Try again
        </button>
        <Link className="tde-text-link" to="/contact">
          Get in touch <ArrowUpRight size={18} aria-hidden />
        </Link>
      </div>
    );

  if (venueSlug) {
    const venue = school.venues.find(
      (item) => item.slug === venueSlug || item.id === venueSlug,
    );
    if (!venue) return <Missing back="/venues" label="location" />;
    const classes = school.classes.filter((item) => item.venue_id === venue.id);
    const image = venue.hero_image || venue.photo_outside;
    return (
      <article className="tde-directory tde-paper">
        <PageMeta
          title={`Dance classes at ${venue.name}`}
          description={
            venue.short_description ||
            `Explore current dance classes at ${venue.name}, ${venue.city}. See times, ages, prices and book with The Dance Exclusive.`
          }
          path={venuePath(venue)}
          structuredData={{
            "@context": "https://schema.org",
            "@type": "Place",
            name: venue.name,
            url: `${PUBLIC_ORIGIN}${venuePath(venue)}`,
            address: {
              "@type": "PostalAddress",
              streetAddress: venue.address_line1,
              addressLocality: venue.city,
              postalCode: venue.postcode,
              addressCountry: "GB",
            },
          }}
        />
        <Link className="tde-breadcrumb" to="/venues">
          <ArrowLeft size={15} aria-hidden /> All locations
        </Link>
        <div className="tde-page-top">
          <span className="tde-eyebrow">DANCE IN {venue.city || "ESSEX"}</span>
          <h1>{venue.name}</h1>
          <p>{venue.short_description}</p>
        </div>
        <div className="tde-profile-grid">
          <div>
            {image ? (
              <MotionMedia
                image={image}
                alt={venue.name}
                className="tde-profile-media"
              />
            ) : (
              <div className="tde-no-image">
                <MapPin size={60} strokeWidth={1} aria-hidden />
                <span>{venue.city}</span>
              </div>
            )}
          </div>
          <div className="tde-profile-information">
            <h2>
              Your local
              <br />
              dance floor.
            </h2>
            <p className="tde-prose">{venue.description}</p>
            <dl>
              <div>
                <dt>Find us</dt>
                <dd>
                  {venue.address_line1}
                  <br />
                  {venue.city}, {venue.postcode}
                </dd>
              </div>
              {venue.has_parking && (
                <div>
                  <dt>Parking</dt>
                  <dd>Parking available</dd>
                </div>
              )}
              {venue.accessibility_info && (
                <div>
                  <dt>Accessibility</dt>
                  <dd>{venue.accessibility_info}</dd>
                </div>
              )}
            </dl>
            <a
              className="tde-text-link"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name} ${venue.address_line1} ${venue.postcode}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Get directions <ArrowUpRight size={19} aria-hidden />
            </a>
          </div>
        </div>
        <section className="tde-related">
          <div className="tde-section-heading">
            <h2>
              On the
              <br />
              <em>timetable.</em>
            </h2>
            <p>
              Times, prices and your next class.
              <br />
              Choose a class to see its availability.
            </p>
          </div>
          <PublicClassList classes={classes} venues={school.venues} />
        </section>
      </article>
    );
  }

  if (coachId) {
    const coach = school.coaches.find((item) => item.id === coachId);
    if (!coach) return <Missing back="/team" label="coach" />;
    const image = staffPhoto(coach.profile_photo);
    return (
      <article className="tde-directory tde-paper">
        <PageMeta
          title={`Meet ${coach.first_name}`}
          description={
            coach.description?.slice(0, 155) ||
            `Meet ${coach.first_name} and explore their current classes at The Dance Exclusive in Essex.`
          }
          path={coachPath(coach)}
          structuredData={{
            "@context": "https://schema.org",
            "@type": "Person",
            name: coach.first_name,
            description: coach.description,
            image,
            url: `${PUBLIC_ORIGIN}${coachPath(coach)}`,
          }}
        />
        <Link className="tde-breadcrumb" to="/team">
          <ArrowLeft size={15} aria-hidden /> The whole team
        </Link>
        <div className="tde-profile-grid tde-coach-profile">
          {image ? (
            <MotionMedia
              image={image}
              alt={`${coach.first_name}, The Dance Exclusive coach`}
              className="tde-profile-media"
            />
          ) : (
            <div className="tde-no-image">
              <span>{coach.first_name}</span>
            </div>
          )}
          <div className="tde-page-top">
            <span className="tde-eyebrow">THE PERSON BEHIND THE MOVES</span>
            <h1>{coach.first_name}</h1>
            <span className="tde-eyebrow">
              {coach.role === "staff" ? "Dance coach" : coach.role}
            </span>
            <p className="tde-prose">{coach.description}</p>
            {!!coach.dance_skills?.length && (
              <div className="tde-skills">
                {coach.dance_skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <section className="tde-related">
          <div className="tde-section-heading">
            <h2>
              Move with
              <br />
              <em>{coach.first_name}.</em>
            </h2>
          </div>
          <PublicClassList
            classes={school.classes.filter(
              (item) => item.instructor_id === coach.id,
            )}
            venues={school.venues}
          />
        </section>
      </article>
    );
  }

  if (eventId) {
    const camp = school.camps.find((item) => item.id === eventId);
    if (!camp) return <Missing back="/events" label="event" />;
    const venue = school.venues.find((item) => item.id === camp.venue_id);
    const price = campPriceLabel(camp);
    return (
      <article className="tde-directory tde-paper">
        <PageMeta
          title={camp.name}
          description={
            camp.description?.slice(0, 155) ||
            `${camp.name} with The Dance Exclusive. ${shortDateRange(camp.start_date, camp.end_date)}. See details and book your place.`
          }
          path={`/events/${camp.id}`}
          structuredData={{
            "@context": "https://schema.org",
            "@type": "Event",
            name: camp.name,
            startDate: camp.start_date,
            endDate: camp.end_date,
            description: camp.description,
            url: `${PUBLIC_ORIGIN}/events/${camp.id}`,
            ...(venue
              ? {
                  location: {
                    "@type": "Place",
                    name: venue.name,
                    address: `${venue.address_line1}, ${venue.city}, ${venue.postcode}`,
                  },
                }
              : {}),
          }}
        />
        <Link className="tde-breadcrumb" to="/events">
          <ArrowLeft size={15} aria-hidden /> What's coming up
        </Link>
        <div className="tde-page-top">
          <span className="tde-eyebrow">
            {shortDateRange(camp.start_date, camp.end_date)} /{" "}
            {camp.class_type === "adult" ? "ADULTS" : "CHILDREN"}
          </span>
          <h1>{camp.name}</h1>
        </div>
        <div className="tde-event-detail">
          <p className="tde-prose">
            {camp.description ||
              "Join The Dance Exclusive for more time to move, learn and connect."}
          </p>
          <div>
            {venue && (
              <Link to={venuePath(venue)} className="tde-text-link">
                {venue.name} <ArrowUpRight size={18} aria-hidden />
              </Link>
            )}
            {price && (
              <p className="tde-event-price">
                {price.amount} <span>{price.hint}</span>
              </p>
            )}
            <Link
              to={campBrowserPath(camp.id, camp.class_type)}
              className="tde-button tde-button-dark"
            >
              Check availability & book <ArrowUpRight size={21} aria-hidden />
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="tde-directory tde-paper">
      <PageMeta
        title={
          isVenue
            ? "Dance classes across Essex"
            : isCoach
              ? "Meet our dance coaches"
              : "Dance camps & workshops in Essex"
        }
        description={
          isVenue
            ? "Find your local Dance Exclusive venue. Explore dance classes, timetables and directions across Essex."
            : isCoach
              ? "Meet the people behind The Dance Exclusive and find the classes they teach."
              : "Discover upcoming dance camps and workshops. Live dates, venues and booking with The Dance Exclusive."
        }
        path={pathname}
      />
      <div className="tde-page-top">
        <span className="tde-eyebrow">THE DANCE EXCLUSIVE / {label}</span>
        <h1>
          {isVenue ? (
            <>
              Big energy.
              <br />
              <em>Local roots.</em>
            </>
          ) : isCoach ? (
            <>
              Your people.
              <br />
              <em>Your hype team.</em>
            </>
          ) : (
            <>
              More reasons
              <br />
              <em>to move.</em>
            </>
          )}
        </h1>
        <p>
          {isVenue
            ? "Find your local floor. Explore the locations we call home and the classes happening near you."
            : isCoach
              ? "Meet the people who bring the energy, share their craft and help you find your confidence."
              : "Make room for something different. Here's what's coming up at The Dance Exclusive."}
        </p>
      </div>
      {isVenue ? (
        <div className="tde-directory-venues">
          {school.venues.map((venue, i) => (
            <Link to={venuePath(venue)} key={venue.id}>
              <span className="tde-directory-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <span className="tde-eyebrow">{venue.city}</span>
                <h2>{venue.name}</h2>
                <p>
                  {venue.address_line1} · {venue.postcode}
                </p>
              </div>
              <span className="tde-directory-count">
                {
                  school.classes.filter((item) => item.venue_id === venue.id)
                    .length
                }{" "}
                classes
              </span>
              <ArrowUpRight size={30} aria-hidden />
            </Link>
          ))}
        </div>
      ) : isCoach ? (
        school.coaches.length ? (
          <div className="tde-crew-grid">
            {school.coaches.map((coach) => (
              <Link
                to={coachPath(coach)}
                className="tde-coach-card"
                key={coach.id}
              >
                <div className="tde-coach-photo">
                  {staffPhoto(coach.profile_photo) ? (
                    <MotionMedia
                      image={staffPhoto(coach.profile_photo)!}
                      alt={`${coach.first_name}, The Dance Exclusive coach`}
                    />
                  ) : (
                    <div className="tde-no-image">
                      <span>{coach.first_name?.[0]}</span>
                    </div>
                  )}
                </div>
                <div>
                  <h3>{coach.first_name}</h3>
                  <ArrowUpRight size={22} aria-hidden />
                </div>
                <p>{coach.dance_skills?.join(" / ")}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="tde-empty">
            Coach profiles are currently unavailable.{" "}
            <Link to="/contact">Get in touch to meet the team</Link>, or explore
            the people teaching your class in the booking details.
          </p>
        )
      ) : school.camps.length ? (
        <div className="tde-event-list">
          {school.camps.map((camp) => (
            <Link to={`/events/${camp.id}`} key={camp.id}>
              <span>{shortDateRange(camp.start_date, camp.end_date)}</span>
              <h3>{camp.name}</h3>
              <span>{camp.class_type === "adult" ? "Adults" : "Children"}</span>
              <ArrowUpRight size={28} aria-hidden />
            </Link>
          ))}
        </div>
      ) : (
        <p className="tde-empty">
          New events will appear here when they're available.{" "}
          <Link to="/classes?type=children">Explore weekly classes</Link> in the
          meantime.
        </p>
      )}
    </div>
  );
}

function Missing({ back, label }: { back: string; label: string }) {
  return (
    <div className="tde-directory tde-paper">
      <PageMeta
        title={`${label} unavailable`}
        description={`This ${label} is not currently available. Explore current Dance Exclusive classes and events.`}
        path={back}
      />
      <div className="tde-page-top">
        <span className="tde-eyebrow">THE DANCE EXCLUSIVE</span>
        <h1>
          Let's find your
          <br />
          next move.
        </h1>
        <p>This {label} is no longer publicly available.</p>
        <Link className="tde-button tde-button-dark" to={back}>
          Explore current{" "}
          {label === "location"
            ? "locations"
            : label === "coach"
              ? "coaches"
              : "events"}{" "}
          <ArrowUpRight size={20} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
