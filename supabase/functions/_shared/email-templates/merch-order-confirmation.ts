import {
  BRAND,
  detailRow,
  divider,
  escapeHtml,
  heading,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
  secondaryLink,
} from "./layout.ts";

export interface MerchOrderLineData {
  productName: string;
  size?: string | null;
  quantity: number;
  /** "Evie", or the buyer's own name when they bought for themselves. */
  attendeeName?: string | null;
  /** Already formatted, e.g. "Sleeve: Evie". */
  personalisation?: string | null;
}

export interface MerchOrderConfirmationData {
  parentName?: string | null;
  orderNumber: number | string;
  lines: MerchOrderLineData[];
  totalPence: number;
}

const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/** Group by who it is for — that is how a parent reads it back. */
function groupByAttendee(lines: MerchOrderLineData[]): Map<string, MerchOrderLineData[]> {
  const out = new Map<string, MerchOrderLineData[]>();
  for (const l of lines) {
    const who = (l.attendeeName ?? "").trim() || "Your order";
    const list = out.get(who);
    if (list) list.push(l);
    else out.set(who, [l]);
  }
  return out;
}

/** Sent the moment a merchandise payment lands. */
export function renderMerchOrderConfirmation(data: MerchOrderConfirmationData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const grouped = groupByAttendee(data.lines ?? []);
  const firstName = [...grouped.keys()][0] ?? "your dancer";

  const panels = [...grouped.entries()]
    .map(([who, lines]) =>
      panel(
        `${panelTitle(escapeHtml(who))}
         ${lines
           .map((l) =>
             detailRow(
               `${escapeHtml(l.productName)}${l.size ? ` · ${escapeHtml(l.size)}` : ""}`,
               `${l.quantity > 1 ? `×${l.quantity}` : "1"}${
                 l.personalisation ? ` · ${escapeHtml(l.personalisation)}` : ""
               }`,
               // null, not undefined: undefined makes detailRow guess an icon from the label, and
               // a garment name matches nothing, so every line would get a meaningless sparkle.
               null,
             ),
           )
           .join("")}`,
        { accent: "blue" },
      ),
    )
    .join("");

  const body = `
    ${kicker(`Order #${escapeHtml(String(data.orderNumber))}`, { align: "center", color: "magenta" })}
    ${heading("Thanks — that's all booked in", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, we've got your order and it's going on the next print run.`,
      { muted: true, align: "center" },
    )}

    ${panels}

    ${panel(
      `${panelTitle("Total paid")}
       ${detailRow("Amount", money(data.totalPence))}`,
    )}

    ${paragraph(
      // The load-bearing sentence. Nothing is posted, so say so before anyone waits in for a parcel.
      `<strong style="color:${BRAND.ink};">There's nothing to post.</strong> We print everything for the studio, and it comes to ${escapeHtml(
        firstName,
      )}'s next class once it's ready. We'll email you the moment it is, and tell you which class to collect from.`,
      { align: "center" },
    )}

    ${divider()}

    ${paragraph(
      `Everything is made to order, so we can't refund once it's printed — but if we ever can't produce something you've paid for, we'll refund it straight away. Any questions, just reply to this email.`,
      { muted: true, small: true, align: "center" },
    )}
    ${secondaryLink("See your orders", `${BRAND.appUrl}/my-bookings`)}
  `;

  return {
    subject: `Order #${data.orderNumber} confirmed — The Dance Exclusive`,
    html: renderLayout({
      title: "Order confirmed",
      preheader: `We've got your order. It'll come to class once it's printed.`,
      body,
      icon: "check-circle",
    }),
  };
}
