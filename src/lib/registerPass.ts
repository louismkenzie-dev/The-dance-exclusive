/**
 * Class passes on the register (Amie, 30 Sep: "please can it show on adults if they've used a class
 * pass").
 *
 * A pass booking is marked `booking_type = 'pass'` by both places that make one — redeem-pass, when
 * the adult books themselves, and admin-book, when the studio records it — and its notes read
 * `Class pass <id> — session YYYY-MM-DD`. The register already loads both columns, and coaches can
 * read them, so the "Class pass" flag needs no new query at all.
 *
 * The pass itself (how many classes are left, when it runs out) lives in `class_passes`, which only
 * admins and the pass holder can read. So those details appear on the admin register only.
 */
import { format } from "date-fns";

type BookingLike = { booking_type?: string | null; notes?: string | null };

const PASS_NOTE = /Class pass ([0-9a-f-]{36})/i;

/** Did this place come off a class pass? */
export function isPassBooking(b: BookingLike | null | undefined): boolean {
  if (!b) return false;
  // booking_type is the record; the note is a fallback for a row written before the type was set.
  return b.booking_type === "pass" || PASS_NOTE.test(b.notes ?? "");
}

/** The pass a booking came off, from its notes. Same rule as passRef in _shared/classRefunds.ts. */
export function passIdFromNotes(notes: string | null | undefined): string | null {
  return PASS_NOTE.exec(notes ?? "")?.[1] ?? null;
}

export type PassDetails = {
  sessions_total: number | null;
  sessions_remaining: number | null;
  expires_at: string | null;
};

/** "2 of 5 classes left · expires 14 Nov", in the words the register uses. */
export function passSummary(pass: PassDetails, now: Date = new Date()): { text: string; low: boolean } {
  const total = Math.max(0, Number(pass.sessions_total) || 0);
  const left = Math.max(0, Number(pass.sessions_remaining) || 0);
  const parts = [left === 0 ? "No classes left" : `${left} of ${total} ${total === 1 ? "class" : "classes"} left`];

  let expired = false;
  if (pass.expires_at) {
    const expires = new Date(pass.expires_at);
    if (!Number.isNaN(expires.getTime())) {
      expired = expires.getTime() < now.getTime();
      parts.push(`${expired ? "expired" : "expires"} ${format(expires, "d MMM")}`);
    }
  }
  // Worth a word at the door: this is their last class on it, or it has run out.
  return { text: parts.join(" · "), low: left <= 1 || expired };
}
