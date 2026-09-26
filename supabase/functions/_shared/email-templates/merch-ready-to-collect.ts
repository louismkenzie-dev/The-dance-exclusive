import {
  BRAND,
  detailRow,
  divider,
  escapeHtml,
  formatTime,
  heading,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface MerchReadyLineData {
  productName: string;
  size?: string | null;
  quantity: number;
  personalisation?: string | null;
}

export interface MerchReadyToCollectData {
  parentName?: string | null;
  orderNumber: number | string;
  /** Who it is for — the dancer whose class it will come to. */
  attendeeName?: string | null;
  lines: MerchReadyLineData[];
  /** The dancer's next session, when we can work one out. All optional. */
  nextSessionDate?: string | null;
  nextSessionTime?: string | null;
  nextClassName?: string | null;
  nextVenueName?: string | null;
}

const prettyDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
};

/** Sent when a print run comes back and the order is ready to hand over. */
export function renderMerchReadyToCollect(data: MerchReadyToCollectData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const who = (data.attendeeName ?? "").trim();
  const date = prettyDate(data.nextSessionDate);
  const time = formatTime(data.nextSessionTime);

  // We only promise a specific class when we actually know one. A dancer with no upcoming booking
  // would otherwise be told to collect at a class that does not exist.
  const whenBlock = date
    ? panel(
        `${panelTitle("Collect at")}
         ${detailRow("When", escapeHtml([date, time].filter(Boolean).join(" · ")), "calendar")}
         ${data.nextClassName ? detailRow("Class", escapeHtml(data.nextClassName), "users") : ""}
         ${data.nextVenueName ? detailRow("Where", escapeHtml(data.nextVenueName), "map-pin") : ""}`,
        { accent: "magenta" },
      )
    : paragraph(
        `We'll hand it over at ${
          who ? `${escapeHtml(who)}'s` : "your"
        } next class. If you're not booked into anything at the moment, just let us know and we'll sort something out.`,
        { align: "center" },
      );

  const body = `
    ${kicker(`Order #${escapeHtml(String(data.orderNumber))}`, { align: "center", color: "magenta" })}
    ${heading("It's printed and ready", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, good news — ${
        who ? `${escapeHtml(who)}'s` : "your"
      } order is back from the printers and ready to collect.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(who ? escapeHtml(who) : "Your order")}
       ${(data.lines ?? [])
         .map((l) =>
           detailRow(
             `${escapeHtml(l.productName)}${l.size ? ` · ${escapeHtml(l.size)}` : ""}`,
             `${l.quantity > 1 ? `×${l.quantity}` : "1"}${
               l.personalisation ? ` · ${escapeHtml(l.personalisation)}` : ""
             }`,
             null,
           ),
         )
         .join("")}`,
      { accent: "blue" },
    )}

    ${whenBlock}

    ${paragraph(
      `Your teacher will have it with them, so there's nothing you need to do — just say hello at the door.`,
      { muted: true, align: "center" },
    )}

    ${divider()}

    ${paragraph(
      `Any questions, reply to this email or speak to us at class.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `${who ? `${who}'s order` : `Order #${data.orderNumber}`} is ready to collect`,
    html: renderLayout({
      title: "Ready to collect",
      preheader: date
        ? `Printed and ready — collect at ${date}.`
        : `Printed and ready — we'll bring it to your next class.`,
      body,
      icon: "sparkles",
    }),
  };
}
