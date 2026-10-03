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

export interface MembershipEndedData {
  parentName?: string | null;
  studentName?: string | null;
  className: string;
  endDate: string; // ISO
  /**
   * True only when the membership ran to the end of an agreed notice period.
   * The same email is also sent when a subscription turns up cancelled in
   * Stripe (an admin cancelling in the dashboard, dunning giving up), which
   * the family never scheduled — so the copy only claims "as planned" when
   * this is explicitly set. Left unset, the wording is true either way.
   */
  scheduled?: boolean | null;
  /**
   * Other memberships in the family whose 10% sibling discount ended because this was the child's
   * last class (_shared/applySiblingDrop.ts). A family must be told before a price goes up, so the
   * email that announces the ending says so, with the new amount and when it is first taken.
   */
  siblingPriceChanges?: {
    studentName: string | null;
    className: string;
    from: number;
    to: number;
    nextPaymentDate: string | null;
  }[] | null;
}

/**
 * "Friday 15 August 2026" in the studio's own calendar.
 *
 * The end date arrives as an ISO instant, so the day must be resolved in
 * Europe/London — formatting in UTC names the previous day for any instant in
 * the 23:00–00:00 UTC hour during BST. Same zone as _shared/billing.ts.
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

const pounds = (n: number) => `&pound;${Number(n).toFixed(2)}`;

function siblingSection(changes: NonNullable<MembershipEndedData["siblingPriceChanges"]>, leaver: string | null): string {
  if (!changes.length) return "";
  const names = [...new Set(changes.map((c) => c.studentName?.split(" ")[0]).filter(Boolean))] as string[];
  const who = names.length ? names.map(escapeHtml).join(" and ") : "your other child";
  const rows = changes
    .map((c) => {
      const when = c.nextPaymentDate ? ` from ${escapeHtml(formatLongDate(c.nextPaymentDate))}` : " from the next payment";
      const label = `${c.studentName ? `${escapeHtml(c.studentName)} &mdash; ` : ""}${escapeHtml(c.className)}`;
      return detailRow(label, `${pounds(c.from)} &rarr; <strong style="color:${BRAND.ink};">${pounds(c.to)}</strong> a month${when}`, "credit-card");
    })
    .join("");
  return `
    ${divider()}
    ${paragraph(
      `<strong style="color:${BRAND.ink};">A change to ${who}&#39;s membership.</strong> The 10% sibling discount applies while two or more children dance with us, so with ${leaver ? escapeHtml(leaver) : "this membership"} finishing it no longer applies. ${who}&#39;s membership carries on exactly as before, at the standard price:`,
    )}
    ${panel(`${panelTitle("New monthly price")}${rows}`, { accent: "blue" })}
  `;
}

export function renderMembershipEnded(data: MembershipEndedData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const studentFirst = data.studentName?.split(" ")[0] || null;
  const whose = studentFirst ? `${escapeHtml(studentFirst)}&#39;s` : "your";
  const endDate = formatLongDate(data.endDate);
  const scheduled = data.scheduled === true;

  const body = `
    ${kicker("Membership ended", { align: "center" })}
    ${heading("Thank you for dancing", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, ${whose} <strong style="color:${BRAND.ink};">${escapeHtml(data.className)}</strong> monthly membership has come to an end${scheduled ? " at the end of your notice period, as planned" : ""}. No further payments will be taken.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${data.studentName ? detailRow("Dancer", escapeHtml(data.studentName)) : ""}
       ${detailRow(scheduled ? "Ended on" : "End date", escapeHtml(endDate))}
       ${detailRow("Membership", "Closed &mdash; no further payments")}`,
      { accent: "blue" },
    )}

    ${siblingSection(data.siblingPriceChanges ?? [], studentFirst)}

    ${paragraph(
      `It&#39;s been a real joy having ${studentFirst ? escapeHtml(studentFirst) : "you"} in class, and we hope to see ${studentFirst ? "them" : "you"} on the dance floor again soon.`,
    )}
    ${paragraph(
      `You&#39;re welcome back any time &mdash; the door is always open. Browse the timetable and rejoin whenever you&#39;re ready.`,
    )}

    ${ctaButton("Browse classes", `${BRAND.appUrl}/classes/children`)}

    ${divider()}

    ${paragraph(
      `Weren&#39;t expecting this, or want to rejoin the same class? Just reply to this email or contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll help.`,
      { muted: true, small: true, align: "center" },
    )}
    ${paragraph("With love,<br />The Dance Exclusive team", {
      muted: true,
      small: true,
      align: "center",
    })}
  `;

  return {
    subject: `${studentFirst ? `${studentFirst}'s` : "Your"} membership has ended — ${data.className}`,
    html: renderLayout({
      title: "Your membership has ended",
      preheader: `The ${data.className} membership has ended — you're welcome back any time.`,
      body,
      icon: "heart",
    }),
  };
}
