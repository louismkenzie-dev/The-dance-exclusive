/**
 * Shareable per-class links, so the studio can send a family straight to one
 * class instead of "go to the website and find it".
 *
 * /book/<class id> already existed as a legacy redirect, so it doubles as the
 * shareable link: it resolves the class type and hands over to the right
 * browser tab with that class open.
 */

/** Path a shareable class link points at. */
export const classLinkPath = (classId: string): string => `/book/${classId}`;

/**
 * Full https link to one class, for pasting into WhatsApp or an email.
 * `origin` defaults to wherever the app is running, so it's correct on the
 * live domain without hard-coding it.
 */
export const classShareUrl = (
  classId: string,
  origin: string = typeof window !== "undefined" ? window.location.origin : "",
): string => `${origin.replace(/\/$/, "")}${classLinkPath(classId)}`;

/** Where /c/<id> lands once we know what kind of class it is. */
export const classBrowserPath = (
  classId: string,
  classType: "children" | "adult" | null | undefined,
): string => `/classes/${classType === "adult" ? "adult" : "children"}?class=${classId}`;
