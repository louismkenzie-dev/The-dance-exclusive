/**
 * Naming a private session.
 *
 * A private is not always one child. Amie runs duos, trios and quad rehearsal
 * privates, and what they're called has to hold up in three places at once:
 * the admin list, the class name on the timetable and register, and the
 * invitation email each family gets. So the words live here rather than being
 * written out three times slightly differently.
 *
 * Mirrored at src/lib/privateSession.ts for the app — KEEP THE TWO IN SYNC.
 */

/** How many dancers one private can hold. Amie's biggest is a quad; the extra
 *  couple of places are headroom, not an invitation to run a class through
 *  here — a real group class belongs on the timetable. */
export const MAX_DANCERS = 6;

const PRIVATE_WORD: Record<number, string> = { 1: "One-to-one", 2: "Duo", 3: "Trio", 4: "Quad" };

/** What the studio calls a private of this size. */
export const privateWord = (n: number): string => PRIVATE_WORD[n] ?? "Private group";

/** "Ella", "Ella & Immy", "Ella, Immy & Noah" — the way you'd say it aloud. */
export const listNames = (names: string[]): string =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;

/**
 * The class name a private gets when the studio doesn't type one. A solo is
 * still "1:1 Session — Ella with Leah", exactly as it has always been, so
 * nothing already on the timetable reads differently from what's created
 * tomorrow.
 */
export const privateClassName = (dancerNames: string[], coachName?: string | null): string => {
  const withCoach = coachName ? ` with ${coachName}` : "";
  return dancerNames.length === 1
    ? `1:1 Session — ${dancerNames[0]}${withCoach}`
    : `${privateWord(dancerNames.length)} — ${listNames(dancerNames)}${withCoach}`;
};
