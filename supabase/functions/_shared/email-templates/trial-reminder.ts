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
  /**
   * The dancer is the account holder (students.is_self), so the reader and the
   * student are the same person. Optional: inferred from the names when the
   * caller doesn't say.
   */
  isSelf?: boolean | null;
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
  const greetingName = data.parentName?.trim().split(/\s+/)[0] || "there";
  // An adult booking themselves comes through with their own name as the
  // student, so talking about "Vicki Woods's trial" would address the reader
  // in the third person.
  const isSelf = data.isSelf ??
    (data.classType === "adult" &&
      Boolean(data.studentName) &&
      data.studentName!.trim().toLowerCase() === data.parentName?.trim().toLowerCase());
  const who = data.studentName && !isSelf ? `${escapeHtml(data.studentName)}'s` : "your";
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
       ${data.studentName && !isSelf ? detailRow("Dancer", escapeHtml(data.studentName)) : ""}`,
    )}

    ${data.customMessage ? paragraph(escapeHtml(data.customMessage).replace(/\n/g, "<br />")) : ""}

    ${ctaButton("View my bookings", `${BRAND.appUrl}/account/bookings`)}

    ${divider()}

    ${paragraph(
      `Can't make it after all? Just reply to this email or contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> and we'll sort another date.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `Reminder: ${data.studentName && !isSelf ? `${data.studentName}'s` : "your"} trial is tomorrow — ${data.className}`,
    html: renderLayout({
      title: "Trial reminder",
      preheader: `${data.className} is tomorrow${time ? ` at ${prettyTime(data.startTime)}` : ""} — see you there!`,
      body,
      hero,
      icon: "bell",
    }),
  };
}
