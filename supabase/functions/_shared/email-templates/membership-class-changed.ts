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

export interface MembershipClassChangedData {
  parentName?: string | null;
  studentName?: string | null;
  oldClassName: string;
  newClassName: string;
  newDay?: string | null;
  newStartTime?: string | null; // "HH:MM:SS"
  newEndTime?: string | null;
  newVenueName?: string | null;
  monthlyAmount: number;
  nextPaymentDate?: string | null; // ISO
}

/**
 * "Friday 15 August 2026" in the studio's own calendar.
 *
 * The caller passes a Stripe period end (an exact instant), so the day must be
 * resolved in Europe/London — formatting in UTC names the previous day for any
 * instant in the 23:00–00:00 UTC hour during BST, which would tell a parent the
 * wrong payment date. Same zone the billing calendar uses (_shared/billing.ts).
 */
function formatLongDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Intl puts a comma after the weekday ("Sunday, 5 July 2026"); the studio's
  // house style, and every other template, writes it without one.
  return d
    .toLocaleDateString("en-GB", {
      timeZone: "Europe/London",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .replace(",", "");
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function renderMembershipClassChanged(data: MembershipClassChangedData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const forStudent = data.studentName ? ` for ${escapeHtml(data.studentName)}` : "";
  const amount = `&pound;${Number(data.monthlyAmount).toFixed(2)}`;
  const day = data.newDay ? `${capitalise(data.newDay)}s` : null;
  const time = data.newStartTime
    ? `${data.newStartTime.slice(0, 5)}${data.newEndTime ? ` &ndash; ${data.newEndTime.slice(0, 5)}` : ""}`
    : null;
  const schedule = [day, time].filter(Boolean).join(", ");
  const nextPayment = data.nextPaymentDate ? formatLongDate(data.nextPaymentDate) : null;

  const body = `
    ${kicker("Membership update", { align: "center" })}
    ${heading("Class change confirmed", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, the monthly membership${forStudent} has moved from <strong style="color:${BRAND.ink};">${escapeHtml(data.oldClassName)}</strong> to <strong style="color:${BRAND.ink};">${escapeHtml(data.newClassName)}</strong>. The class register has been updated &mdash; the change takes effect straight away.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.newClassName))}
       ${data.studentName ? detailRow("Dancer", escapeHtml(data.studentName)) : ""}
       ${schedule ? detailRow("When", schedule) : ""}
       ${data.newVenueName ? detailRow("Venue", escapeHtml(data.newVenueName)) : ""}
       ${detailRow("Monthly payment", amount)}
       ${nextPayment ? detailRow("Next payment", escapeHtml(nextPayment)) : ""}`,
      { accent: "blue" },
    )}

    ${paragraph(
      `Your membership carries on as a rolling monthly plan. From the next payment it&#39;s <strong>${amount}</strong> for ${escapeHtml(data.newClassName)}${nextPayment ? `, due on <strong>${escapeHtml(nextPayment)}</strong>` : ""} &mdash; nothing to pay today.`,
    )}

    ${ctaButton("View my bookings", `${BRAND.appUrl}/account/bookings`)}

    ${divider()}

    ${paragraph(
      `Didn&#39;t request this, or need to change it back? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll sort it out.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `Class change confirmed — ${data.newClassName}`,
    html: renderLayout({
      title: "Class change confirmed",
      preheader: `Your membership has moved to ${data.newClassName}.`,
      body,
      icon: "calendar-check",
    }),
  };
}
