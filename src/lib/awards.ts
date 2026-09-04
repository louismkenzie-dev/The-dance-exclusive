/**
 * End-of-term awards: Dancer of the Term and Most Improved.
 *
 * The studio's problem is fairness — as children move between classes and
 * stay for years it gets hard to remember who has already had one. Everything
 * here is about answering "has this dancer won before, and when?".
 */

export const AWARD_TYPES = ["dancer_of_term", "most_improved"] as const;
export type AwardType = (typeof AWARD_TYPES)[number];

const LABELS: Record<string, string> = {
  dancer_of_term: "Dancer of the Term",
  most_improved: "Most Improved",
};

export const awardTypeLabel = (type: string): string => LABELS[type] ?? type;

export interface StudentAward {
  id: string;
  student_id: string;
  class_id: string | null;
  class_name: string | null;
  term_label: string;
  award_type: string;
  notes: string | null;
  awarded_on: string;
  students?: {
    first_name: string;
    last_name: string;
    preferred_name?: string | null;
  } | null;
}

/** Everything one dancer has won, most recent first. */
export function previousWinsFor(awards: StudentAward[], studentId: string): StudentAward[] {
  return awards
    .filter((a) => a.student_id === studentId)
    .sort((a, b) => b.awarded_on.localeCompare(a.awarded_on));
}

/** A one-line summary for a dancer's profile: "Dancer of the Term × 2". */
export function summariseWins(awards: StudentAward[]): string[] {
  const counts = new Map<string, number>();
  for (const a of awards) counts.set(a.award_type, (counts.get(a.award_type) ?? 0) + 1);
  return [...counts.entries()].map(([type, count]) =>
    count > 1 ? `${awardTypeLabel(type)} × ${count}` : awardTypeLabel(type));
}
