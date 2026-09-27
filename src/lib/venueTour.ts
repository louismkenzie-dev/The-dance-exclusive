import type { PublicVenue } from "./publicSchool";

export type VenuePoint = { latitude: number; longitude: number; approximate: boolean };
export type VenueSlide = { src: string; caption: string };
export const normalisePostcode = (postcode: string | null) => (postcode ?? "").replace(/\s/g, "").toUpperCase();

export function savedVenuePoint(venue: Pick<PublicVenue, "latitude" | "longitude">): VenuePoint | null {
  const { latitude, longitude } = venue;
  return typeof latitude === "number" && typeof longitude === "number" &&
    Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude, approximate: false } : null;
}

export function venueSlides(venue: PublicVenue, storageUrl: string): VenueSlide[] {
  const gallery = [...(venue.venue_photos ?? [])]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    .map(photo => ({
      src: `${storageUrl}/storage/v1/object/public/venue-photos/${photo.file_path.split("/").map(encodeURIComponent).join("/")}`,
      caption: photo.caption || `${venue.name} · ${photo.category === "indoor" ? "Inside the venue" : photo.category === "parking" ? "Parking" : "Outside the venue"}`,
    }));
  const legacy = [venue.photo_outside, venue.photo_indoor, venue.photo_parking]
    .filter((src): src is string => Boolean(src?.trim())).map(src => ({ src, caption: venue.name }));
  const photos = [...gallery, ...legacy];
  if (!photos.length && venue.hero_image) photos.push({ src: venue.hero_image, caption: `${venue.name} · Venue preview` });
  return photos.filter((photo, index) => photos.findIndex(item => item.src === photo.src) === index);
}

/** Only public venue postcodes are sent; saved admin coordinates always take priority. */
export async function lookupVenuePostcodes(postcodes: string[], signal?: AbortSignal): Promise<Record<string, VenuePoint>> {
  const results = await Promise.all(postcodes.map(async postcode => {
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, { signal });
      if (!response.ok) return null;
      const json = await response.json();
      const point = savedVenuePoint(json.result ?? {});
      return point ? [postcode, { ...point, approximate: true }] as const : null;
    } catch { return null; }
  }));
  return Object.fromEntries(results.filter(result => result !== null));
}
