import {
  BRAND,
  detailRow,
  escapeHtml,
  heading,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface MerchPrintRunAggregateRow {
  product: string;
  size: string;
  quantity: number;
}

export interface MerchPrintRunData {
  /** "Laurence" — the covering note is to a person, not a company. */
  contactName?: string | null;
  runNumber: number | string;
  /** Product + size totals. The detail is in the attached CSV. */
  aggregate: MerchPrintRunAggregateRow[];
  totalGarments: number;
  personalisedCount: number;
  attachmentName: string;
}

/**
 * The covering note that goes with the print run CSV.
 *
 * Written for a printer, not a customer: no marketing voice, no hero image, no call to action.
 * The totals are here so the run can be sanity-checked at a glance; the per-garment detail,
 * including every name to be printed, is in the attachment.
 */
export function renderMerchPrintRun(data: MerchPrintRunData) {
  const greeting = data.contactName?.split(" ")[0] || "there";
  const rows = (data.aggregate ?? [])
    .map((r) =>
      detailRow(
        `${escapeHtml(r.product)}${r.size ? ` · ${escapeHtml(r.size)}` : ""}`,
        `×${r.quantity}`,
        null,
      ),
    )
    .join("");

  const body = `
    ${kicker(`Print run #${escapeHtml(String(data.runNumber))}`, { align: "center" })}
    ${heading("New print run", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greeting)}, here's the next batch for The Dance Exclusive — ${
        data.totalGarments
      } garment${data.totalGarments === 1 ? "" : "s"} in total${
        data.personalisedCount > 0
          ? `, ${data.personalisedCount} of which ${
              data.personalisedCount === 1 ? "needs a name" : "need names"
            } printing`
          : ""
      }.`,
      { muted: true, align: "center" },
    )}

    ${panel(`${panelTitle("Totals")}${rows}`, { accent: "blue" })}

    ${paragraph(
      `The full breakdown is attached as <strong style="color:${BRAND.ink};">${escapeHtml(
        data.attachmentName,
      )}</strong> — one row per garment, with the size and any personalisation against each order.`,
      { align: "center" },
    )}

    ${paragraph(
      `Anything unclear, just reply to this email.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `Print run #${data.runNumber} — ${data.totalGarments} garment${
      data.totalGarments === 1 ? "" : "s"
    } — The Dance Exclusive`,
    html: renderLayout({
      title: `Print run #${data.runNumber}`,
      preheader: `${data.totalGarments} garments for The Dance Exclusive. Full list attached.`,
      body,
      icon: "mail",
    }),
  };
}
