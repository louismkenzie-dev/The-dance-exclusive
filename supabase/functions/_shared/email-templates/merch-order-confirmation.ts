import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  FONT_BODY,
  heading,
  panel,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface MerchOrderItem {
  productName: string;
  size?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface MerchOrderConfirmationData {
  customerName?: string | null;
  orderReference: string;
  items: MerchOrderItem[];
  totalAmount: number;
}

/** Receipt for a uniform / merchandise order, with what to expect next. */
export function renderMerchOrderConfirmation(data: MerchOrderConfirmationData) {
  const greetingName = data.customerName?.split(" ")[0] || "there";

  const itemsHtml = data.items
    .map((i) =>
      panel(
        `<div style="font-family:${FONT_BODY};font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">${escapeHtml(i.productName)}</div>
         ${i.size ? detailRow("Size", escapeHtml(i.size)) : ""}
         ${detailRow("Quantity", String(i.quantity))}
         ${detailRow("Price", `&pound;${(Number(i.unitPrice) * Number(i.quantity)).toFixed(2)}`)}`,
        { accent: "blue" },
      )
    )
    .join("");

  const body = `
    ${heading("Order confirmed", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, thanks for your order with <strong>The Dance Exclusive</strong>. Here&#39;s what you&#39;ve bought.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${BRAND.inkMuted};text-align:center;">Total paid</div>
       <div style="font-family:${FONT_BODY};font-size:32px;line-height:40px;font-weight:800;color:${BRAND.ink};text-align:center;margin-top:4px;">&pound;${Number(data.totalAmount).toFixed(2)}</div>
       <div style="font-family:monospace;font-size:11px;letter-spacing:1.5px;color:${BRAND.inkMuted};text-align:center;margin-top:8px;">ORDER: ${escapeHtml(data.orderReference.slice(-8).toUpperCase())}</div>`,
    )}

    ${heading(`Your order (${data.items.length})`, { level: 2 })}
    ${itemsHtml}

    ${divider()}

    ${paragraph(
      "We&#39;ll let you know as soon as your order is ready to collect at class.",
      { muted: true, align: "center" },
    )}

    ${ctaButton("Back to the shop", `${BRAND.appUrl}/shop`)}
  `;

  return {
    subject: `Order confirmed — The Dance Exclusive`,
    html: renderLayout({
      title: "Order confirmed",
      preheader: "Thanks for your order with The Dance Exclusive.",
      body,
    }),
  };
}
