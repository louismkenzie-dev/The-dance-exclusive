import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  heading,
  kicker,
  panel,
  panelTitle,
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

const prettyTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

/** "Thursday 10 September" — the format used for every date in this email. */
const shortDate = (iso: string) => {
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

/** Invitation to a private one-to-one session — book & pay in the portal. */
export function renderOneToOneInvite(data: OneToOneInviteData) {
  const greetingName = data.parentName?.trim().split(/\s+/)[0] || "there";
  const time = [prettyTime(data.startTime), prettyTime(data.endTime)].filter(Boolean).join(" – ");
  const dates = (data.sessionDates?.length ? data.sessionDates : [data.sessionDate]).slice().sort();
  const multi = dates.length > 1;
  const total = Number(data.price) * dates.length;

  const body = `
    ${kicker("One-to-one invitation", { align: "center", color: "magenta" })}
    ${heading("You're invited!", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, <strong style="color:${BRAND.ink};">${escapeHtml(data.childName)}</strong> has been personally invited to ${multi ? `a block of ${dates.length} private sessions` : "a private session"} at The Dance Exclusive.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${detailRow("For", escapeHtml(data.childName))}
       ${data.coachName ? detailRow("With", escapeHtml(data.coachName)) : ""}
       ${multi
        ? detailRow(
          `Dates (${dates.length})`,
          dates.map((d) => escapeHtml(shortDate(d))).join("<br />"),
        )
        : detailRow("Date", escapeHtml(shortDate(dates[0])))}
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
      `Questions, or can&#39;t make that time? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll find another slot.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `${data.childName} is invited: ${data.className}`,
    html: renderLayout({
      title: "You're invited",
      preheader: multi
        ? `${data.childName} is invited to ${data.className} — ${dates.length} sessions from ${shortDate(dates[0])}.`
        : `${data.childName} is invited to ${data.className} on ${shortDate(dates[0])}.`,
      body,
      icon: "sparkles",
    }),
  };
}
