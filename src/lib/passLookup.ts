import { supabase } from "@/integrations/supabase/client";
import { isPassBooking, passIdFromBooking, type PassBookingLike, type PassSummary } from "./passBookings";

/**
 * Resolve the class passes behind a register's pass bookings, so each row can
 * say which pass was used and how many classes are left on it. One round trip
 * per register, and nothing at all when the register holds no pass bookings.
 */
export async function loadPassSummaries(
  bookings: PassBookingLike[],
): Promise<Map<string, PassSummary>> {
  const summaries = new Map<string, PassSummary>();
  const passIds = [...new Set(bookings.filter(isPassBooking).map(passIdFromBooking).filter(Boolean))] as string[];
  if (passIds.length === 0) return summaries;

  const { data: passes } = await supabase
    .from("class_passes")
    .select("id, pass_type, sessions_remaining, sessions_total")
    .in("id", passIds);
  if (!passes || passes.length === 0) return summaries;

  const codes = [...new Set(passes.map((p) => p.pass_type))];
  const { data: types } = await supabase
    .from("class_pass_types")
    .select("code, label")
    .in("code", codes);
  const labelByCode = new Map((types ?? []).map((t) => [t.code, t.label]));

  for (const pass of passes) {
    summaries.set(pass.id, {
      label: labelByCode.get(pass.pass_type) ?? null,
      sessionsRemaining: pass.sessions_remaining,
      sessionsTotal: pass.sessions_total,
    });
  }
  return summaries;
}
