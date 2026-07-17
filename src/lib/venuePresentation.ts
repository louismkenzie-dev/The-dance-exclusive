// Shared venue presentation/visibility logic for the September 2026 expansion.
// Used by the featured carousel, public pages and admin venue management.

export type VenueStatus = "confirmed" | "provisional" | "inactive";

export const VENUE_STATUSES: VenueStatus[] = ["confirmed", "provisional", "inactive"];

export interface PublicVenueFields {
  status: string;
  publicly_visible: boolean;
  is_featured: boolean;
  featured_order: number | null;
  name: string;
}

export const VENUE_FALLBACK_IMAGE = "/placeholder.svg";

/** URL-safe slug from a venue name (mirrors the SQL backfill). */
export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * A venue may appear on public pages only when it is explicitly public and
 * not inactive. Provisional venues are excluded unless an admin has
 * explicitly made them publicly visible.
 */
export const isVenuePubliclyListable = (v: PublicVenueFields): boolean =>
  v.publicly_visible && v.status !== "inactive";

/**
 * Venues to show in the public featured carousel: featured + publicly
 * listable, ordered deterministically by featured_order (nulls last),
 * then name as a stable tiebreaker.
 */
export const featuredVenuesForDisplay = <T extends PublicVenueFields>(venues: T[]): T[] =>
  venues
    .filter((v) => v.is_featured && isVenuePubliclyListable(v))
    .sort((a, b) => {
      const ao = a.featured_order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.featured_order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });

/** First non-empty image, else the neutral placeholder — the carousel never breaks on missing media. */
export const venueCardImage = (
  ...candidates: Array<string | null | undefined>
): string => candidates.find((c) => !!c && c.trim() !== "") || VENUE_FALLBACK_IMAGE;
