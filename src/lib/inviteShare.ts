// The message a parent gets when the studio has set a place up for them.
//
// Amie: "Sorry Kirsty messaged saying she can't now find the link to pay for
// that class. And I can't see how to re share it with her?"
//
// There was no way. The message was written once, at the moment the booking
// was created, dropped on the clipboard, and never obtainable again — so a
// parent who lost the WhatsApp was stuck and so was Amie. It lives here now,
// so the card on the One-to-ones tab can rebuild the identical message on
// demand, weeks later.
//
// The address is never typed by hand. Typing it is how a link went out as
// "www.app.thedanceexclusive.co.uk", which does not exist, and which two
// parents were sent.

import { format, parseISO } from "date-fns";

export interface ShareDetails {
  /** The parent's full name — only the first name is used. */
  parentName?: string | null;
  className?: string | null;
  /** ISO dates the place covers, in any order. */
  dates?: string[] | null;
  /** The whole amount owed, in pounds, already multiplied out. */
  total?: number | null;
  /** Defaults to the site the admin is looking at, which is the real one. */
  origin?: string;
}

const MAX_DATES = 3;

/** The site the admin is on, which is by definition the right address. */
export const siteOrigin = (): string =>
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "https://app.thedanceexclusive.co.uk";

/** Where every one of these messages points: the family's own bookings page. */
export const accountBookingsUrl = (origin = siteOrigin()): string =>
  `${origin.replace(/\/+$/, "")}/account/bookings`;

/** "Tue 16 Sep", or "Tue 16 Sep, Tue 23 Sep +2 more" for a long run. */
export function describeDates(dates: string[] | null | undefined): string {
  const list = [...(dates ?? [])].filter(Boolean).sort();
  if (list.length === 0) return "";
  const shown = list.slice(0, MAX_DATES).map((d) => format(parseISO(d), "EEE d MMM"));
  const rest = list.length - shown.length;
  return shown.join(", ") + (rest > 0 ? ` +${rest} more` : "");
}

/**
 * One wording, used both when the place is first set up and every time it is
 * reshared — so a parent who gets it twice sees the same thing twice, and
 * Amie never has to compose it herself.
 */
export function inviteMessage(d: ShareDetails): string {
  const firstName = (d.parentName ?? "").trim().split(/\s+/)[0] || "there";
  const className = (d.className ?? "").trim() || "the class";
  const when = describeDates(d.dates);
  const amount = d.total != null && d.total > 0 ? ` — £${d.total.toFixed(2)}` : "";
  return `Hi ${firstName}, here's the link to pay for ${className}${when ? ` (${when})` : ""}${amount}. `
    + `It's waiting in your account: ${accountBookingsUrl(d.origin)}`;
}

/**
 * Copy, with a fallback. `navigator.clipboard` is undefined on an insecure
 * origin and can be refused outright on an iPad, and a silent failure here
 * looks exactly like a successful copy — the parent then gets an empty paste.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* refused — try the old way */ }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Asking a family for a new card.
 *
 * Jodie Cornwell's card failed on 9 September and was replaced; paying that
 * month on the old one would have fixed nothing, and eleven days later Stripe
 * gave up and cancelled both of Eloise's memberships. This is the message
 * that gets sent before that happens, with the address typed by nobody.
 */
export function cardUpdateMessage(d: {
  parentName?: string | null;
  amount?: number | null;
  origin?: string;
}): string {
  const firstName = (d.parentName ?? "").trim().split(/\s+/)[0] || "there";
  const amount = d.amount != null && d.amount > 0 ? ` for £${d.amount.toFixed(2)}` : "";
  return `Hi ${firstName}, your card was declined${amount} when we tried to take this month's payment. `
    + `If you've got a new card, you can add it on your account and it'll be used for this month and every month after: `
    + `${accountBookingsUrl(d.origin)}`;
}
