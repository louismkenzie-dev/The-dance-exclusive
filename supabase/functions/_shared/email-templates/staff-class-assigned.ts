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
  const time = data.startTime
    ? `${data.startTime.slice(0, 5)}${data.endTime ? ` &ndash; ${data.endTime.slice(0, 5)}` : ""}`
    : null;
  const venue = data.venueName
    ? `${data.venueName}${data.venueCity ? `, ${data.venueCity}` : ""}`
    : null;
  const roleLabel = data.instructorRole === "main" ? "Main instructor" : "Assistant";

  const body = `
    ${heading("You&#39;re on the team sheet!", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, you&#39;ve been assigned to teach <strong>${escapeHtml(data.className)}</strong> at The Dance Exclusive.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">${escapeHtml(data.className)}</div>
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
      `Questions about this assignment? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blueDeep};text-decoration:none;">${BRAND.supportEmail}</a>.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `You've been assigned to ${data.className}`,
    html: renderLayout({
      title: "Class assignment",
      preheader: `You've been assigned to ${data.className}${day ? ` on ${capitalise(data.dayOfWeek!)}s` : ""}.`,
      body,
    }),
  };
}
