// What a dancer is called on a register, and what they are actually called.
//
// Louis, after Amie filmed herself being blocked from recording a class:
// "It was because Christina Clark is the customer name. However, on the
// register it is showing her nickname, which is Peach Clark. So Amy was
// unaware that she had actually booked on."
//
// The register led with the preferred name and never showed the real one, so
// Christina Clark and Peach Clark looked like two different people — one in
// the booking system, one on the register. 67 of the studio's 359 dancers
// have a nickname that differs from their first name, so this was 67 chances
// to make the same mistake.
//
// Registers now lead with the name on the booking, with what they are called
// underneath. Teachers get both: the name to shout, and the name to give an
// ambulance.

export interface NamedStudent {
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
}

const clean = (v: string | null | undefined): string => (v ?? "").trim();

/** The name on the booking — first and last, exactly as the family gave them. */
export function officialName(student: NamedStudent | null | undefined, fallback = "Adult attendee"): string {
  if (!student) return fallback;
  const full = [clean(student.first_name), clean(student.last_name)].filter(Boolean).join(" ");
  return full || fallback;
}

/**
 * What they are called, when that is genuinely different. A preferred name
 * that merely repeats the first name ("Ellie" for Ellie) is noise on a
 * register, so it is not returned — 256 dancers have a preferred name but
 * only 67 have one that differs.
 */
export function nicknameOf(student: NamedStudent | null | undefined): string | null {
  const preferred = clean(student?.preferred_name);
  if (!preferred) return null;
  return preferred.toLowerCase() === clean(student?.first_name).toLowerCase() ? null : preferred;
}

/** One line, for somewhere there is no room for two: `Christina clark ("Peach")`. */
export function nameWithNickname(student: NamedStudent | null | undefined, fallback = "Adult attendee"): string {
  const name = officialName(student, fallback);
  const nick = nicknameOf(student);
  return nick ? `${name} ("${nick}")` : name;
}
