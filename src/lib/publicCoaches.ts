import type { PublicCoach } from "./publicSchool";
import { compareStaffBySeniority } from "./staffRoles";

// Editorial identity, verified against Amie's existing staff record. This is
// never an access-control rule and never supplies a missing/unpublished profile.
export const FOUNDER_COACH_ID = "b278f969-fb4e-414d-a78a-0d5f97894f10";

export const isFounderCoach = (coach: Pick<PublicCoach, "id">) =>
  coach.id === FOUNDER_COACH_ID;

export function publicCoachTitle(coach: Pick<PublicCoach, "id" | "role">) {
  if (isFounderCoach(coach)) return "Founder";
  const labels: Record<string, string> = {
    ceo_owner: "School director",
    instructor: "Dance coach",
    staff: "Dance coach",
    assistant_instructor: "Assistant dance coach",
    assistant: "Dance assistant",
    choreographer: "Choreographer",
    admin: "School team",
    receptionist: "School team",
    volunteer: "Volunteer",
  };
  return labels[coach.role || ""] || coach.role?.replace(/_/g, " ") || "Dance coach";
}

export function orderPublicCoaches(coaches: PublicCoach[]) {
  return [...coaches].sort((a, b) =>
    Number(isFounderCoach(b)) - Number(isFounderCoach(a)) ||
    compareStaffBySeniority(a, b, (coach) => coach.first_name || ""),
  );
}
