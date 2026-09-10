import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Classes this family has been personally offered a place on, and which plan
 * the studio meant. A saved place overrides the rules that hide a plan from
 * the general public — a trial is normally only offered to a family with no
 * bookings yet, but if Amie has saved a child a trial place, that decision
 * is hers and the class page must honour it.
 *
 * Keyed by class id; the value is the plan on the invite ("trial",
 * "session", …). Empty while signed out or still loading.
 */
export function useInvitedPlans(): Record<string, string> {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) { setPlans({}); return; }
    let cancelled = false;
    void (async () => {
      const { data } = await (supabase as any)
        .from("class_invites")
        .select("class_id, plan")
        .eq("parent_id", user.id)
        .eq("status", "pending");
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const row of ((data as { class_id: string; plan: string }[] | null) ?? [])) {
        if (row.class_id && row.plan) next[row.class_id] = row.plan;
      }
      setPlans(next);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return plans;
}

/**
 * The trial gate to hand `classPlanRows`. Normally "have they booked before?",
 * but a saved trial place unlocks it whatever their history.
 */
export const trialGateFor = (
  invitedPlans: Record<string, string>,
  classId: string,
  hasExistingBookings: boolean | null,
): boolean | null => (invitedPlans[classId] === "trial" ? false : hasExistingBookings);
