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

export interface MembershipCancelRequestedData {
  parentName?: string | null;
  studentName?: string | null;
  className: string;
  monthlyAmount: number;
  finalPaymentDate: string; // ISO
  endDate: string; // ISO
}

/**
 * "Friday 15 August 2026" in the studio's own calendar.
 *
 * The caller passes Stripe instants (invoices are raised at 07:00 UTC on the
 * 5th), so the date must be resolved in Europe/London — a UTC-formatted
 * instant names the previous day for anything falling in the 23:00–00:00 UTC
 * hour during BST, telling a parent their money leaves a day earlier than it
 * does. Same zone the billing calendar uses (_shared/billing.ts).
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

export function renderMembershipCancelRequested(data: MembershipCancelRequestedData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const forStudent = data.studentName ? ` for ${escapeHtml(data.studentName)}` : "";
  const amount = `&pound;${Number(data.monthlyAmount).toFixed(2)}`;
  const finalPayment = formatLongDate(data.finalPaymentDate);
  const endDate = formatLongDate(data.endDate);

  const body = `
    ${kicker("Cancellation notice", { align: "center" })}
    ${heading("Notice received", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, this confirms we&#39;ve received your notice to cancel the <strong style="color:${BRAND.ink};">${escapeHtml(data.className)}</strong> monthly membership${forStudent}.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${data.studentName ? detailRow("Dancer", escapeHtml(data.studentName)) : ""}
       ${detailRow("Final payment", `${amount} on ${escapeHtml(finalPayment)}`)}
       ${detailRow("Membership ends", escapeHtml(endDate))}`,
      { accent: "blue" },
    )}

    ${paragraph(
      `In line with our one month&#39;s notice policy, that final payment will still be taken on the usual date. Classes carry on as normal until the membership ends &mdash; there&#39;s nothing more you need to do.`,
    )}

    ${ctaButton("View my bookings", `${BRAND.appUrl}/account/bookings`)}

    ${divider()}

    ${paragraph(
      `Didn&#39;t request this, or changed your mind? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll sort it out.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `Cancellation notice received — ${data.className}`,
    html: renderLayout({
      title: "Cancellation notice received",
      preheader: `Your ${data.className} membership ends on ${endDate}.`,
      body,
      icon: "calendar-check",
    }),
  };
}
