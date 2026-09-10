/**
 * Spending a place the studio saved for a family.
 *
 * A class_invite is the studio saying "there's a place here for you" — a
 * trial they've offered, or a link to pay for a session. Nothing used to
 * spend one: it stayed "pending" for ever after the family booked, which
 * left it cluttering the studio's list and, because a pending invite is what
 * unlocks a plan the public rules would otherwise hide, left the family able
 * to take the same offer again.
 */

export interface InviteRow {
  id: string;
  student_id: string | null;
  plan: string | null;
}

/**
 * Which pending invite a booking spends, out of the ones on this class.
 * Exported and pure so the rule can be tested: an invite named for another
 * child is never spent, one for the family as a whole is, and where several
 * fit, the plan actually bought wins over the oldest.
 *
 * Callers pass rows already ordered oldest first.
 */
export function chooseInvite(
  invites: InviteRow[],
  studentId: string | null,
  plan: string | null,
): InviteRow | null {
  const candidates = invites.filter((inv) => !inv.student_id || inv.student_id === studentId);
  if (candidates.length === 0) return null;
  return candidates.find((inv) => inv.plan === plan) ?? candidates[0];
}

export interface InviteMatch {
  userId: string;
  classId: string;
  /** The attendee the booking is for, when there is one. */
  studentId: string | null;
  /** What was actually bought — "trial", "session", "monthly"… */
  plan: string | null;
}

/**
 * Mark at most ONE pending invite as accepted, and only one that plausibly
 * belongs to this booking: same class, and either named for this attendee or
 * for the family as a whole. Where several fit, the one whose plan matches
 * what was bought wins, then the oldest. The update is guarded on the row
 * still being pending, so a webhook and a poll arriving together cannot
 * spend two.
 *
 * Never throws. A booking that has been paid for must not come undone
 * because the tidying-up after it failed.
 */
export async function consumeInvite(supabase: any, match: InviteMatch): Promise<string | null> {
  const { userId, classId, studentId, plan } = match;
  if (!userId || !classId) return null;
  try {
    const { data: invites, error } = await supabase
      .from("class_invites")
      .select("id, student_id, plan, created_at")
      .eq("parent_id", userId)
      .eq("class_id", classId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Could not look up invites to spend:", error);
      return null;
    }

    const chosen = chooseInvite((invites ?? []) as InviteRow[], studentId, plan);
    if (!chosen) return null;
    const { error: updateError } = await supabase
      .from("class_invites")
      .update({ status: "accepted" })
      .eq("id", chosen.id)
      .eq("status", "pending");
    if (updateError) {
      console.error("Could not mark invite accepted:", updateError);
      return null;
    }
    console.log("Invite spent:", chosen.id, "class:", classId, "plan:", plan);
    return chosen.id;
  } catch (e) {
    console.error("Spending the invite failed:", e);
    return null;
  }
}
