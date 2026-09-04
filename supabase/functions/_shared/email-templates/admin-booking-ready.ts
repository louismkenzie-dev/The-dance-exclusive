import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  heading,
  HERO,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface AdminBookingReadyData {
  parentName?: string | null;
  /** The dancer the place is for; null when it's the account holder. */
  attendeeName?: string | null;
  className: string;
  plan: string;
  /** Dates for the dated plans (trial / pay-as-you-go). */
  sessionDates?: string[] | null;
  /** What it'll come to, when we know. */
  price?: number | null;
  /** Anything the studio wants to say, in their own words. */
  message?: string | null;
  /** Picks the photo: kids under blue light, or the adult heels silhouette. */
  classType?: "children" | "adult" | null;
  /**
   * The class's weekly slot. An invite carries no session dates (the admin
   * dialog only offers a date picker when recording a past booking), so
   * without these the parent gets an email about a class with no when or
   * where at all.
   */
  dayOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
}

const PLAN_LABEL: Record<string, string> = {
  trial: "Trial class",
  session: "Pay as you go",
  term: "Full term",
  yearly: "Full year",
  monthly: "Monthly membership",
};

const prettyDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  // Date never throws on bad input — it yields an Invalid Date, so the raw
  // value has to be checked for rather than caught.
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const prettyTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

/** "monday" → "Mondays" — the class runs every week, not on one date. */
const weeklyDay = (day: string) =>
  `${day.charAt(0).toUpperCase()}${day.slice(1).toLowerCase()}s`;

/** The studio has set a place up; the family just needs to pay for it. */
export function renderAdminBookingReady(data: AdminBookingReadyData) {
  const greetingName = data.parentName?.trim().split(/\s+/)[0] || "there";
  const who = data.attendeeName ? escapeHtml(data.attendeeName) : "you";
  const dates = data.sessionDates ?? [];
  const time = [prettyTime(data.startTime), prettyTime(data.endTime)].filter(Boolean).join(" – ");
  const hero = data.classType === "adult"
    ? { url: HERO.adults, alt: "Dancer in heels under stage lights" }
    : { url: HERO.kids, alt: "Young dancers mid-move under blue stage lights" };

  const body = `
    ${kicker("Place reserved", { align: "center" })}
    ${heading("Your place is ready", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, we've set up a place for ${who} on <strong style="color:${BRAND.ink};">${escapeHtml(data.className)}</strong> — it's waiting in your account, ready to confirm.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${data.attendeeName ? detailRow("For", escapeHtml(data.attendeeName)) : ""}
       ${detailRow("Plan", escapeHtml(PLAN_LABEL[data.plan] ?? data.plan))}
       ${data.dayOfWeek ? detailRow("Day", escapeHtml(weeklyDay(data.dayOfWeek))) : ""}
       ${time ? detailRow("Time", escapeHtml(time)) : ""}
       ${data.venueName ? detailRow("Venue", escapeHtml(data.venueName)) : ""}
       ${dates.length > 0
        ? detailRow(
          dates.length === 1 ? "Date" : `Dates (${dates.length})`,
          dates.map((d) => escapeHtml(prettyDate(d))).join("<br />"),
        )
        : ""}
       ${data.price != null && data.price > 0
        ? detailRow(
          data.plan === "monthly" ? "Monthly" : "Price",
          `&pound;${Number(data.price).toFixed(2)}${data.plan === "monthly" ? " a month" : ""}`,
        )
        : ""}`,
      { accent: "blue" },
    )}

    ${data.message
      ? `${heading("A note from the studio", { level: 2, align: "center" })}
         ${paragraph(escapeHtml(data.message).replace(/\n/g, "<br />"), { align: "center" })}`
      : ""}

    ${paragraph(
      data.plan === "monthly"
        ? "Tap below to confirm it and add your card — the membership starts once that's done, and everything after that is automatic."
        : "Tap below to confirm it and pay — it only takes a moment.",
      { align: "center" },
    )}

    ${ctaButton("Confirm & pay", `${BRAND.appUrl}/account/bookings`)}

    ${divider()}

    ${paragraph(
      `Not expecting this, or need a different day? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> and we'll sort it.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `${data.attendeeName ? `${data.attendeeName}'s` : "Your"} place on ${data.className} is ready`,
    html: renderLayout({
      title: "Your place is ready",
      preheader: `We've set up ${data.attendeeName ? `${data.attendeeName}'s` : "your"} place on ${data.className}.`,
      body,
      hero,
      icon: "ticket",
    }),
  };
}
