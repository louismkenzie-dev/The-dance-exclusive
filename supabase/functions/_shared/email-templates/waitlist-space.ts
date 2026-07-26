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

export interface WaitlistSpaceData {
  parentName?: string | null;
  className: string;
  dayOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  classType?: "children" | "adult" | null;
}

const prettyTime = (t?: string | null) => (t ? t.slice(0, 5) : null);
const prettyDay = (d?: string | null) =>
  d ? d.charAt(0).toUpperCase() + d.slice(1) : null;

/** Sent when a class the parent is waitlisted for has a place free again. */
export function renderWaitlistSpace(data: WaitlistSpaceData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const time = [prettyTime(data.startTime), prettyTime(data.endTime)].filter(Boolean).join(" – ");
  const browsePath = data.classType === "adult" ? "/classes/adult" : "/classes/children";

  const body = `
    ${heading("A space has opened up!", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, good news — a place is now available in a class you're on the waitlist for. Spaces go quickly, so book soon to secure it.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">${escapeHtml(data.className)}</div>
       ${data.dayOfWeek ? detailRow("Day", escapeHtml(prettyDay(data.dayOfWeek)!)) : ""}
       ${time ? detailRow("Time", escapeHtml(time)) : ""}
       ${data.venueName ? detailRow("Venue", escapeHtml(data.venueName)) : ""}`,
      { accent: "magenta" },
    )}

    ${ctaButton("Book Now", `${BRAND.appUrl}${browsePath}`)}

    ${divider()}

    ${paragraph(
      `Booking is first come, first served — if the class fills up again before you book, you'll stay on the waitlist and we'll let you know next time a space frees up. Questions? Contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blueDeep};text-decoration:none;">${BRAND.supportEmail}</a>.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `A space has opened up in ${data.className}!`,
    html: renderLayout({
      title: "Waitlist update",
      preheader: `A place is free in ${data.className} — book now to secure it.`,
      body,
    }),
  };
}
