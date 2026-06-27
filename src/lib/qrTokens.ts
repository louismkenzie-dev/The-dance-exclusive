import { supabase } from "@/integrations/supabase/client";

// Booking-level QR codes are long-lived: one stable code per booking that
// works for every session in the booking. We still set a `valid_until` so
// the column constraint is satisfied, but it's effectively non-expiring.
const TOKEN_TTL_DAYS = 365 * 5; // 5 years

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/**
 * Get the single QR token for this booking, or create one if it doesn't
 * exist. The same code is valid for the entire duration of the booking
 * across every session — parents only ever need to remember one QR.
 */
export async function getOrCreateBookingQrToken(opts: {
  bookingId: string;
  studentId: string | null;
}): Promise<{ token: string; validUntil: string } | null> {
  const { bookingId, studentId } = opts;

  // Look for the booking-level token (class_session_id IS NULL).
  const { data: existing } = await supabase
    .from("booking_qr_tokens")
    .select("token, valid_until")
    .eq("booking_id", bookingId)
    .is("class_session_id", null)
    .limit(1)
    .maybeSingle();

  if (existing) return { token: existing.token, validUntil: existing.valid_until };

  const token = generateToken();
  const validUntil = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("booking_qr_tokens")
    .insert({
      booking_id: bookingId,
      class_session_id: null,
      student_id: studentId,
      token,
      valid_until: validUntil,
    })
    .select("token, valid_until")
    .single();

  if (error || !data) return null;
  return { token: data.token, validUntil: data.valid_until };
}

/** Encode QR payload (prefix lets the scanner detect our codes). */
export function buildQrPayload(token: string): string {
  return `TDE-CHECKIN:${token}`;
}

export function parseQrPayload(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("TDE-CHECKIN:")) return trimmed.slice("TDE-CHECKIN:".length);
  // Allow raw token paste as fallback
  if (/^[a-z0-9]{16,40}$/i.test(trimmed)) return trimmed;
  return null;
}