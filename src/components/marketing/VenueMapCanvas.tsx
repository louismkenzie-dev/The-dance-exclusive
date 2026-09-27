import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { VenuePoint } from "@/lib/venueTour";

export type MapVenue = VenuePoint & { id: string; name: string; number: number };

type VenueMarker = { marker: L.Marker; ids: string[] };
function highlight(markers: VenueMarker[], selectedId: string) {
  for (const { marker, ids } of markers) {
    const selected = ids.includes(selectedId);
    marker.getElement()?.querySelector("button")?.setAttribute("aria-pressed", String(selected));
    marker.setZIndexOffset(selected ? 1000 : 0);
  }
}

export default function VenueMapCanvas({ venues, selectedId, onSelect }: {
  venues: MapVenue[]; selectedId: string; onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markers = useRef<VenueMarker[]>([]);
  const select = useRef(onSelect);
  const selected = useRef(selectedId);
  select.current = onSelect;
  selected.current = selectedId;
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!container.current || !venues.length) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = L.map(container.current, {
      scrollWheelZoom: false, dragging: !window.matchMedia("(pointer: coarse)").matches,
      touchZoom: false, doubleClickZoom: false, zoomSnap: .25,
      zoomAnimation: !reduced, fadeAnimation: !reduced,
    });
    mapRef.current = map;
    map.attributionControl.setPrefix(false);
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      maxZoom: 18, className: "tde-venue-map-tiles",
    }).addTo(map);
    tiles.on("tileerror", () => setTileError(true));
    tiles.on("tileload", () => setTileError(false));
    const bounds = L.latLngBounds(venues.map(v => [v.latitude, v.longitude]));
    const fit = () => { map.invalidateSize(); map.fitBounds(bounds, { padding: [38, 38], maxZoom: 12, animate: false }); };
    fit();

    // Group intersecting 44px hit targets, not only visual dots. Groups expose
    // every venue by name without requiring touch-dragging or precise tapping.
    const draw = () => {
      markers.current.forEach(({ marker }) => marker.remove());
      const groups: MapVenue[][] = [];
      for (const venue of venues) {
        const point = map.latLngToContainerPoint([venue.latitude, venue.longitude]);
        const colliding = groups.filter(group => group.some(other => point.distanceTo(map.latLngToContainerPoint([other.latitude, other.longitude])) < 54));
        const merged = [venue, ...colliding.flat()];
        for (const group of colliding) groups.splice(groups.indexOf(group), 1);
        groups.push(merged);
      }
      markers.current = groups.map(group => {
        const clustered = group.length > 1;
        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = `tde-map-pin${clustered ? " tde-map-cluster" : ""}`;
        pin.textContent = clustered ? `${group.length}` : String(group[0].number);
        if (clustered) { const text = document.createElement("small"); text.textContent = "venues"; pin.append(text); }
        pin.setAttribute("aria-label", clustered ? `Choose from ${group.length} nearby venues: ${group.map(v => v.name).join(", ")}` : `Show ${group[0].name}${group[0].approximate ? " (approximate location)" : ""}`);
        const marker = L.marker([group.reduce((sum, v) => sum + v.latitude, 0) / group.length, group.reduce((sum, v) => sum + v.longitude, 0) / group.length], {
          icon: L.divIcon({ html: pin, className: "tde-map-marker", iconSize: [44, 44], iconAnchor: [22, 22] }), keyboard: false,
        }).addTo(map);
        if (clustered) {
          const list = document.createElement("div");
          list.className = "tde-map-cluster-list";
          const title = document.createElement("strong"); title.textContent = "Choose your venue"; list.append(title);
          for (const venue of [...group].sort((a, b) => a.number - b.number)) {
            const option = document.createElement("button"); option.type = "button";
            option.textContent = `${venue.number}. ${venue.name}`;
            option.addEventListener("click", () => { select.current(venue.id); marker.closePopup(); pin.focus({ preventScroll: true }); });
            list.append(option);
          }
          marker.bindPopup(list, { className: "tde-map-cluster-popup", maxWidth: 240, autoPan: true, autoPanPadding: [16, 16] });
          pin.addEventListener("click", event => {
            event.stopPropagation();
            marker.openPopup();
            list.querySelector("button")?.focus({ preventScroll: true });
          });
          list.addEventListener("keydown", event => { if (event.key === "Escape") { marker.closePopup(); pin.focus({ preventScroll: true }); } });
        } else pin.addEventListener("click", () => select.current(group[0].id));
        return { marker, ids: group.map(v => v.id) };
      });
      highlight(markers.current, selected.current);
    };
    draw();
    map.on("zoomend", draw);
    const observer = new ResizeObserver(() => { fit(); draw(); });
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); markers.current = []; mapRef.current = null; };
  }, [venues]);

  useEffect(() => { highlight(markers.current, selectedId); }, [selectedId, venues]);

  return <div className="tde-venue-map-canvas-wrap">
    <div ref={container} className="tde-venue-map-canvas" role="region" aria-label="Map of Dance Exclusive venues" />
    <button className="tde-map-reset" type="button" onClick={() => {
      if (venues.length) mapRef.current?.fitBounds(L.latLngBounds(venues.map(v => [v.latitude, v.longitude])), { padding: [38, 38], maxZoom: 12, animate: false });
    }}>Show all venues</button>
    {tileError && <p className="tde-map-tile-error" role="status">Map detail couldn’t load. You can still select a venue below.</p>}
  </div>;
}
