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

export interface TrialFollowUpData {
  parentName?: string | null;
  studentName?: string | null;
  className: string;
  sessionDate: string; // YYYY-MM-DD
  venueName?: string | null;
  classType?: "children" | "adult" | null;
  /** The dancer is the account holder, so "your" not "Maia's". */
  isSelf?: boolean | null;
  /** Where to book a place — the class's own page in the app. */
  bookUrl: string;
  /** Studio-written note (app_settings: trial_follow_up_message) — shown verbatim. */
  customMessage?: string | null;
}

const prettyDate = (iso: string) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  } catch {
    return iso;
  }
};

const londonToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** "today" when the class was today, else "on Sunday" — a follow-up that was
 *  missed and caught up later must not claim the class was today. */
const whenWord = (iso: string) => {
  if (iso === londonToday()) return "today";
  try {
    return `on ${new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long" })}`;
  } catch {
    return "recently";
  }
};

/**
 * Sent the moment a trialled class finishes: thanks for coming, here's how
 * to keep the place. The one email that turns a trial into a booking, so it
 * lands while the class is still the thing they're talking about.
 */
export function renderTrialFollowUp(data: TrialFollowUpData) {
  const greetingName = data.parentName?.trim().split(/\s+/)[0] || "there";
  const isSelf = data.isSelf ??
    (data.classType === "adult" &&
      Boolean(data.studentName) &&
      data.studentName!.trim().toLowerCase() === data.parentName?.trim().toLowerCase());
  // Two children trialling together arrive as "Ava Smith & Isla Smith" —
  // one email, so the wording has to carry both of them.
  const firsts = (data.studentName ?? "")
    .split(/\s*(?:,|&)\s*/)
    .map((n) => n.trim().split(/\s+/)[0])
    .filter(Boolean);
  const multi = firsts.length > 1;
  const first = multi ? `${firsts.slice(0, -1).join(", ")} & ${firsts[firsts.length - 1]}` : (firsts[0] ?? "");
  const who = first && !isSelf ? escapeHtml(first) : "you";
  // Plain-text form for the subject line; the HTML-escaped one for the body.
  const whoseText = multi ? "their" : first && !isSelf ? `${first}'s` : "your";
  const whose = multi ? "their" : first && !isSelf ? `${escapeHtml(first)}'s` : "your";
  const place = multi ? "places" : "place";
  const theyLoved = multi ? "they loved" : first && !isSelf ? `${escapeHtml(first)} loved` : "you loved";
  const onRegister = who === "you" ? "you're" : multi ? "they're" : `${who} is`;
  const hero = data.classType === "adult"
    ? { url: HERO.adults, alt: "Dancer in heels under stage lights" }
    : { url: HERO.kids, alt: "Young dancers mid-move under blue stage lights" };
  const when = whenWord(data.sessionDate);
  const cameAlong = who === "you"
    ? `thank you for coming along${data.venueName ? ` to ${escapeHtml(data.venueName)}` : ""} ${when}`
    : `thank you for bringing ${who} along${data.venueName ? ` to ${escapeHtml(data.venueName)}` : ""} ${when}`;

  const body = `
    ${kicker("Thanks for coming", { align: "center" })}
    ${heading(`How was ${escapeHtml(data.className)}?`, { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, ${cameAlong} — we hope ${theyLoved} it. If ${first && !isSelf ? "they'd" : "you'd"} like to carry on, ${whose} ${place} ${multi ? "are" : "is"} a couple of taps away.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${detailRow("Trial", escapeHtml(prettyDate(data.sessionDate)))}
       ${data.venueName ? detailRow("Venue", escapeHtml(data.venueName)) : ""}
       ${data.studentName && !isSelf ? detailRow(multi ? "Dancers" : "Dancer", escapeHtml(data.studentName)) : ""}`,
      { accent: "blue" },
    )}

    ${paragraph(
      `Pick the plan that suits you on the class page and ${onRegister} on the register for next week — spaces are limited, so it's worth doing while it's fresh.`,
    )}

    ${data.customMessage ? paragraph(escapeHtml(data.customMessage).replace(/\n/g, "<br />")) : ""}

    ${ctaButton(`Book ${whose} ${place}`, data.bookUrl)}

    ${divider()}

    ${paragraph(
      `Not sure yet, or have a question? Just reply to this email or contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> — we're always happy to help.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `How was ${data.className}? Book ${whoseText} ${place}`,
    html: renderLayout({
      title: "Thanks for coming",
      preheader: `Thanks for coming to ${data.className} ${when} — here's how to keep ${whoseText} ${place}.`,
      body,
      hero,
      icon: "sparkles",
    }),
  };
}
