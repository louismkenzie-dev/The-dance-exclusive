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

export interface MembershipPaymentFailedItem {
  className: string;
  studentName?: string | null;
  monthlyAmount: number;
}

export interface MembershipPaymentFailedData {
  parentName?: string | null;
  studentName?: string | null;
  className: string;
  monthlyAmount: number;
  /** Stripe hosted invoice URL — lets the family pay the failed month right now. */
  payUrl?: string | null;
  /**
   * Every membership that failed on the same payment. A family's places are
   * all on one Stripe subscription and fail together, so they belong in one
   * email — a parent with five children's places was sent five copies.
   */
  items?: MembershipPaymentFailedItem[] | null;
}

export function renderMembershipPaymentFailed(data: MembershipPaymentFailedData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const items: MembershipPaymentFailedItem[] = data.items && data.items.length > 0
    ? data.items
    : [{ className: data.className, studentName: data.studentName, monthlyAmount: data.monthlyAmount }];
  const many = items.length > 1;
  const total = items.reduce((sum, i) => sum + Number(i.monthlyAmount || 0), 0);
  const amount = `&pound;${total.toFixed(2)}`;
  const forStudent = !many && items[0].studentName ? ` for ${escapeHtml(items[0].studentName!)}` : "";

  const body = `
    ${kicker("Membership payment failed", { align: "center", color: "magenta" })}
    ${heading("Action needed", { align: "center" })}
    ${paragraph(
      many
        ? `Hi ${escapeHtml(greetingName)}, we couldn&#39;t collect this month&#39;s payment for your <strong style="color:${BRAND.ink};">${items.length} monthly memberships</strong>. They&#39;re paid together, so one payment covers them all.`
        : `Hi ${escapeHtml(greetingName)}, we couldn&#39;t collect this month&#39;s payment for the <strong style="color:${BRAND.ink};">${escapeHtml(items[0].className)}</strong> monthly membership${forStudent}.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      many
        ? `${panelTitle("Your memberships")}
           ${items.map((i) =>
             detailRow(
               i.studentName ? escapeHtml(i.studentName) : escapeHtml(i.className),
               i.studentName
                 ? `${escapeHtml(i.className)} &mdash; &pound;${Number(i.monthlyAmount).toFixed(2)}`
                 : `&pound;${Number(i.monthlyAmount).toFixed(2)}`,
               "user",
             )
           ).join("")}
           ${detailRow("Total due", amount, "credit-card")}`
        : `${panelTitle(escapeHtml(items[0].className))}
           ${items[0].studentName ? detailRow("Dancer", escapeHtml(items[0].studentName!)) : ""}
           ${detailRow("Amount due", amount, "credit-card")}`,
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
    subject: many
      ? `Action needed: membership payment failed — ${items.length} memberships`
      : `Action needed: membership payment failed — ${items[0].className}`,
    html: renderLayout({
      title: "Membership payment failed",
      preheader: many
        ? `We couldn't collect this month's payment for your ${items.length} memberships — it will be retried automatically.`
        : `We couldn't collect this month's payment for ${items[0].className} — it will be retried automatically.`,
      body,
      icon: "alert-circle",
    }),
  };
}
