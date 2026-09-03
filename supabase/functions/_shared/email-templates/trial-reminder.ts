import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  heading,
  HERO,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface TrialReminderData {
  parentName?: string | null;
  studentName?: string | null;
  className: string;
  sessionDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  /** Picks the photo: kids under blue light, or the adult heels silhouette. */
  classType?: "children" | "adult" | null;
  /** Studio-written note (app_settings: trial_reminder_message) — shown verbatim. */
  customMessage?: string | null;
}

const prettyDate = (iso: string) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
};

const prettyTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

/** Day-before reminder for a booked trial session. */
export function renderTrialReminder(data: TrialReminderData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const who = data.studentName ? `${escapeHtml(data.studentName)}'s` : "your";
  const time = [prettyTime(data.startTime), prettyTime(data.endTime)].filter(Boolean).join(" – ");
  const hero = data.classType === "adult"
    ? { url: HERO.adults, alt: "Dancer in heels under stage lights" }
    : { url: HERO.kids, alt: "Young dancers mid-move under blue stage lights" };

  const body = `
    ${kicker("Trial reminder", { align: "center" })}
    ${heading("See you tomorrow!", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, just a quick reminder that ${who} trial class is <strong style="color:${BRAND.ink};">tomorrow</strong> — we can't wait to see you there.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${detailRow("Date", escapeHtml(prettyDate(data.sessionDate)))}
       ${time ? detailRow("Time", escapeHtml(time)) : ""}
       ${data.venueName ? detailRow("Venue", escapeHtml(data.venueName)) : ""}
       ${data.studentName ? detailRow("Dancer", escapeHtml(data.studentName)) : ""}`,
      { accent: "magenta" },
    )}

    ${data.customMessage ? paragraph(escapeHtml(data.customMessage).replace(/\n/g, "<br />")) : ""}

    ${ctaButton("View My Bookings", `${BRAND.appUrl}/account/bookings`, "magenta")}

    ${divider()}

    ${paragraph(
      `Can't make it after all? Just reply to this email or contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blueDeep};text-decoration:none;">${BRAND.supportEmail}</a> and we'll sort another date.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `Reminder: ${data.studentName ? `${data.studentName}'s` : "your"} trial is tomorrow — ${data.className}`,
    html: renderLayout({
      title: "Trial reminder",
      preheader: `${data.className} is tomorrow${time ? ` at ${prettyTime(data.startTime)}` : ""} — see you there!`,
      body,
      hero,
    }),
  };
}
