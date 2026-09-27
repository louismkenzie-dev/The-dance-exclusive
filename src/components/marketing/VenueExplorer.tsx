import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin, Pause, Play } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { venuePath, type PublicVenue } from "@/lib/publicSchool";
import { lookupVenuePostcodes, normalisePostcode, savedVenuePoint, venueSlides } from "@/lib/venueTour";
import { bookingCoverImage } from "@/lib/bookingCoverImage";

const VenueMapCanvas = lazy(() => import("./VenueMapCanvas"));
const storageUrl = import.meta.env.VITE_SUPABASE_URL || "https://suwaetnsszlpaaykhpif.supabase.co";

function VenueTourPhoto({ src, caption }: { src: string; caption: string }) {
  const [failed, setFailed] = useState(false);
  const [original, setOriginal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const optimised = original ? null : bookingCoverImage(src, "(max-width: 760px) 100vw, 40vw");
  return failed ? <div className="tde-map-no-photo"><MapPin size={40} /><span>Photo unavailable</span></div> :
    <>{!loaded && <div className="tde-map-photo-loading" role="status">Loading venue photo…</div>}
      <img src={optimised?.src || src} srcSet={optimised?.srcSet} sizes={optimised?.sizes}
        alt={caption} loading="eager" decoding="async" style={{ opacity: loaded ? 1 : 0 }} onLoad={() => setLoaded(true)}
        onError={() => optimised ? setOriginal(true) : setFailed(true)} /></>;
}

export function VenueExplorer({ venues }: { venues: PublicVenue[] }) {
  const root = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selection, setSelection] = useState({ id: venues[0]?.id ?? "", photo: 0 });
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const tours = useMemo(() => venues.map(venue => ({ venue, slides: venueSlides(venue, storageUrl) })), [venues]);
  const index = Math.max(0, tours.findIndex(tour => tour.venue.id === selection.id));
  const current = tours[index];
  const slide = current?.slides[selection.photo] ?? current?.slides[0];
  const playing = !paused && !reduced && !hovered && !focused && inView && !hidden;
  const missing = useMemo(() => [...new Set(venues.filter(v => !savedVenuePoint(v)).map(v => normalisePostcode(v.postcode)).filter(Boolean))].sort(), [venues]);
  const postcodes = useQuery({
    queryKey: ["public-venue-postcodes", missing],
    queryFn: ({ signal }) => lookupVenuePostcodes(missing, signal),
    enabled: ready && missing.length > 0, staleTime: 86_400_000, retry: false,
  });
  const points = useMemo(() => venues.flatMap((venue, i) => {
    const point = savedVenuePoint(venue) ?? postcodes.data?.[normalisePostcode(venue.postcode)];
    return point ? [{ ...point, id: venue.id, name: venue.name, number: i + 1 }] : [];
  }), [venues, postcodes.data]);
  const selectedPoint = points.find(p => p.id === current?.venue.id);
  const choose = useCallback((id: string) => { setSelection({ id, photo: 0 }); setPaused(true); }, []);

  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting) setReady(true);
    }, { threshold: .1 });
    observer.observe(root.current);
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);

  useEffect(() => {
    if (!playing || !current || tours.length === 0) return;
    const timer = window.setTimeout(() => {
      setSelection(selection.photo + 1 < current.slides.length
        ? { id: current.venue.id, photo: selection.photo + 1 }
        : { id: tours[(index + 1) % tours.length].venue.id, photo: 0 });
    }, 5500);
    return () => window.clearTimeout(timer);
  }, [playing, selection, current, tours, index]);

  useEffect(() => {
    if (!ready || !current || !playing) return;
    const next = current.slides[selection.photo + 1] ?? tours[(index + 1) % tours.length]?.slides[0];
    if (!next) return;
    const responsive = bookingCoverImage(next.src, "(max-width: 760px) 100vw, 40vw");
    const image = new Image();
    if (responsive) { image.sizes = responsive.sizes; image.srcset = responsive.srcSet; }
    image.src = responsive?.src ?? next.src;
  }, [ready, current, tours, index, selection.photo, playing]);

  if (!current) return null;
  return <section ref={root} className="tde-venue-explorer" aria-labelledby="venue-explorer-title"
    onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <header className="tde-venue-explorer-heading">
      <div><h2 id="venue-explorer-title">Find your floor.</h2><p>Pick a pin. Take a look inside.</p></div>
      <button type="button" onClick={() => { setPaused(value => !value); setFocused(false); }} disabled={reduced} aria-pressed={paused || reduced}>
        {paused || reduced ? <Play size={16} /> : <Pause size={16} />}{reduced ? "Reduced motion" : paused ? "Play venue tour" : "Pause venue tour"}
      </button>
    </header>
    <div className="tde-venue-explorer-body">
      <div className="tde-venue-map-area">
        <Suspense fallback={<div className="tde-map-loading" role="status">Loading the venue map…</div>}>
          {ready && points.length ? <VenueMapCanvas venues={points} selectedId={current.venue.id} onSelect={choose} /> :
            <div className="tde-map-loading" role="status">{ready && !postcodes.isFetching ? "Use the venue list below to explore locations." : "Loading the venue map…"}</div>}
        </Suspense>
        <div className="tde-map-selector"><label htmlFor="map-venue-select">Explore all {venues.length} venues</label>
          <select id="map-venue-select" value={current.venue.id} onChange={event => choose(event.target.value)}>
            {venues.map((venue, i) => <option key={venue.id} value={venue.id}>{i + 1}. {venue.name}</option>)}
          </select>
        </div>
      </div>
      <article className="tde-map-preview" aria-label="Selected venue">
        <div className="tde-map-photo">
          {slide ? <VenueTourPhoto key={slide.src} {...slide} /> : <div className="tde-map-no-photo"><MapPin size={44} /><span>Venue photos coming soon</span></div>}
          {current.slides.length > 1 && <div className="tde-map-photo-controls">
            <button type="button" aria-label="Previous venue photo" onClick={() => { setPaused(true); setSelection({ id: current.venue.id, photo: (selection.photo - 1 + current.slides.length) % current.slides.length }); }}><ArrowLeft size={17} /></button>
            <span>{Math.min(selection.photo + 1, current.slides.length)} / {current.slides.length}</span>
            <button type="button" aria-label="Next venue photo" onClick={() => { setPaused(true); setSelection({ id: current.venue.id, photo: (selection.photo + 1) % current.slides.length }); }}><ArrowRight size={17} /></button>
          </div>}
        </div>
        <div className="tde-map-preview-copy" aria-live={paused ? "polite" : "off"}>
          <span className="tde-map-city"><MapPin size={16} />{current.venue.city}</span>
          <h3>{current.venue.name}</h3>
          <p>{current.venue.address_line1}<br />{current.venue.postcode}</p>
          {selectedPoint?.approximate && <p className="tde-map-location-note">Approximate pin based on postcode.</p>}
          {!selectedPoint && <p className="tde-map-location-note">Map location not yet available.</p>}
          <Link to={venuePath(current.venue)}>Explore venue & classes <ArrowUpRight size={22} /></Link>
        </div>
      </article>
    </div>
  </section>;
}
