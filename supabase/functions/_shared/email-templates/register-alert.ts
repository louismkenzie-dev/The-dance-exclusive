import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  FONT_BODY,
  heading,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface RegisterAlertData {
  /** Fifteen minutes after the start, or fifteen minutes after the end. */
  kind: "not_marked_present" | "not_departed";
  className: string;
  /** YYYY-MM-DD */
  sessionDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  instructorNames?: string[];
  /** The dancers the register is missing, with a short note each. */
  attendees: { name: string; detail?: string | null }[];
  /** Everyone booked on the session. */
  registerSize?: number | null;
  registerUrl: string;
}

const prettyDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
};
const prettyTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

/**
 * Sent to the studio owner when a register has not been kept up: dancers not
 * marked in or absent fifteen minutes after a class starts, or — urgently —
 * marked in but not out fifteen minutes after it ends.
 */
export function renderRegisterAlert(data: RegisterAlertData) {
  const urgent = data.kind === "not_departed";
  const n = data.attendees.length;
  const who = n === 1 ? "1 dancer" : `${n} dancers`;
  const time = [prettyTime(data.startTime), prettyTime(data.endTime)].filter(Boolean).join(" – ");
  const startLabel = prettyTime(data.startTime) ?? "";

  const title = urgent ? `${who} not marked departed` : `${who} not marked in`;
  const explain = urgent
    ? `<strong style="color:${BRAND.ink};">${escapeHtml(data.className)}</strong> finished fifteen minutes ago and these dancers were marked arrived but not departed. Please confirm each of them has been collected and mark them departed on the register.`
    : `<strong style="color:${BRAND.ink};">${escapeHtml(data.className)}</strong> started fifteen minutes ago and these dancers haven&#39;t been marked arrived or absent. Check they&#39;re in the room and mark them in, or mark them absent.`;

  const rows = data.attendees
    .map(
      (a) =>
        `<tr><td style="padding:8px 0;border-top:1px solid ${BRAND.panelBorder};font-family:${FONT_BODY};font-size:15px;line-height:22px;color:${BRAND.ink};font-weight:600;">${escapeHtml(a.name)}</td>` +
        `<td align="right" style="padding:8px 0;border-top:1px solid ${BRAND.panelBorder};font-family:${FONT_BODY};font-size:13px;line-height:22px;color:${BRAND.inkMuted};">${a.detail ? escapeHtml(a.detail) : ""}</td></tr>`,
    )
    .join("");

  const body = `
    ${kicker(urgent ? "Urgent register alert" : "Register alert", { align: "center" })}
    ${heading(title, { align: "center" })}
    ${paragraph(explain, { muted: true, align: "center" })}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${detailRow("Date", escapeHtml(prettyDate(data.sessionDate)))}
       ${time ? detailRow("Time", escapeHtml(time)) : ""}
       ${data.venueName ? detailRow("Venue", escapeHtml(data.venueName)) : ""}
       ${data.instructorNames?.length ? detailRow(data.instructorNames.length === 1 ? "Teacher" : "Teachers", escapeHtml(data.instructorNames.join(", "))) : ""}
       ${data.registerSize != null ? detailRow("On the register", escapeHtml(String(data.registerSize))) : ""}`,
      { accent: urgent ? "magenta" : "blue" },
    )}

    ${panel(
      `${panelTitle(urgent ? "Marked in, not out" : "Not marked")}
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`,
    )}

    ${ctaButton("Open the register", data.registerUrl)}

    ${divider()}

    ${paragraph(
      `Sent automatically ${urgent ? "fifteen minutes after the class finished" : "fifteen minutes after the class started"}. You&#39;ll get one of these per class at most.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: urgent
      ? `URGENT: ${who} not marked departed — ${data.className}${startLabel ? `, ${startLabel}` : ""}`
      : `Register check: ${who} not marked in — ${data.className}${startLabel ? `, ${startLabel}` : ""}`,
    html: renderLayout({
      title,
      preheader: `${data.className}${time ? ` · ${time}` : ""}${data.venueName ? ` · ${data.venueName}` : ""}`,
      body,
      icon: urgent ? "alert-circle" : "shield-check",
    }),
  };
}
