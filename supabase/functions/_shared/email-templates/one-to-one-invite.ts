import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  FONT_BODY,
  heading,
  panel,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface OneToOneInviteData {
  parentName?: string | null;
  /** The invited dancer (preferred name where set). */
  childName: string;
  className: string;
  sessionDate: string; // YYYY-MM-DD (first session)
  /** Every session in the invite — one-to-ones can run several weeks. */
  sessionDates?: string[] | null;
  startTime?: string | null; // "HH:MM:SS"
  endTime?: string | null;
  venueName?: string | null;
  /** The coach taking the session, when one is assigned. */
  coachName?: string | null;
  /** Price per session. */
  price: number;
}

const prettyDate = (iso: string) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const prettyTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

/** "Thursday 10 September" — no year, for listing several dates compactly. */
const shortDate = (iso: string) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
};

/** Invitation to a private one-to-one session — book & pay in the portal. */
export function renderOneToOneInvite(data: OneToOneInviteData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const time = [prettyTime(data.startTime), prettyTime(data.endTime)].filter(Boolean).join(" – ");
  const dates = (data.sessionDates?.length ? data.sessionDates : [data.sessionDate]).slice().sort();
  const multi = dates.length > 1;
  const total = Number(data.price) * dates.length;

  const body = `
    ${heading("You're invited! ✨", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, <strong>${escapeHtml(data.childName)}</strong> has been personally invited to a private session at The Dance Exclusive.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">${escapeHtml(data.className)}</div>
       ${detailRow("For", escapeHtml(data.childName))}
       ${data.coachName ? detailRow("With", escapeHtml(data.coachName)) : ""}
       ${multi
        ? detailRow(
          `Dates (${dates.length})`,
          dates.map((d) => escapeHtml(shortDate(d))).join("<br />"),
        )
        : detailRow("Date", escapeHtml(prettyDate(dates[0])))}
       ${time ? detailRow("Time", escapeHtml(time)) : ""}
       ${data.venueName ? detailRow("Where", escapeHtml(data.venueName)) : ""}
       ${multi
        ? detailRow("Price", `&pound;${Number(data.price).toFixed(2)} per session &mdash; <strong>&pound;${total.toFixed(2)}</strong> for all ${dates.length}`)
        : detailRow("Price", `&pound;${Number(data.price).toFixed(2)}`)}`,
      { accent: "magenta" },
    )}

    ${paragraph(
      multi
        ? `To secure the ${dates.length} sessions, just book and pay in your account &mdash; they&#39;re booked together in one go, and the invite is waiting for you there.`
        : "To secure the place, just book and pay in your account — the invite is waiting for you there.",
      { align: "center" },
    )}

    ${ctaButton("Book & Pay", `${BRAND.appUrl}/account/bookings`, "magenta")}

    ${divider()}

    ${paragraph(
      `Questions, or can&#39;t make that time? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blueDeep};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll find another slot.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `${data.childName} is invited: ${data.className}`,
    html: renderLayout({
      title: "You're invited",
      preheader: `${data.childName} is invited to ${data.className} on ${prettyDate(data.sessionDate)}.`,
      body,
    }),
  };
}
