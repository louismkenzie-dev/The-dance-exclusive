/**
 * Which app areas a signed-in role may open.
 *
 * An admin is a SUPERSET of every other role, not a sibling of them. The admin
 * area already exposes everything behind /staff and /portal (and the RLS
 * policies grant admins that data outright), so bouncing an admin out of those
 * routes protects nothing — it only hides screens they are entitled to. It bit
 * the studio owner, who runs classes as well as the business: giving her admin
 * would otherwise have locked her out of the staff-side register she uses at
 * the door.
 *
 * Staff and parent stay strict: they may only open their own area.
 */

export type AppRole = "admin" | "staff" | "parent";

export const canAccessRoute = (
  role: AppRole | null | undefined,
  requiredRole?: AppRole,
): boolean => {
  if (!requiredRole) return true;
  if (!role) return false;
  return role === requiredRole || role === "admin";
};

/** Where a role belongs when it lands somewhere it may not open. */
export const homeRouteFor = (role: AppRole | null | undefined): string =>
  role === "admin" ? "/admin" : role === "staff" ? "/staff" : "/";
