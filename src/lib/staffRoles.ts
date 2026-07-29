/**
 * Seniority order for displaying staff — leadership first, then the people who
 * teach, then the people who support, then everyone else. Used by the admin
 * Staff list and the public "Meet the Crew" page so both read the same way.
 */
const ROLE_RANK: Record<string, number> = {
  ceo_owner: 0,
  admin: 1,
  instructor: 2,
  choreographer: 3,
  assistant_instructor: 4,
  assistant: 5,
  receptionist: 6,
  volunteer: 7,
};

/** Custom ("other") roles sort after every known role, before name tie-break. */
const UNKNOWN_ROLE_RANK = 90;

export const staffRoleRank = (role: string | null | undefined): number =>
  role == null ? UNKNOWN_ROLE_RANK + 1 : ROLE_RANK[role] ?? UNKNOWN_ROLE_RANK;

/**
 * Comparator: seniority first, then alphabetical within each rank so the list
 * is stable and predictable as staff are added.
 */
export const compareStaffBySeniority = <T extends { role?: string | null }>(
  a: T,
  b: T,
  // NoInfer so the element type is driven by the two staff records, not by the
  // accessor — otherwise a standalone accessor narrows T and fails to compile.
  nameOf: (s: NoInfer<T>) => string,
): number => staffRoleRank(a.role) - staffRoleRank(b.role) || nameOf(a).localeCompare(nameOf(b));
