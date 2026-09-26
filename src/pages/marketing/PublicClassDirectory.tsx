import { tdePhoto } from "@/lib/tdeMedia";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicSchool } from "@/hooks/usePublicSchool";
import { DiscoveryHero } from "@/components/marketing/DiscoveryHero";
import { PageMeta } from "@/components/marketing/PageMeta";
import { PublicClassList } from "@/components/marketing/PublicClassList";

const days = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export default function PublicClassDirectory() {
  const [params, setParams] = useSearchParams();
  const { data: school, isPending, isError, refetch } = usePublicSchool();
  const search = params.get("q") || "";
  const type = params.get("type") || "";
  const venue = params.get("venue") || "";
  const day = params.get("day") || "";
  const setFilter = (key: string, value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };
  const classes = (school?.classes ?? []).filter((item) => {
    const location = school?.venues.find((v) => v.id === item.venue_id);
    return (
      (!type || item.class_type === type) &&
      (!venue || item.venue_id === venue) &&
      (!day ||
        (item.days_of_week?.length
          ? item.days_of_week
          : [item.day_of_week]
        ).includes(day)) &&
      (!search ||
        `${item.name} ${item.dance_style || ""} ${location?.name || ""} ${location?.city || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()))
    );
  });
  return (
    <div className="tde-directory tde-paper" data-audience={type === "adult" ? "adult" : "children"}>
      <PageMeta
        title="Dance classes for children & adults in Essex"
        description="Find your Dance Exclusive class by location, day and style. Explore current times, age groups, prices and availability across Essex."
        path="/classes"
        noindex={params.size > 0}
      />
      <DiscoveryHero
        eyebrow={type === "adult" ? "YOUR TIME. YOUR ENERGY." : "STREET DANCE. NEW FRIENDS. BIG ENERGY."}
        title={<>Find your<br /><em>{type === "adult" ? "release." : "crew."}</em></>}
        description={type === "adult" ? "Turn up the music. Switch off the day. Find your next street or commercial class and make some time for you." : "From first steps to centre stage. Find your class, meet your people and get moving."}
        image={tdePhoto(type === "adult" ? "studio-energy" : "showtime").src}
        alt={tdePhoto(type === "adult" ? "studio-energy" : "showtime").alt}
      >
        <div className="tde-style-links" aria-label="Explore dance styles">
          {["Street", "Commercial", "Hip Hop"].map((style) => (
            <button key={style} onClick={() => setFilter("q", style)} aria-pressed={search === style}>{style} ↗</button>
          ))}
        </div>
      </DiscoveryHero>
      <form
        className="tde-class-filters"
        aria-label="Filter dance classes"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="tde-search-label">
          <span>Search classes or places</span>
          <div>
            <Search size={19} aria-hidden />
            <input
              type="search"
              value={search}
              placeholder="Street dance, Chelmsford…"
              onChange={(event) => setFilter("q", event.target.value)}
            />
          </div>
        </label>
        <label>
          <span>Who’s dancing?</span>
          <select
            value={type}
            onChange={(event) => setFilter("type", event.target.value)}
          >
            <option value="">Everyone</option>
            <option value="children">Children</option>
            <option value="adult">Adults</option>
          </select>
        </label>
        <label>
          <span>Location</span>
          <select
            value={venue}
            onChange={(event) => setFilter("venue", event.target.value)}
          >
            <option value="">All locations</option>
            {school?.venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Day</span>
          <select
            value={day}
            onChange={(event) => setFilter("day", event.target.value)}
          >
            <option value="">Any day</option>
            {days.map((d) => (
              <option value={d} key={d}>
                {d[0].toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </form>
      {isPending ? (
        <p role="status" className="tde-loading">
          Loading the latest timetable…
        </p>
      ) : isError ? (
        <div className="tde-empty">
          <p>The timetable couldn't load.</p>
          <button
            className="tde-button tde-button-dark"
            onClick={() => void refetch()}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="tde-filter-results">
            <p role="status" aria-live="polite">
              {classes.length} {classes.length === 1 ? "class" : "classes"} to
              discover
            </p>
            {params.size > 0 && (
              <button onClick={() => setParams({})}>Clear filters</button>
            )}
          </div>
          {classes.length ? (
            <PublicClassList classes={classes} venues={school?.venues ?? []} />
          ) : (
            <div className="tde-empty">
              <p>
                No classes match these filters. Try another day or location.
              </p>
              <button className="tde-text-link" onClick={() => setParams({})}>
                See all classes <ArrowUpRight size={18} aria-hidden />
              </button>
            </div>
          )}
        </>
      )}
      <div className="tde-directory-help">
        <p>Looking for something a little different?</p>
        <Link to="/events" className="tde-text-link">
          Camps & workshops <ArrowUpRight size={19} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
