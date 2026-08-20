import {
  BRAND,
  escapeHtml,
  FONT_BODY,
  heading,
  panel,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface BirthdayData {
  /** The birthday dancer's name (preferred name where set). */
  childName: string;
  /** Parent's name — greeting line for child birthdays. */
  parentName?: string | null;
  /** Age they turn today; omitted if unknown. */
  age?: number | null;
  /** "child" (default): sent to the parent. "adult": sent to the dancer. */
  audience?: "child" | "adult" | null;
  /** Adult-only extra: a note about the birthday-week free class perk. */
  freeClassNote?: string | null;
}

/** Automated birthday wishes, sent the morning of the dancer's birthday. */
export function renderBirthday(data: BirthdayData) {
  const name = escapeHtml(data.childName);
  const isAdult = data.audience === "adult";
  const turning = data.age != null && data.age > 0 ? ` — ${data.age} today!` : "";

  const intro = isAdult
    ? paragraph(
      `It's your birthday${turning ? escapeHtml(turning) : ""} 🎂 Everyone at <strong>The Dance Exclusive</strong> is sending you the biggest birthday wishes.`,
      { muted: true, align: "center" },
    )
    : paragraph(
      `Hi ${escapeHtml(data.parentName?.split(" ")[0] || "there")}, everyone at <strong>The Dance Exclusive</strong> is sending ${name} the biggest birthday wishes today${escapeHtml(turning)} 🎂`,
      { muted: true, align: "center" },
    );

  const body = `
    ${heading(`Happy birthday, ${name}! 🎉`, { align: "center" })}
    ${intro}

    ${panel(
      `<p style="margin:0;font-family:${FONT_BODY};font-size:16px;line-height:26px;color:${BRAND.ink};text-align:center;">
        Have the best day${isAdult ? "" : `, ${name}`} — big moves, big cake, big celebrations.
        We can&#39;t wait to celebrate with you in class! 💃🕺
      </p>`,
      { accent: "magenta" },
    )}

    ${data.freeClassNote ? panel(
      `<p style="margin:0;font-family:${FONT_BODY};font-size:14px;line-height:22px;color:${BRAND.ink};text-align:center;">${escapeHtml(data.freeClassNote)}</p>`,
      { accent: "blue" },
    ) : ""}

    ${paragraph("With love,<br />Amie &amp; The Dance Exclusive crew xx", {
      muted: true,
      small: true,
      align: "center",
    })}
  `;

  return {
    subject: `Happy birthday, ${data.childName}! 🎂`,
    html: renderLayout({
      title: "Happy birthday!",
      preheader: `Birthday wishes for ${data.childName} from The Dance Exclusive.`,
      body,
    }),
  };
}
