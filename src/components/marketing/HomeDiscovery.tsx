import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { PostcodeSearchForm } from "@/components/booking/PostcodeSearchForm";
import { searchPostcode } from "@/lib/postcodeSearch";
import { haversineDistance, distanceLabel } from "@/lib/classPresentation";
import { formatPostcode } from "@/lib/customerAddress";
import { lookupVenuePostcodes, normalisePostcode, savedVenuePoint } from "@/lib/venueTour";
import { PublicTimetable } from "./PublicTimetable";
import { venuePath, type PublicSchool } from "@/lib/publicSchool";

type DiscoveryProps = { school?: PublicSchool; loading: boolean; error: boolean };

export function HomeClassFinder({ school, loading, error }: DiscoveryProps) {
  const [audience, setAudience] = useState<"children" | "adult">("children");
  const classes = school?.classes.filter(item => item.class_type === audience) ?? [];
  const label = audience === "children" ? "children’s" : "adult";
  return (
    <div className="tde-home-finder" data-audience={audience}>
      <div className="tde-finder-heading">
        <h3>On the timetable</h3>
        <div className="tde-audience-switch" role="group" aria-label="Choose class audience">
          <button type="button" aria-pressed={audience === "children"} onClick={() => setAudience("children")}>Children</button>
          <button type="button" data-audience="adult" aria-pressed={audience === "adult"} onClick={() => setAudience("adult")}>Adults</button>
        </div>
      </div>
      {loading ? <p role="status" className="tde-loading">Loading the timetable…</p>
        : error ? <p className="tde-loading">We couldn’t load the timetable. <Link to={`/classes?type=${audience}`}>Open {label} classes</Link> or <Link to="/contact">ask the team</Link>.</p>
          : classes.length ? <PublicTimetable key={audience} classes={classes} venues={school?.venues ?? []} />
            : <p role="status" className="tde-empty">No {label} classes are currently listed. <Link to="/contact">Ask the team about your options</Link>.</p>}
      <div className="tde-finder-footer">
        <span role="status" aria-live="polite">{!loading && !error && classes.length > 0 ? `${classes.length} ${label} classes to explore` : ""}</span>
        <Link to={`/classes?type=${audience}`} className="tde-text-link">Explore all {label} classes <ArrowUpRight size={18} aria-hidden /></Link>
      </div>
    </div>
  );
}

export function HomeLocations({ school, loading, error }: DiscoveryProps) {
  const [postcode, setPostcode] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [result, setResult] = useState<{ postcode: string; venues: { id: string; miles: number }[] } | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!postcode.trim() || loading || error || searchLoading) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSearchLoading(true);
    setSearchError("");
    setResult(null);
    try {
      const coords = await searchPostcode(postcode, controller.signal);
      const venues = (school?.venues ?? []).filter(venue => school?.classes.some(item => item.venue_id === venue.id));
      const missing = [...new Set(venues.filter(v => !savedVenuePoint(v)).map(v => normalisePostcode(v.postcode)).filter(Boolean))];
      const fallback = await lookupVenuePostcodes(missing, controller.signal);
      if (controller.signal.aborted) return;
      const nearest = venues.flatMap(venue => {
        const point = savedVenuePoint(venue) ?? fallback[normalisePostcode(venue.postcode)];
        return point ? [{ id: venue.id, miles: haversineDistance(coords.lat, coords.lon, point.latitude, point.longitude) }] : [];
      }).sort((a, b) => a.miles - b.miles);
      setResult({ postcode: formatPostcode(postcode), venues: nearest });
    } catch (error) {
      if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "Could not search postcode. Please try again.");
    } finally {
      if (!controller.signal.aborted) setSearchLoading(false);
    }
  };
  return (
    <div className="tde-town-finder tde-postcode-finder">
      <h3>Where would you like to dance?</h3>
      <PostcodeSearchForm postcode={postcode} onChange={value => { setPostcode(value); setResult(null); setSearchError(""); }}
        onSubmit={submit} loading={searchLoading} disabled={loading || error || !school?.venues.length} error={searchError} />
      {loading ? <p role="status">Loading locations…</p> : error ? <p>Locations couldn’t load. <Link to="/venues">Open the location directory</Link> or <Link to="/contact">ask the team</Link>.</p>
        : !result && !searchLoading ? <p>Enter your postcode to find your closest clubs.</p> : searchLoading ? <p role="status">Finding your closest clubs…</p> : null}
      <div className="tde-town-results" aria-live="polite" aria-atomic="true">
        {result && <p>{result.venues.length ? `Closest clubs to ${result.postcode} · approximate distance` : "We couldn’t locate venues nearby. Explore all locations below."}</p>}
        {result?.venues.slice(0, 3).map(({ id, miles }) => {
          const venue = school?.venues.find(venue => venue.id === id);
          if (!venue) return null;
          const count = school?.classes.filter(item => item.venue_id === venue.id).length ?? 0;
          return <Link to={venuePath(venue)} key={venue.id} className="tde-town-venue">
            <div><h3>{venue.name}</h3><p>{distanceLabel(miles)} away · {venue.city}</p><span>{count ? `${count} ${count === 1 ? "class" : "classes"} to explore` : "View venue details"}</span></div>
            <ArrowUpRight size={22} aria-hidden />
          </Link>;
        })}
      </div>
      {result && <button className="tde-postcode-clear" type="button" onClick={() => { setPostcode(""); setResult(null); }}>Clear postcode</button>}
      {!result && <div className="tde-postcode-art" aria-hidden="true">
        <img src="/media/tde/local-dance-finder.webp"
          srcSet="/media/tde/local-dance-finder-480.webp 480w, /media/tde/local-dance-finder.webp 960w"
          sizes="(max-width: 700px) 90vw, 44vw" width={960} height={640}
          alt="" loading="lazy" decoding="async" />
      </div>}
      <Link to="/venues" className="tde-text-link">All {school?.venues.length || "our"} locations <ArrowUpRight size={18} aria-hidden /></Link>
    </div>
  );
}
