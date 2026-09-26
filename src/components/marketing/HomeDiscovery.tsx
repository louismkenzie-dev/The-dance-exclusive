import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { PublicClassList } from "./PublicClassList";
import { venuePath, type PublicSchool } from "@/lib/publicSchool";

type DiscoveryProps = { school?: PublicSchool; loading: boolean; error: boolean };

export function HomeClassFinder({ school, loading, error }: DiscoveryProps) {
  const [audience, setAudience] = useState<"children" | "adult">("children");
  const classes = school?.classes.filter(item => item.class_type === audience) ?? [];
  const label = audience === "children" ? "children’s" : "adult";
  return (
    <div className="tde-home-finder">
      <div className="tde-finder-heading">
        <h3>On the timetable</h3>
        <div className="tde-audience-switch" role="group" aria-label="Choose class audience">
          <button type="button" aria-pressed={audience === "children"} onClick={() => setAudience("children")}>Children</button>
          <button type="button" data-audience="adult" aria-pressed={audience === "adult"} onClick={() => setAudience("adult")}>Adults</button>
        </div>
      </div>
      {loading ? <p role="status" className="tde-loading">Loading the timetable…</p>
        : error ? <p className="tde-loading">We couldn’t load the timetable. <Link to={`/classes?type=${audience}`}>Open {label} classes</Link> or <Link to="/contact">ask the team</Link>.</p>
          : classes.length ? <PublicClassList classes={classes.slice(0, 4)} venues={school?.venues ?? []} />
            : <p role="status" className="tde-empty">No {label} classes are currently listed. <Link to="/contact">Ask the team about your options</Link>.</p>}
      <div className="tde-finder-footer">
        <span role="status" aria-live="polite">{!loading && !error && classes.length > 0 ? `Showing ${Math.min(4, classes.length)} of ${classes.length} ${label} classes` : ""}</span>
        <Link to={`/classes?type=${audience}`} className="tde-text-link">Explore all {label} classes <ArrowUpRight size={18} aria-hidden /></Link>
      </div>
    </div>
  );
}

export function HomeLocations({ school, loading, error }: DiscoveryProps) {
  const [town, setTown] = useState("");
  const groups = new Map<string, NonNullable<DiscoveryProps["school"]>["venues"]>();
  for (const venue of school?.venues ?? []) {
    const city = venue.city?.trim() || "Other locations";
    const key = city.toLocaleLowerCase("en-GB");
    groups.set(key, [...(groups.get(key) ?? []), venue]);
  }
  const towns = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "en-GB"));
  const venues = groups.get(town) ?? [];
  return (
    <div className="tde-town-finder">
      <label htmlFor="home-town">Where would you like to dance?</label>
      <select id="home-town" value={town} onChange={event => setTown(event.target.value)} disabled={loading || error || !towns.length}>
        <option value="">Choose your town</option>
        {towns.map(([key, items]) => <option value={key} key={key}>{items[0].city?.trim() || "Other locations"} ({items.length})</option>)}
      </select>
      {loading ? <p role="status">Loading locations…</p> : error ? <p>Locations couldn’t load. <Link to="/venues">Open the location directory</Link> or <Link to="/contact">ask the team</Link>.</p> : !town ? <p>See venue details and current classes in your chosen town.</p> : null}
      <div className="tde-town-results" aria-live="polite" aria-atomic="true">
        {town && <p>{venues.length} {venues.length === 1 ? "venue" : "venues"} in {venues[0]?.city?.trim() || "other locations"}</p>}
        {venues.map(venue => {
          const count = school?.classes.filter(item => item.venue_id === venue.id).length ?? 0;
          return <Link to={venuePath(venue)} key={venue.id} className="tde-town-venue">
            <div><h3>{venue.name}</h3><p>{venue.address_line1}{venue.postcode ? ` · ${venue.postcode}` : ""}</p><span>{count ? `${count} ${count === 1 ? "class" : "classes"} to explore` : "View venue details"}</span></div>
            <ArrowUpRight size={22} aria-hidden />
          </Link>;
        })}
      </div>
      <Link to="/venues" className="tde-text-link">All {school?.venues.length || "our"} locations <ArrowUpRight size={18} aria-hidden /></Link>
    </div>
  );
}
