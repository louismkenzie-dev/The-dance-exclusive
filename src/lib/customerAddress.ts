export interface CustomerAddress {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
}

/** UK postcode, tolerant of missing/extra spacing and case. */
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export const isValidUkPostcode = (pc: string | null | undefined): boolean =>
  !!pc && UK_POSTCODE.test(pc.trim());

/** "cm7 1AB" → "CM7 1AB" */
export const formatPostcode = (pc: string): string => {
  const clean = pc.toUpperCase().replace(/\s+/g, "");
  if (clean.length < 5) return pc.trim().toUpperCase();
  return `${clean.slice(0, -3)} ${clean.slice(-3)}`;
};

/**
 * The minimum we hold for a customer under the membership agreement:
 * a street line, a town, and a valid postcode. Second line and county
 * stay optional.
 */
export const hasCompleteAddress = (a: CustomerAddress | null | undefined): boolean =>
  !!a &&
  (a.address_line1 ?? "").trim().length > 1 &&
  (a.city ?? "").trim().length > 1 &&
  isValidUkPostcode(a.postcode);

/** Why we ask — shown at the point of collection. */
export const ADDRESS_REQUIRED_REASON =
  "We keep a home address on file for everyone who books with us — it's part of your " +
  "agreement with the studio, and we need it for our registers, emergency records and billing.";
