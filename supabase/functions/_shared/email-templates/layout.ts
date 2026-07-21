// Shared HTML layout for all transactional emails.
// Brand: The Dance Exclusive — "Studio Light": paper background, white card,
// ink-navy text, solid blue pill button. Inline CSS only, table-based structure.

export const FONT_STACK =
  "'Plus Jakarta Sans', -apple-system, 'Segoe UI', sans-serif";

export const BRAND = {
  name: "The Dance Exclusive",
  primary: "#1779B8", // logo blue (solid CTA)
  primaryDark: "#12649A",
  primaryTint: "#E8F2F9", // quiet blue tint (badges, icon tiles)
  bg: "#F4F5F7", // paper page background
  cardBg: "#FFFFFF",
  panelBg: "#F4F5F7", // paper tint panels inside the card
  border: "#E9ECF1",
  text: "#16202E", // ink navy
  textMuted: "#5D6B7E",
  accent: "#D6146C", // hot magenta (adult)
  accentTint: "#FCE9F3",
  success: "#178A55",
  successTint: "#E7F5EE",
  appUrl: "https://app.thedanceexclusive.co.uk",
  supportEmail: "hello@thedanceexclusive.co.uk",
};

interface LayoutOpts {
  title: string;
  preheader?: string;
  body: string;
}

export function renderLayout({ title, preheader, body }: LayoutOpts): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(title)}</title>
    <style>
      @media (max-width: 600px) {
        .container { width: 100% !important; padding: 16px !important; }
        .card { padding: 28px 24px !important; border-radius: 20px !important; }
        h1 { font-size: 24px !important; line-height: 30px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:${FONT_STACK};color:${BRAND.text};-webkit-font-smoothing:antialiased;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>` : ""}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="container" style="width:600px;max-width:600px;">
            <!-- Header / wordmark -->
            <tr>
              <td align="center" style="padding:8px 0 28px 0;">
                <div style="font-family:${FONT_STACK};font-weight:800;font-size:20px;letter-spacing:-0.3px;color:${BRAND.text};">
                  The Dance <span style="color:${BRAND.primary};">Exclusive</span>
                </div>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td class="card" style="background:${BRAND.cardBg};border-radius:24px;padding:40px;box-shadow:0 1px 2px rgba(16,24,40,0.04), 0 12px 32px rgba(16,24,40,0.06);">
                ${body}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:28px 16px 8px 16px;color:${BRAND.textMuted};font-size:12px;line-height:18px;font-family:${FONT_STACK};">
                <div style="margin-bottom:6px;font-weight:600;color:${BRAND.textMuted};">
                  ${BRAND.name} — dance school for children &amp; adults
                </div>
                <div style="margin-bottom:6px;">
                  Questions? Email us at
                  <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primary};text-decoration:none;">${BRAND.supportEmail}</a>
                </div>
                <div>© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Solid blue pill button, sentence-case label.
export function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0;">
    <tr>
      <td style="border-radius:999px;background:${BRAND.primary};">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 32px;font-family:${FONT_STACK};font-weight:700;font-size:15px;color:#FFFFFF;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export function divider(): string {
  return `<div style="height:1px;background:${BRAND.border};margin:24px 0;"></div>`;
}

// Tiny uppercase eyebrow label — the ONLY uppercase allowed in emails.
export function eyebrow(label: string, color: string = BRAND.textMuted): string {
  return `<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${color};">${escapeHtml(label)}</div>`;
}

// Quiet paper-tint panel inside the white card (no borders — soft fill only).
export function panel(content: string): string {
  return `<div style="padding:18px 20px;background:${BRAND.panelBg};border-radius:16px;">${content}</div>`;
}

// Label/value row for detail panels.
export function detailRow(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.textMuted};">${escapeHtml(label)}</td>
      <td align="right" style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${BRAND.text};">${escapeHtml(value)}</td>
    </tr>
  </table>`;
}
