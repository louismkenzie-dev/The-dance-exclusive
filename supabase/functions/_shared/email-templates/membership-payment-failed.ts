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

export interface MembershipPaymentFailedData {
  parentName?: string | null;
  studentName?: string | null;
  className: string;
  monthlyAmount: number;
  /** Stripe hosted invoice URL — lets the family pay the failed month right now. */
  payUrl?: string | null;
}

export function renderMembershipPaymentFailed(data: MembershipPaymentFailedData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const forStudent = data.studentName ? ` for ${escapeHtml(data.studentName)}` : "";
  const amount = `&pound;${Number(data.monthlyAmount).toFixed(2)}`;

  const body = `
    ${kicker("Membership payment failed", { align: "center", color: "magenta" })}
    ${heading("Action needed", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, we couldn&#39;t collect this month&#39;s payment for the <strong style="color:${BRAND.ink};">${escapeHtml(data.className)}</strong> monthly membership${forStudent}.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${data.studentName ? detailRow("Dancer", escapeHtml(data.studentName)) : ""}
       ${detailRow("Amount due", amount)}`,
      { accent: "magenta" },
    )}

    ${paragraph(
      `<strong>No need to rebook</strong> &mdash; the payment will be retried automatically over the next few days, and the membership stays in place.`,
    )}
    ${
      data.payUrl
        ? paragraph(
          `The quickest fix is to pay this month now on our secure payment page, hosted by Stripe &mdash; the card processor we use. You can pay with a different card there, and it&#39;s confirmed straight away.`,
        )
        : paragraph(
          `To make sure the retry goes through, please check that your card details are up to date and that there are sufficient funds. If the card has expired or been replaced, just get in touch and we&#39;ll help you update it.`,
        )
    }

    ${data.payUrl ? ctaButton("Pay now", data.payUrl) : ctaButton("View my bookings", `${BRAND.appUrl}/account/bookings`)}
    ${
      // A "pay now" button leading to an unfamiliar domain is the shape of a
      // phishing email — say where it goes before the parent hovers it.
      data.payUrl
        ? paragraph(
          `The button opens invoice.stripe.com, Stripe&#39;s secure payment page &mdash; we never ask for card details by email.`,
          { muted: true, small: true, align: "center" },
        )
        : ""
    }

    ${divider()}

    ${paragraph(
      `Questions, or think this is a mistake? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll put it right.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `Action needed: membership payment failed — ${data.className}`,
    html: renderLayout({
      title: "Membership payment failed",
      preheader: `We couldn't collect this month's payment for ${data.className} — it will be retried automatically.`,
      body,
      icon: "alert-circle",
    }),
  };
}
