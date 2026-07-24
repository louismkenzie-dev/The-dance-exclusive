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
    ${heading("Action needed: membership payment failed", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, we couldn&#39;t collect this month&#39;s payment for the <strong>${escapeHtml(data.className)}</strong> monthly membership${forStudent}.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">${escapeHtml(data.className)}</div>
       ${data.studentName ? detailRow("For", escapeHtml(data.studentName)) : ""}
       ${detailRow("Amount due", amount)}`,
      { accent: "magenta" },
    )}

    ${paragraph(
      `<strong>No need to rebook</strong> &mdash; the payment will be retried automatically over the next few days, and the membership stays in place.`,
    )}
    ${
      data.payUrl
        ? paragraph(
          `The quickest fix is to pay this month securely online now &mdash; you can also use a different card there, and it registers straight away.`,
        )
        : paragraph(
          `To make sure the retry goes through, please check that your card details are up to date and that there are sufficient funds. If the card has expired or been replaced, just get in touch and we&#39;ll help you update it.`,
        )
    }

    ${data.payUrl ? ctaButton("Pay Now", data.payUrl) : ctaButton("View My Memberships", `${BRAND.appUrl}/account/bookings`)}

    ${divider()}

    ${paragraph(
      `Questions, or think this is a mistake? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blueDeep};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll put it right.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `Action needed: membership payment failed — ${data.className}`,
    html: renderLayout({
      title: "Membership payment failed",
      preheader: `We couldn't collect this month's payment for ${data.className} — it will be retried automatically.`,
      body,
    }),
  };
}
