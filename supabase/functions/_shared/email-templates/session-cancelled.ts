import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  formatTimeRange,
  heading,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
} from "./layout.ts";

/** What the cancellation means for one dancer's booking. */
export interface SessionCancelledLine {
  studentName?: string | null;
  /** trial | session | drop_in | monthly | termly | … */
  bookingType?: string | null;
  /** moved: a dated booking now sits on `toDate`; carries_on: a standing
   *  weekly place, nothing to do; unmoved: nowhere to move it — the studio
   *  will follow up. */
  outcome: "moved" | "carries_on" | "unmoved";
  toDate?: string | null; // YYYY-MM-DD
  toStartTime?: string | null; // HH:MM:SS
  toEndTime?: string | null;
}

export interface SessionCancelledData {
  parentName?: string | null;
  className: string;
  sessionDate: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM:SS
  endTime?: string | null;
  venueName?: string | null;
  reason?: string | null;
  lines: SessionCancelledLine[];
}

/** "Tuesday 8 September 2026" for a calendar date (no timezone shift). */
function formatLongDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return date
    .toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .replace(",", "");
}

/** "Tue 15 Sep" for the subject line and short rows. */
function formatShortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return date
    .toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .replace(",", "");
}

const planWord = (type?: string | null) => {
  switch (type) {
    case "trial": return "trial";
    case "session":
    case "drop_in": return "session";
    case "monthly":
    case "termly":
    case "yearly": return "weekly place";
    default: return "booking";
  }
};

export function renderSessionCancelled(data: SessionCancelledData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const longDate = formatLongDate(data.sessionDate);
  const shortDate = formatShortDate(data.sessionDate);
  const when = formatTimeRange(data.startTime, data.endTime);
  const reason = data.reason?.trim();

  const lineRows = data.lines.map((l) => {
    const who = l.studentName ? escapeHtml(l.studentName.split(" ")[0]) : "Your";
    const possessive = l.studentName ? `${who}&#39;s` : who;
    const label = `${possessive} ${planWord(l.bookingType)}`;
    let value: string;
    if (l.outcome === "moved" && l.toDate) {
      value = `Moved to <strong style="color:${BRAND.ink};">${escapeHtml(formatLongDate(l.toDate))}</strong>${
        l.toStartTime ? `, ${formatTimeRange(l.toStartTime, l.toEndTime)}` : ""
      } &mdash; nothing to pay.`;
    } else if (l.outcome === "carries_on") {
      value = "Carries on as normal from next week. Nothing changes with your membership.";
    } else {
      value = "There isn&#39;t a later date to move this to yet. We&#39;ll be in touch about a new date or a refund.";
    }
    return detailRow(label, value, null);
  }).join("");

  const body = `
    ${kicker("Class cancelled", { align: "center" })}
    ${heading(`${escapeHtml(data.className)} isn&#39;t running on ${escapeHtml(shortDate)}`, { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, we&#39;re sorry &mdash; <strong style="color:${BRAND.ink};">${escapeHtml(data.className)}</strong>${
        data.venueName ? ` at ${escapeHtml(data.venueName)}` : ""
      } on <strong style="color:${BRAND.ink};">${escapeHtml(longDate)}</strong>${when ? ` (${when})` : ""} has been cancelled${
        reason ? ` &mdash; ${escapeHtml(reason)}` : ""
      }. Here&#39;s what it means for your booking.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle("Your booking")}
       ${lineRows}`,
      { accent: "blue" },
    )}

    ${ctaButton("View my bookings", `${BRAND.appUrl}/account/bookings`)}

    ${divider()}

    ${paragraph(
      `Questions? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll sort it out.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `${data.className} on ${shortDate} is cancelled`,
    html: renderLayout({
      title: "Class cancelled",
      preheader: `${data.className} on ${longDate} isn't running. Here's what happens to your booking.`,
      body,
      icon: "alert-circle",
    }),
  };
}
