import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  HERO,
  kicker,
  heading,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface WaitlistSpaceData {
  parentName?: string | null;
  className: string;
  dayOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  classType?: "children" | "adult" | null;
  /**
   * Optional: the class the place opened up in, so the CTA can land on it
   * instead of the whole listing (the class browser reads ?class=<id>).
   * Falls back to the listing when the sender doesn't pass it.
   */
  classId?: string | null;
}

const prettyTime = (t?: string | null) => (t ? t.slice(0, 5) : null);
const prettyDay = (d?: string | null) =>
  d ? d.charAt(0).toUpperCase() + d.slice(1) : null;

/** Sent when a class the parent is waitlisted for has a place free again. */
export function renderWaitlistSpace(data: WaitlistSpaceData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const time = [prettyTime(data.startTime), prettyTime(data.endTime)].filter(Boolean).join(" – ");
  const browsePath = data.classType === "adult" ? "/classes/adult" : "/classes/children";
  const bookUrl = `${BRAND.appUrl}${browsePath}${
    data.classId ? `?class=${encodeURIComponent(data.classId)}` : ""
  }`;

  const body = `
    ${kicker("Waitlist update", { align: "center", color: "magenta" })}
    ${heading("A space has opened up!", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, good news — a place is now available in a class you're on the waitlist for. Spaces go quickly, so book soon to <strong style="color:${BRAND.ink};">secure it</strong>.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${data.dayOfWeek ? detailRow("Day", escapeHtml(prettyDay(data.dayOfWeek)!)) : ""}
       ${time ? detailRow("Time", escapeHtml(time)) : ""}
       ${data.venueName ? detailRow("Venue", escapeHtml(data.venueName)) : ""}`,
      { accent: "magenta" },
    )}

    ${ctaButton("Book Now", bookUrl)}

    ${divider()}

    ${paragraph(
      // Each waitlist entry is notified once and then stamped (daily-reminders
      // stamps notified_at and nothing clears it), so we must not promise a
      // second email — we tell them to re-join instead.
      `Booking is first come, first served. If the place has gone by the time you look, tap <strong style="color:${BRAND.ink};">Join waitlist</strong> on the class again and we'll email you the next time one frees up. Questions? Contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a>.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `A space has opened up in ${data.className}!`,
    html: renderLayout({
      title: "Waitlist update",
      preheader: `A place is free in ${data.className} — book now to secure it.`,
      body,
      hero: data.classType === "adult"
        ? { url: HERO.adults, alt: "Dancer in heels under stage lights" }
        : { url: HERO.kids, alt: "Young dancers mid-move under blue stage lights" },
      icon: "ticket",
    }),
  };
}
