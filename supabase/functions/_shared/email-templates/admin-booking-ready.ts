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
}

const PLAN_LABEL: Record<string, string> = {
  trial: "Trial class",
  session: "Pay as you go",
  term: "Full term",
  yearly: "Full year",
  monthly: "Monthly membership",
};

const prettyDate = (iso: string) => {
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

/** The studio has set a place up; the family just needs to pay for it. */
export function renderAdminBookingReady(data: AdminBookingReadyData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const who = data.attendeeName ? escapeHtml(data.attendeeName) : "you";
  const dates = data.sessionDates ?? [];

  const body = `
    ${heading("Your place is ready", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, we've set up a place for ${who} on <strong>${escapeHtml(data.className)}</strong> — it's waiting in your account, ready to confirm.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">${escapeHtml(data.className)}</div>
       ${data.attendeeName ? detailRow("For", escapeHtml(data.attendeeName)) : ""}
       ${detailRow("Plan", escapeHtml(PLAN_LABEL[data.plan] ?? data.plan))}
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

    ${data.message ? paragraph(escapeHtml(data.message).replace(/\n/g, "<br />")) : ""}

    ${paragraph(
      data.plan === "monthly"
        ? "Tap below to confirm it and add your card — the membership starts once that's done, and everything after that is automatic."
        : "Tap below to confirm it and pay — it only takes a moment.",
      { align: "center" },
    )}

    ${ctaButton("Confirm & pay", `${BRAND.appUrl}/account/bookings`, "magenta")}

    ${divider()}

    ${paragraph(
      `Not expecting this, or need a different day? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blueDeep};text-decoration:none;">${BRAND.supportEmail}</a> and we'll sort it.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `Your place on ${data.className} is ready`,
    html: renderLayout({
      title: "Your place is ready",
      preheader: `We've set up ${data.attendeeName ? `${data.attendeeName}'s` : "your"} place on ${data.className}.`,
      body,
    }),
  };
}
