import {
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

export interface InternalNoticeData {
  /** "Duplicate membership found" */
  title: string;
  /** One or two sentences: what happened and what, if anything, to do. */
  intro: string;
  /** Label/value pairs shown in a panel. */
  rows?: { label: string; value: string }[];
  /** Optional second panel — e.g. the dancers or items involved. */
  listTitle?: string | null;
  list?: string[];
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  /** Prefix the subject with URGENT and use the alert accent. */
  urgent?: boolean;
}

/**
 * An operational notice to the studio from the booking system — something
 * the automation did or found that a person should know about.
 */
export function renderInternalNotice(data: InternalNoticeData) {
  const rows = (data.rows ?? []).map((r) => detailRow(escapeHtml(r.label), escapeHtml(r.value))).join("");
  const list = (data.list ?? []).map((line) => paragraph(escapeHtml(line))).join("");

  const body = `
    ${kicker(data.urgent ? "Urgent system notice" : "System notice", { align: "center" })}
    ${heading(escapeHtml(data.title), { align: "center" })}
    ${paragraph(escapeHtml(data.intro), { muted: true, align: "center" })}

    ${rows ? panel(rows, { accent: data.urgent ? "magenta" : "blue" }) : ""}
    ${list ? panel(`${data.listTitle ? panelTitle(escapeHtml(data.listTitle)) : ""}${list}`) : ""}

    ${data.ctaLabel && data.ctaUrl ? ctaButton(escapeHtml(data.ctaLabel), data.ctaUrl) : ""}

    ${divider()}

    ${paragraph("Sent automatically by the booking system.", { muted: true, small: true, align: "center" })}
  `;

  return {
    subject: `${data.urgent ? "URGENT: " : ""}${data.title}`,
    html: renderLayout({
      title: data.title,
      preheader: data.intro,
      body,
      icon: data.urgent ? "alert-circle" : "shield-check",
    }),
  };
}
