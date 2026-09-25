/**
 * Personalisation: which placements a garment offers, what they cost, and what a parent is
 * allowed to type.
 *
 * Amie sets this per product — tick the placements, set a price each (£3 by default). A parent
 * choosing one pays that price *per garment*, so two hoodies both reading EVIE is two lots of £3.
 *
 * The text is free input that a third party prints onto clothing and opens in Excel, so it is
 * validated with a whitelist rather than a blacklist. Anything not explicitly allowed is refused.
 */

export type PersonalisationPlacement = "front" | "back" | "sleeve";

export const PERSONALISATION_PLACEMENTS: { value: PersonalisationPlacement; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "sleeve", label: "Arm / sleeve" },
];

/** Amie's figure. Per placement, per garment. Overridable per product in admin. */
export const DEFAULT_PERSONALISATION_PRICE = 3;

/** A name down a sleeve. Longer than this and it either won't fit or won't read. */
export const MAX_PERSONALISATION_LENGTH = 20;

/**
 * Letters (any language, so accented names survive), digits, space, hyphen, apostrophe, full stop.
 * Everything else — emoji, control characters, symbols — is refused. Whitelist on purpose: a
 * blacklist would need updating every time Unicode adds something.
 */
const ALLOWED = /^[\p{L}\p{N} '\u2019.-]+$/u;

export type PersonalisationChoice = {
  placement: PersonalisationPlacement;
  text: string;
};

export function placementLabel(placement: string): string {
  return PERSONALISATION_PLACEMENTS.find((p) => p.value === placement)?.label ?? placement;
}

/** Trim, and collapse runs of whitespace, so "  Evie   Rose " becomes "Evie Rose". */
export function normalisePersonalisationText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Not a discriminated union: this project compiles with `strict: false`, where narrowing on
 * `ok: true | false` does not work, so a union would force every caller into a cast.
 * `value` is the normalised text on success and an empty string on failure.
 */
export type ValidationResult = { ok: boolean; value: string; error?: string };

/**
 * Validate what a parent typed. The empty case is an error rather than a silent skip: a ticked
 * placement with no text would charge £3 for nothing and send the printer a blank column.
 */
export function validatePersonalisationText(raw: string | null | undefined): ValidationResult {
  const value = normalisePersonalisationText(raw ?? "");
  if (!value) {
    return { ok: false, value: "", error: "Add the text you'd like printed, or untick this option." };
  }
  if (value.length > MAX_PERSONALISATION_LENGTH) {
    return { ok: false, value: "", error: `Keep it to ${MAX_PERSONALISATION_LENGTH} characters or fewer.` };
  }
  if (!ALLOWED.test(value)) {
    return { ok: false, value: "", error: "Use letters, numbers, spaces, hyphens and apostrophes only." };
  }
  return { ok: true, value };
}

/** Total added to one garment, in pence. Rounded per placement so prices can't drift. */
export function personalisationPence(prices: number[]): number {
  return prices.reduce((sum, p) => sum + Math.round(Number(p || 0) * 100), 0);
}

/**
 * Stable key for basket merging. Two garments merge into one line only when they carry exactly
 * the same personalisation, because the line is the unit the printer works from — two hoodies
 * with different names cannot be "quantity 2".
 *
 * Case-insensitive: "EVIE" and "Evie" are the same instruction to a printer.
 */
export function personalisationSignature(choices: PersonalisationChoice[] | null | undefined): string {
  if (!choices?.length) return "";
  return [...choices]
    .map((c) => `${c.placement}:${normalisePersonalisationText(c.text).toLowerCase()}`)
    .sort()
    .join("|");
}
