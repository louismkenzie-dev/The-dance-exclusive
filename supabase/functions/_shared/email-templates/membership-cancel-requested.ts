import {
  BRAND,
  detailRow,
  divider,
  escapeHtml,
  FONT_BODY,
  heading,
  panel,
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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Friday 15 August 2026" — plain JS, UTC-based so the server TZ can't shift the date. */
function formatLongDate(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function renderMembershipCancelRequested(data: MembershipCancelRequestedData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const forStudent = data.studentName ? ` for ${escapeHtml(data.studentName)}` : "";
  const amount = `&pound;${Number(data.monthlyAmount).toFixed(2)}`;
  const finalPayment = formatLongDate(data.finalPaymentDate);
  const endDate = formatLongDate(data.endDate);

  const body = `
    ${heading("We&#39;ve received your cancellation notice", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, this confirms we&#39;ve received your notice to cancel the <strong>${escapeHtml(data.className)}</strong> monthly membership${forStudent}.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">${escapeHtml(data.className)}</div>
       ${data.studentName ? detailRow("For", escapeHtml(data.studentName)) : ""}
       ${detailRow("Final payment", `${amount} on ${escapeHtml(finalPayment)}`)}
       ${detailRow("Membership ends", escapeHtml(endDate))}`,
      { accent: "blue" },
    )}

    ${paragraph(
      `In line with our one month&#39;s notice policy, the final payment of <strong>${amount}</strong> will still be taken on <strong>${escapeHtml(finalPayment)}</strong>.`,
    )}
    ${paragraph(
      `Classes continue as normal until <strong>${escapeHtml(endDate)}</strong>, when the membership ends automatically &mdash; there&#39;s nothing more you need to do.`,
    )}

    ${divider()}

    ${paragraph(
      `Didn&#39;t request this, or changed your mind? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blueDeep};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll sort it out.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `Cancellation notice received — ${data.className}`,
    html: renderLayout({
      title: "Cancellation notice received",
      preheader: `Your ${data.className} membership ends on ${endDate}.`,
      body,
    }),
  };
}
