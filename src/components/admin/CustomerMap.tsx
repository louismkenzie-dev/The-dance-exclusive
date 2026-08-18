import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Home, Info } from "lucide-react";

const CYAN = "#00b3e6"; // children
const PINK = "#f43f8e"; // adults
const MIXED = "#a855f7";

/** Cache geocoded postcodes so the map doesn't re-hit the API each visit. */
const GEO_CACHE_KEY = "tde-postcode-geo-v1";
type LatLng = { lat: number; lon: number };

const loadCache = (): Record<string, LatLng | null> => {
  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
};
const saveCache = (cache: Record<string, LatLng | null>) => {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or unavailable — geocoding just repeats next visit */
  }
};

const normalisePostcode = (pc: string) => pc.trim().toUpperCase().replace(/\s+/g, " ");

/** Look up UK postcodes via postcodes.io (free, no key) in bulk, 100 at a time. */
async function geocodePostcodes(postcodes: string[]): Promise<Record<string, LatLng | null>> {
  const cache = loadCache();
  const missing = postcodes.filter((pc) => !(pc in cache));

  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100);
    try {
      const res = await fetch("https://api.postcodes.io/postcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcodes: batch }),
      });
      const json = await res.json();
      for (const row of json?.result ?? []) {
        const query = normalisePostcode(row.query ?? "");
        cache[query] = row.result
          ? { lat: row.result.latitude, lon: row.result.longitude }
          : null; // remember misses too, so we don't retry bad postcodes forever
      }
      for (const pc of batch) if (!(pc in cache)) cache[pc] = null;
    } catch {
      break; // offline / API down — show what we already have
    }
  }
  saveCache(cache);
  return cache;
}

export interface MapCustomer {
  userId: string;
  name: string;
  postcode: string | null;
  /** Has at least one child (non-self) dancer with a booking. */
  hasChildDancer: boolean;
  /** Books for themselves as an adult dancer. */
  hasAdultDancer: boolean;
  /** Venues this customer has confirmed bookings at. */
  venueIds: string[];
}

export interface MapVenue {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

interface CustomerMapProps {
  customers: MapCustomer[];
  venues: MapVenue[];
}

type Audience = "all" | "children" | "adult";
type Layer = "venues" | "homes";

/**
 * Where the customers come from. Two views because the underlying data
 * differs in completeness:
 *
 *  - "Where they train" (default): every confirmed booking maps to a venue,
 *    so this covers 100% of booking customers. Circle size = customers.
 *  - "Where they live": home postcodes, geocoded via postcodes.io. Only
 *    covers customers who've filled in an address, so the coverage is stated
 *    plainly rather than implied.
 */
const CustomerMap = ({ customers, venues }: CustomerMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [audience, setAudience] = useState<Audience>("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [layer, setLayer] = useState<Layer>("venues");
  const [geo, setGeo] = useState<Record<string, LatLng | null>>({});
  const [geocoding, setGeocoding] = useState(false);

  const mappableVenues = useMemo(
    () => venues.filter((v) => v.latitude != null && v.longitude != null),
    [venues],
  );

  // Customers matching the current audience + venue filters.
  const matching = useMemo(
    () =>
      customers.filter((c) => {
        if (audience === "children" && !c.hasChildDancer) return false;
        if (audience === "adult" && !c.hasAdultDancer) return false;
        if (venueFilter !== "all" && !c.venueIds.includes(venueFilter)) return false;
        return true;
      }),
    [customers, audience, venueFilter],
  );

  const withPostcode = useMemo(
    () => matching.filter((c) => c.postcode && c.postcode.trim() !== ""),
    [matching],
  );

  // Geocode the home postcodes on demand (only when that layer is shown).
  useEffect(() => {
    if (layer !== "homes" || withPostcode.length === 0) return;
    let cancelled = false;
    const codes = [...new Set(withPostcode.map((c) => normalisePostcode(c.postcode!)))];
    if (codes.every((c) => c in geo)) return;
    setGeocoding(true);
    geocodePostcodes(codes).then((cache) => {
      if (!cancelled) {
        setGeo(cache);
        setGeocoding(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [layer, withPostcode, geo]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);
    map.setView([51.85, 0.55], 9); // Essex
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // The card animates in; make sure Leaflet measures the final size.
    setTimeout(() => map.invalidateSize(), 200);
    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Redraw markers whenever the data or filters change.
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();

    const points: [number, number][] = [];

    if (layer === "venues") {
      for (const v of mappableVenues) {
        if (venueFilter !== "all" && v.id !== venueFilter) continue;
        const here = matching.filter((c) => c.venueIds.includes(v.id));
        if (here.length === 0) continue;
        const kids = here.filter((c) => c.hasChildDancer).length;
        const adults = here.filter((c) => c.hasAdultDancer).length;
        const colour = kids > 0 && adults > 0 ? MIXED : adults > 0 ? PINK : CYAN;
        const radius = 12 + Math.sqrt(here.length) * 7;
        points.push([v.latitude!, v.longitude!]);
        L.circleMarker([v.latitude!, v.longitude!], {
          radius,
          color: colour,
          weight: 2,
          fillColor: colour,
          fillOpacity: 0.35,
        })
          .bindPopup(
            `<strong>${v.name}</strong><br/>${here.length} customer${here.length === 1 ? "" : "s"}` +
              `<br/><span style="opacity:.7">${kids} with children · ${adults} adult dancer${adults === 1 ? "" : "s"}</span>`,
          )
          .addTo(group);
        L.tooltip({ permanent: true, direction: "center", className: "tde-map-count" })
          .setContent(String(here.length))
          .setLatLng([v.latitude!, v.longitude!])
          .addTo(group);
      }
    } else {
      // Group customers by geocoded postcode so overlapping homes stack.
      const byKey = new Map<string, { lat: number; lon: number; people: MapCustomer[] }>();
      for (const c of withPostcode) {
        const hit = geo[normalisePostcode(c.postcode!)];
        if (!hit) continue;
        const key = `${hit.lat.toFixed(3)},${hit.lon.toFixed(3)}`;
        const entry = byKey.get(key) ?? { lat: hit.lat, lon: hit.lon, people: [] };
        entry.people.push(c);
        byKey.set(key, entry);
      }
      for (const { lat, lon, people } of byKey.values()) {
        const kids = people.filter((p) => p.hasChildDancer).length;
        const adults = people.filter((p) => p.hasAdultDancer).length;
        const colour = kids > 0 && adults > 0 ? MIXED : adults > 0 ? PINK : CYAN;
        points.push([lat, lon]);
        L.circleMarker([lat, lon], {
          radius: 9 + Math.sqrt(people.length) * 5,
          color: colour,
          weight: 2,
          fillColor: colour,
          fillOpacity: 0.45,
        })
          .bindPopup(
            `<strong>${people.length} customer${people.length === 1 ? "" : "s"}</strong><br/>` +
              people.map((p) => `${p.name}${p.postcode ? ` · ${p.postcode}` : ""}`).join("<br/>"),
          )
          .addTo(group);
      }
      // Venues stay as small reference points so catchment is readable.
      for (const v of mappableVenues) {
        L.circleMarker([v.latitude!, v.longitude!], {
          radius: 5,
          color: "#ffffff",
          weight: 1,
          fillColor: "#ffffff",
          fillOpacity: 0.6,
        })
          .bindPopup(`<strong>${v.name}</strong><br/><span style="opacity:.7">Venue</span>`)
          .addTo(group);
        points.push([v.latitude!, v.longitude!]);
      }
    }

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points).pad(0.25), { maxZoom: 12 });
    }
  }, [layer, matching, withPostcode, geo, mappableVenues, venueFilter]);

  const plottedHomes = withPostcode.filter((c) => geo[normalisePostcode(c.postcode!)]).length;

  return (
    <Card className="animate-fade-in">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex rounded-md border border-border overflow-hidden">
            <Button
              size="sm"
              variant={layer === "venues" ? "default" : "ghost"}
              className="rounded-none gap-1.5 h-8"
              onClick={() => setLayer("venues")}
            >
              <MapPin className="h-3.5 w-3.5" /> Where they train
            </Button>
            <Button
              size="sm"
              variant={layer === "homes" ? "default" : "ghost"}
              className="rounded-none gap-1.5 h-8"
              onClick={() => setLayer("homes")}
            >
              <Home className="h-3.5 w-3.5" /> Where they live
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden">
              {(["all", "children", "adult"] as Audience[]).map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant={audience === a ? "default" : "ghost"}
                  className="rounded-none h-8 capitalize"
                  onClick={() => setAudience(a)}
                >
                  {a === "all" ? "Everyone" : a === "children" ? "Children" : "Adults"}
                </Button>
              ))}
            </div>
            <Select value={venueFilter} onValueChange={setVenueFilter}>
              <SelectTrigger className="h-8 w-[190px]">
                <SelectValue placeholder="All venues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All venues</SelectItem>
                {mappableVenues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div ref={containerRef} className="h-[420px] w-full rounded-lg overflow-hidden border border-border" />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: CYAN }} /> Children
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: PINK }} /> Adults
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: MIXED }} /> Both
          </span>
          <span className="ml-auto">
            {layer === "venues" ? (
              <Badge variant="outline">{matching.length} customer{matching.length === 1 ? "" : "s"} shown</Badge>
            ) : (
              <Badge variant="outline">
                {plottedHomes} of {matching.length} plotted{geocoding ? " · locating…" : ""}
              </Badge>
            )}
          </span>
        </div>

        {layer === "homes" && matching.length > 0 && plottedHomes < matching.length && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5 border-t border-border pt-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Only {plottedHomes} of {matching.length} customers have a home address saved, so this view
              is partial. "Where they train" covers everyone. Address is optional at signup — ask
              Louis to collect postcodes if you want this map complete.
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomerMap;
