import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

interface VenueMarker {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}

interface VenueMapProps {
  venues: VenueMarker[];
  onVenueClick?: (id: string) => void;
}

const VenueMap = ({ venues, onVenueClick }: VenueMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number; address: string } | null>(null);

  const mappableVenues = venues.filter((v) => v.latitude && v.longitude);

  // Fetch business home address and geocode it
  useEffect(() => {
    const fetchHome = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "trading_address")
        .single();

      let address = data?.value;

      // Fall back to registered address
      if (!address) {
        const { data: regData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "registered_address")
          .single();
        address = regData?.value;
      }

      if (!address || !address.trim()) return;

      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}&country=GB&limit=1`
        );
        const json = await res.json();
        if (json.features && json.features.length > 0) {
          const [lng, lat] = json.features[0].center;
          setHomeCoords({ lat, lng, address });
        }
      } catch {
        // Geocoding failed, skip home marker
      }
    };
    fetchHome();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || (mappableVenues.length === 0 && !homeCoords)) return;

    // Calculate center including home
    const allPoints = mappableVenues.map((v) => ({ lat: v.latitude!, lng: v.longitude! }));
    if (homeCoords) allPoints.push({ lat: homeCoords.lat, lng: homeCoords.lng });

    if (allPoints.length === 0) return;

    const avgLat = allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length;
    const avgLng = allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [avgLng, avgLat],
      zoom: 8.5,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-left");

    map.on("load", () => {
      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Business home marker
      if (homeCoords) {
        const homeEl = document.createElement("div");
        homeEl.className = "home-mapbox-marker";
        homeEl.innerHTML = `
          <svg width="36" height="46" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 28 18 28s18-14.5 18-28C36 8.06 27.94 0 18 0z" fill="#e91e8c"/>
            <circle cx="18" cy="17" r="9" fill="#0a0f1a"/>
            <rect x="12" y="14" width="12" height="8" rx="1" fill="none" stroke="#e91e8c" stroke-width="1.5"/>
            <path d="M12 14l6-4 6 4" fill="none" stroke="#e91e8c" stroke-width="1.5" stroke-linejoin="round"/>
            <rect x="16" y="17" width="4" height="5" rx="0.5" fill="#e91e8c"/>
          </svg>
        `;
        homeEl.style.cursor = "default";
        homeEl.style.width = "36px";
        homeEl.style.height = "46px";

        const addressLines = homeCoords.address.split(/[,\n]/).map((l: string) => l.trim()).filter(Boolean);
        const homePopup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          className: "venue-mapbox-popup",
        }).setHTML(`
          <div style="font-family: var(--font-body, sans-serif); padding: 4px 0;">
            <p style="font-weight: 600; font-size: 13px; margin: 0 0 2px; color: #e91e8c;">🏠 Business Home</p>
            ${addressLines.map((l: string) => `<p style="font-size: 11px; margin: 0; color: #94a3b8;">${l}</p>`).join("")}
          </div>
        `);

        const homeMarker = new mapboxgl.Marker({ element: homeEl, anchor: "bottom" })
          .setLngLat([homeCoords.lng, homeCoords.lat])
          .setPopup(homePopup)
          .addTo(map);

        markersRef.current.push(homeMarker);

        // Draw distance lines from home to each venue
        mappableVenues.forEach((v) => {
          const lineId = `line-${v.id}`;
          map.addSource(lineId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [homeCoords.lng, homeCoords.lat],
                  [v.longitude!, v.latitude!],
                ],
              },
            },
          });
          map.addLayer({
            id: lineId,
            type: "line",
            source: lineId,
            paint: {
              "line-color": "#e91e8c",
              "line-width": 1.5,
              "line-opacity": 0.3,
              "line-dasharray": [4, 4],
            },
          });
        });
      }

      // Venue markers
      mappableVenues.forEach((v) => {
        const el = document.createElement("div");
        el.className = "venue-mapbox-marker";
        el.innerHTML = `
          <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.164 0 0 7.164 0 16c0 12 16 26 16 26s16-14 16-26C32 7.164 24.836 0 16 0z" fill="#5ab3e8"/>
            <circle cx="16" cy="15" r="7" fill="#0a0f1a"/>
            <path d="M13 14.5c0-.83.67-1.5 1.5-1.5h3c.83 0 1.5.67 1.5 1.5V17h-1v-1h-4v1h-1v-2.5zM14.5 13.5a1.5 1.5 0 113 0h-3z" fill="#5ab3e8"/>
          </svg>
        `;
        el.style.cursor = "pointer";
        el.style.width = "32px";
        el.style.height = "42px";

        // Calculate distance from home
        let distanceText = "";
        if (homeCoords) {
          const R = 3958.8; // Earth radius in miles
          const dLat = ((v.latitude! - homeCoords.lat) * Math.PI) / 180;
          const dLon = ((v.longitude! - homeCoords.lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((homeCoords.lat * Math.PI) / 180) *
              Math.cos((v.latitude! * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          distanceText = `<p style="font-size: 11px; margin: 4px 0 0; color: #e91e8c;">📍 ${distance.toFixed(1)} miles from HQ</p>`;
        }

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          className: "venue-mapbox-popup",
        }).setHTML(`
          <div style="font-family: var(--font-body, sans-serif); padding: 4px 0;">
            <p style="font-weight: 600; font-size: 13px; margin: 0 0 2px; color: #5ab3e8;">${v.name}</p>
            <p style="font-size: 11px; margin: 0; color: #94a3b8;">${v.address_line1}</p>
            <p style="font-size: 11px; margin: 0; color: #94a3b8;">${v.city}, ${v.postcode}</p>
            ${distanceText}
            ${onVenueClick ? `<button onclick="window.__venueClick__('${v.id}')" style="margin-top: 4px; font-size: 11px; color: #5ab3e8; background: none; border: none; cursor: pointer; padding: 0; text-decoration: underline;">Edit venue</button>` : ""}
          </div>
        `);

        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([v.longitude!, v.latitude!])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    });

    // Global click handler for popup buttons
    if (onVenueClick) {
      (window as any).__venueClick__ = (id: string) => onVenueClick(id);
    }

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.remove();
      if ((window as any).__venueClick__) delete (window as any).__venueClick__;
    };
  }, [mappableVenues.length, homeCoords]);

  if (mappableVenues.length === 0 && !homeCoords) {
    return (
      <div className="h-[400px] rounded-lg border border-border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
        No venues with coordinates to display on the map.
      </div>
    );
  }

  return (
    <>
      <style>{`
        .venue-mapbox-popup .mapboxgl-popup-content {
          background: hsl(220, 20%, 8%);
          border: 1px solid hsl(220, 15%, 16%);
          border-radius: 8px;
          padding: 10px 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }
        .venue-mapbox-popup .mapboxgl-popup-tip {
          border-top-color: hsl(220, 20%, 8%);
        }
        .venue-mapbox-marker, .home-mapbox-marker {
          transition: transform 0.15s ease;
        }
        .venue-mapbox-marker:hover, .home-mapbox-marker:hover {
          transform: scale(1.15);
        }
      `}</style>
      <div ref={mapContainer} className="h-[400px] rounded-lg overflow-hidden border border-border" />
    </>
  );
};

export default VenueMap;
