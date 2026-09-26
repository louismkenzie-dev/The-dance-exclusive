import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { usePublicSchool } from "@/hooks/usePublicSchool";
import { PageMeta } from "@/components/marketing/PageMeta";
import { PUBLIC_ORIGIN } from "@/components/marketing/PageHeadContext";
import {
  classDaysLabel,
  classPlanRows,
  classPriceSummary,
  classCardState,
  isClassFull,
} from "@/lib/classPresentation";
import { audienceText } from "@/lib/classAudience";
import { availabilityFor, formatTimeRange } from "@/lib/bookingFormat";
import { classLinkPath } from "@/lib/classLinks";
import { coachPath, publicClassPath, venuePath } from "@/lib/publicSchool";

/** Public discovery and the existing booking sheet share the same price rules. */
export default function PublicClassPage() {
  const { classId, type } = useParams();
  const { data: school, isPending, isError, refetch } = usePublicSchool();
  const cls = school?.classes.find(
    (item) => item.id === classId && item.class_type === type,
  );
  if (isPending)
    return (
      <div className="tde-directory tde-paper">
        <p role="status">Finding your class…</p>
      </div>
    );
  if (isError)
    return (
      <div className="tde-directory tde-paper">
        <h1>Let's try again.</h1>
        <p>We couldn't load the latest class details.</p>
        <button
          className="tde-button tde-button-dark"
          onClick={() => void refetch()}
        >
          Try again
        </button>
      </div>
    );
  if (!cls || !school)
    return (
      <div className="tde-directory tde-paper">
        <PageMeta
          title="Class unavailable"
          description="Explore current dance classes with The Dance Exclusive."
          path={`/classes/${type}/${classId}`}
          noindex
        />
        <h1>
          Your next move
          <br />
          is still out there.
        </h1>
        <p>This class is no longer publicly available.</p>
        <Link className="tde-text-link" to="/classes?type=children">
          Explore current classes <ArrowUpRight size={20} aria-hidden />
        </Link>
      </div>
    );
  const venue = school.venues.find((item) => item.id === cls.venue_id);
  const coach = school.coaches.find((item) => item.id === cls.instructor_id);
  const price = classPriceSummary(cls, cls.remainingSessions);
  const plans = classPlanRows(cls, cls.remainingSessions, null);
  const state = classCardState(cls, isClassFull(cls.capacity, cls.enrolled));
  const availability =
    cls.enrolled === null
      ? "Check availability when booking"
      : availabilityFor(cls.capacity, cls.enrolled).label;
  const days = classDaysLabel(cls.days_of_week, cls.day_of_week);
  const audience = audienceText(cls);
  const description = `${cls.name}${venue?.city ? ` in ${venue.city}` : ""}. ${days}, ${formatTimeRange(cls.start_time, cls.end_time)}. ${audience}. ${price.priceLabel} ${price.priceHint}.`;

  return (
    <article className="tde-directory tde-paper" data-audience={cls.class_type}>
      <PageMeta
        title={`${cls.name}${venue?.city ? ` in ${venue.city}` : ""}`}
        description={description}
        path={publicClassPath(cls)}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: cls.name,
          description: cls.description || description,
          url: `${PUBLIC_ORIGIN}${publicClassPath(cls)}`,
          provider: {
            "@type": "Organization",
            name: "The Dance Exclusive",
            url: PUBLIC_ORIGIN,
          },
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: "onsite",
            ...(cls.sessions[0]
              ? { startDate: cls.sessions[0].session_date }
              : {}),
            ...(venue
              ? {
                  location: {
                    "@type": "Place",
                    name: venue.name,
                    address: {
                      "@type": "PostalAddress",
                      streetAddress: venue.address_line1,
                      addressLocality: venue.city,
                      postalCode: venue.postcode,
                      addressCountry: "GB",
                    },
                  },
                }
              : {}),
            ...(coach
              ? {
                  instructor: {
                    "@type": "Person",
                    name: coach.first_name,
                    url: `${PUBLIC_ORIGIN}${coachPath(coach)}`,
                  },
                }
              : {}),
          },
        }}
      />
      <Link to={`/classes?type=${cls.class_type}`} className="tde-breadcrumb">
        <ArrowLeft size={15} aria-hidden /> All{" "}
        {cls.class_type === "adult" ? "adult" : "children's"} classes
      </Link>
      <div className="tde-page-top">
        <span className="tde-eyebrow">
          {cls.dance_style || "THE DANCE EXCLUSIVE"} /{" "}
          {audience || (cls.class_type === "adult" ? "ADULTS" : "CHILDREN")}
        </span>
        <h1>{cls.name}</h1>
        <p>
          {days} · {formatTimeRange(cls.start_time, cls.end_time)}
          {venue ? ` · ${venue.name}` : ""}
        </p>
      </div>
      <div className="tde-class-detail-grid">
        <div className="tde-class-story">
          <h2>
            Make your
            <br />
            <em>next move.</em>
          </h2>
          <p className="tde-prose">
            {cls.description ||
              "Make space in your week to move, learn and connect with The Dance Exclusive."}
          </p>
          <dl className="tde-class-facts">
            <div>
              <dt>When</dt>
              <dd>
                {days}
                <br />
                {formatTimeRange(cls.start_time, cls.end_time)}
              </dd>
            </div>
            <div>
              <dt>For</dt>
              <dd>{audience || "Contact us to find the right class"}</dd>
            </div>
            {venue && (
              <div>
                <dt>Where</dt>
                <dd>
                  <Link to={venuePath(venue)}>{venue.name} ↗</Link>
                  <br />
                  {venue.address_line1}, {venue.city}, {venue.postcode}
                </dd>
              </div>
            )}
            {coach && (
              <div>
                <dt>Your coach</dt>
                <dd>
                  <Link to={coachPath(coach)}>{coach.first_name} ↗</Link>
                </dd>
              </div>
            )}
          </dl>
          {cls.sessions.length > 0 && (
            <section className="tde-session-dates">
              <h3>Your next sessions</h3>
              <ul>
                {cls.sessions.slice(0, 6).map((session) => (
                  <li key={session.id}>
                    <time dateTime={session.session_date}>
                      {format(parseISO(session.session_date), "EEE d MMM yyyy")}
                    </time>
                    <span>
                      {formatTimeRange(session.start_time, session.end_time)}
                    </span>
                  </li>
                ))}
              </ul>
              {cls.sessions.length > 6 && (
                <p>
                  All {cls.sessions.length} upcoming dates are available when
                  you book.
                </p>
              )}
            </section>
          )}
        </div>
        <aside
          className="tde-booking-card"
          aria-label="Class prices and booking"
        >
          <span className="tde-eyebrow">Your place on the floor</span>
          <p className="tde-detail-price">
            {price.priceLabel}
            <span>{price.priceHint}</span>
          </p>
          <p className="tde-availability">
            {state === "invite"
              ? "By invitation"
              : state === "soon"
                ? "Booking opens soon"
                : availability}
          </p>
          {plans.length > 0 && (
            <ul className="tde-plan-list">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <div>
                    <strong>{plan.title}</strong>
                    <span>{plan.meta}</span>
                  </div>
                  <p>
                    {plan.price}
                    <small>{plan.priceSuffix}</small>
                  </p>
                </li>
              ))}
            </ul>
          )}
          {state === "invite" ? (
            <>
              <p>
                This crew is by invitation. Get in touch with the team to find
                out more.
              </p>
              <Link to="/contact" className="tde-button">
                Talk to the team <ArrowUpRight size={20} aria-hidden />
              </Link>
            </>
          ) : state === "soon" ? (
            <>
              <p>Class details are published, but booking isn't open yet.</p>
              <Link to="/contact" className="tde-button">
                Get in touch <ArrowUpRight size={20} aria-hidden />
              </Link>
            </>
          ) : (
            <Link to={classLinkPath(cls.id)} className="tde-button">
              {state === "full"
                ? "View class & waiting list"
                : "Choose your place"}{" "}
              <ArrowUpRight size={20} aria-hidden />
            </Link>
          )}
          <p className="tde-booking-note">
            {cls.allow_trial && cls.class_type === "children"
              ? "Trials are available to eligible new families. "
              : ""}
            Choose your dates and see any eligible discounts when you book.
          </p>
        </aside>
      </div>
    </article>
  );
}
