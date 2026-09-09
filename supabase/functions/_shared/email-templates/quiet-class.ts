import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  FONT_BODY,
  formatTime,
  formatTimeRange,
  heading,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface QuietClassData {
  className: string;
  /** YYYY-MM-DD */
  sessionDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  instructorNames?: string[];
  /** Everyone booked on this date, however few. */
  booked: { name: string; detail?: string | null }[];
  /** Fewer than this and the class counts as quiet. */
  threshold: number;
  /** How far ahead the notice was sent, in hours. */
  hoursAhead: number;
  /** The session's own admin page — cancel, move, add, all in one place. */
  sessionUrl: string;
}

const prettyDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
};

/**
 * Sent to the studio a few hours before an adult class that has fewer
 * people booked on than it needs. Early enough to rally a few more or call
 * it off, with the one link that does either.
 */
export function renderQuietClass(data: QuietClassData) {
  const n = data.booked.length;
  const count = n === 0 ? "Nobody booked" : n === 1 ? "Only 1 booked" : `Only ${n} booked`;
  const time = formatTimeRange(data.startTime, data.endTime);
  const startLabel = formatTime(data.startTime);

  const rows = data.booked
    .map(
      (b) =>
        `<tr><td style="padding:8px 0;border-top:1px solid ${BRAND.panelBorder};font-family:${FONT_BODY};font-size:15px;line-height:22px;color:${BRAND.ink};font-weight:600;">${escapeHtml(b.name)}</td>` +
        `<td align="right" style="padding:8px 0;border-top:1px solid ${BRAND.panelBorder};font-family:${FONT_BODY};font-size:13px;line-height:22px;color:${BRAND.inkMuted};">${b.detail ? escapeHtml(b.detail) : ""}</td></tr>`,
    )
    .join("");

  const body = `
    ${kicker("Quiet class", { align: "center" })}
    ${heading(`${count} for ${escapeHtml(data.className)}`, { align: "center" })}
    ${paragraph(
      `<strong style="color:${BRAND.ink};">${escapeHtml(data.className)}</strong> starts in about ${data.hoursAhead} hour${data.hoursAhead === 1 ? "" : "s"} with fewer than ${data.threshold} booked on. ${
        n === 0
          ? "Time to give it a push, or call it off — nobody is booked, so there is no one to tell."
          : `Time to give it a push, or call it off and let the ${n === 1 ? "one person" : "people"} booked know.`
      }`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${detailRow("Date", escapeHtml(prettyDate(data.sessionDate)))}
       ${time ? detailRow("Time", escapeHtml(time)) : ""}
       ${data.venueName ? detailRow("Venue", escapeHtml(data.venueName)) : ""}
       ${data.instructorNames?.length ? detailRow(data.instructorNames.length === 1 ? "Teacher" : "Teachers", escapeHtml(data.instructorNames.join(", "))) : ""}
       ${detailRow("Booked on", escapeHtml(String(n)))}`,
      { accent: "magenta" },
    )}

    ${n > 0
      ? panel(
        `${panelTitle("Who's booked")}
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`,
      )
      : ""}

    ${ctaButton("Open the class", data.sessionUrl)}

    ${divider()}

    ${paragraph(
      `Sent automatically about ${data.hoursAhead} hours before an adult class with fewer than ${data.threshold} booked. One of these per class at most; children&#39;s classes run whatever the numbers.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `${count}: ${data.className}${startLabel ? `, ${startLabel}` : ""} — push it or call it off?`,
    html: renderLayout({
      title: `${count} for ${data.className}`,
      preheader: `${data.className}${time ? ` · ${time}` : ""}${data.venueName ? ` · ${data.venueName}` : ""} — fewer than ${data.threshold} booked on.`,
      body,
      icon: "alert-circle",
    }),
  };
}
