import {
  coachPath,
  publicClassPath,
  venuePath,
  type PublicSchool,
} from "@/lib/publicSchool";

export const publicStaticPaths = [
  "/",
  "/classes",
  "/venues",
  "/team",
  "/events",
  "/about",
  "/schools",
  "/contact",
  "/gallery",
  "/results",
  "/info",
  "/parties",
  "/shop",
  "/term-dates",
];

/** Never index a retired, unpublished or invented entity URL. */
export function publicRouteStatus(
  path: string,
  school: PublicSchool,
): 200 | 404 {
  if (publicStaticPaths.includes(path)) return 200;
  if (school.classes.some((item) => publicClassPath(item) === path)) return 200;
  if (school.venues.some((item) => venuePath(item) === path)) return 200;
  if (school.coaches.some((item) => coachPath(item) === path)) return 200;
  if (school.camps.some((item) => `/events/${item.id}` === path)) return 200;
  return 404;
}

/** Account/checkout routes retain the existing client app and private cache policy. */
export const isBookingAppPath = (path: string) =>
  /^\/(auth|reset-password|staff-onboarding|admin|staff|account|checkout|book|timetable)(\/|$)/.test(
    path,
  ) || /^\/classes\/(children|adult)$/.test(path);

export function publicPaths(school: PublicSchool) {
  return [
    ...new Set([
      ...publicStaticPaths,
      ...school.classes.map(publicClassPath),
      ...school.venues.map(venuePath),
      ...school.coaches.map(coachPath),
      ...school.camps.map((item) => `/events/${item.id}`),
    ]),
  ];
}

export const escapeMarkup = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export const safeJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export function sitemapXml(school: PublicSchool, origin: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicPaths(
    school,
  )
    .map((path) => `<url><loc>${escapeMarkup(origin + path)}</loc></url>`)
    .join("")}</urlset>`;
}
