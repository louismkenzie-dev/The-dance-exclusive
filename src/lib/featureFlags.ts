// Feature flags. Every flag defaults to OFF unless the environment variable
// is set to exactly "true".

const flag = (value: string | undefined): boolean => value === "true";

/**
 * Postcode-to-nearest-venue finder (paid geocoding provider).
 * Commercially unapproved (blocker Q16) — must stay disabled by default.
 * The free postcodes.io distance sort already present in the class browser
 * is unrelated to this flag and remains available.
 */
export const ENABLE_POSTCODE_VENUE_FINDER = flag(
  import.meta.env?.VITE_ENABLE_POSTCODE_VENUE_FINDER,
);
