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

export interface StaffClassAssignedData {
  staffName?: string | null;
  className: string;
  dayOfWeek?: string | null;
  startTime?: string | null; // "HH:MM:SS"
  endTime?: string | null;
  venueName?: string | null;
  venueCity?: string | null;
  /** "main" | "assistant" */
  instructorRole?: string | null;
  /** Link to the staff portal registers — only when they have a portal account. */
  portalLink?: string | null;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function renderStaffClassAssigned(data: StaffClassAssignedData) {
  const greetingName = data.staffName?.split(" ")[0] || "there";
  const day = data.dayOfWeek ? `${capitalise(data.dayOfWeek)}s` : null;
  // Escape the parts, not the en-dash entity that joins them.
  const time = data.startTime
    ? `${escapeHtml(data.startTime.slice(0, 5))}${data.endTime ? ` &ndash; ${escapeHtml(data.endTime.slice(0, 5))}` : ""}`
    : null;
  const venue = data.venueName
    ? `${data.venueName}${data.venueCity ? `, ${data.venueCity}` : ""}`
    : null;
  const isMain = data.instructorRole === "main";
  const roleLabel = isMain ? "Main instructor" : "Assistant";
  // An assistant isn't "assigned to teach" — the panel below would contradict it.
  const verb = isMain ? "teach" : "assist with";

  const body = `
    ${kicker("Class assignment", { align: "center" })}
    ${heading("You&#39;re on the team sheet!", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, you&#39;ve been assigned to ${verb} <strong style="color:${BRAND.ink};">${escapeHtml(data.className)}</strong> at The Dance Exclusive.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${detailRow("Your role", escapeHtml(roleLabel))}
       ${day ? detailRow("Day", escapeHtml(day)) : ""}
       ${time ? detailRow("Time", time) : ""}
       ${venue ? detailRow("Venue", escapeHtml(venue)) : ""}`,
      { accent: "blue" },
    )}

    ${data.portalLink
      ? `${paragraph(
          `Your class register is ready in the staff portal &mdash; you&#39;ll see the students booked into this class, check them in and out, and scan entrance QR codes on the day.`,
        )}
         ${ctaButton("View class registers", data.portalLink)}`
      : paragraph(
          `Once your staff portal account is set up you&#39;ll be able to view this class&#39;s register, check students in and out, and scan entrance QR codes. Look out for your portal invite email, or ask the office to send one.`,
        )}

    ${divider()}

    ${paragraph(
      `Questions about this assignment? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a>.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `You've been assigned to ${data.className}`,
    html: renderLayout({
      title: "Class assignment",
      preheader: `You've been assigned to ${data.className}${day ? ` on ${capitalise(data.dayOfWeek!)}s` : ""}.`,
      body,
      icon: "calendar-check",
    }),
  };
}
