import {
  BRAND,
  ctaButton,
  escapeHtml,
  heading,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface MembershipEndedData {
  parentName?: string | null;
  studentName?: string | null;
  className: string;
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

export function renderMembershipEnded(data: MembershipEndedData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const forStudent = data.studentName ? `${escapeHtml(data.studentName)}&#39;s` : "your";
  const endDate = formatLongDate(data.endDate);

  const body = `
    ${heading("Your membership has ended", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, ${forStudent} <strong>${escapeHtml(data.className)}</strong> monthly membership ended on <strong>${escapeHtml(endDate)}</strong>, as scheduled. No further payments will be taken.`,
      { muted: true, align: "center" },
    )}

    ${paragraph(
      `Thank you for dancing with us &mdash; it&#39;s been a real joy having ${data.studentName ? escapeHtml(data.studentName) : "you"} in class, and we hope to see ${data.studentName ? "them" : "you"} on the dance floor again soon.`,
    )}
    ${paragraph(
      `You&#39;re welcome back any time &mdash; the door is always open. Browse the timetable and rejoin whenever you&#39;re ready.`,
    )}

    ${ctaButton("Browse Classes", `${BRAND.appUrl}/classes/children`)}

    ${paragraph("With love,<br />The Dance Exclusive team", {
      muted: true,
      small: true,
      align: "center",
    })}
  `;

  return {
    subject: `Your membership has ended — ${data.className}`,
    html: renderLayout({
      title: "Your membership has ended",
      preheader: `Your ${data.className} membership has ended — you're welcome back any time.`,
      body,
    }),
  };
}
