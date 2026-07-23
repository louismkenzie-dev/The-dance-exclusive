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

  const body = `
    ${heading("Your class change is confirmed", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, the monthly membership${forStudent} has moved from <strong>${escapeHtml(data.oldClassName)}</strong> to <strong>${escapeHtml(data.newClassName)}</strong>. The class register has been updated &mdash; the change takes effect straight away.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">${escapeHtml(data.newClassName)}</div>
       ${data.studentName ? detailRow("For", escapeHtml(data.studentName)) : ""}
       ${schedule ? detailRow("When", schedule) : ""}
       ${data.newVenueName ? detailRow("Venue", escapeHtml(data.newVenueName)) : ""}
       ${detailRow("Monthly payment", amount)}
       ${data.nextPaymentDate ? detailRow("Next payment", escapeHtml(formatLongDate(data.nextPaymentDate))) : ""}`,
      { accent: "blue" },
    )}

    ${paragraph(
      `Your membership simply carries on &mdash; same rolling monthly payment, now for the new class${data.nextPaymentDate ? `, with the next payment of <strong>${amount}</strong> on <strong>${escapeHtml(formatLongDate(data.nextPaymentDate))}</strong>` : ""}.`,
    )}

    ${divider()}

    ${paragraph(
      `Didn&#39;t request this, or need to change it back? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blueDeep};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll sort it out.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `Class change confirmed — ${data.newClassName}`,
    html: renderLayout({
      title: "Class change confirmed",
      preheader: `Your membership has moved to ${data.newClassName}.`,
      body,
    }),
  };
}
