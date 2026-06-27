// Shared HTML layout for all transactional emails.
// Brand: The Dance Exclusive — dark urban, electric blue accent.

export const BRAND = {
  name: "The Dance Exclusive",
  primary: "#5ab3e8", // electric blue (matches --primary)
  primaryDark: "#3a8fc4",
  bg: "#0a0d12", // page bg
  cardBg: "#11151c",
  border: "#2a2f3a",
  text: "#fafafa",
  textMuted: "#8a8f9b",
  accent: "#ec1f7d", // hot pink (adult)
  success: "#1fb872",
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
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <title>${escapeHtml(title)}</title>
    <style>
      @media (max-width: 600px) {
        .container { width: 100% !important; padding: 16px !important; }
        .card { padding: 24px !important; }
        h1 { font-size: 24px !important; line-height: 30px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};-webkit-font-smoothing:antialiased;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>` : ""}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="container" style="width:600px;max-width:600px;">
            <!-- Header / wordmark -->
            <tr>
              <td align="center" style="padding:8px 0 28px 0;">
                <div style="font-family:'Oswald','Segoe UI',sans-serif;font-weight:700;font-size:22px;letter-spacing:4px;color:${BRAND.text};text-transform:uppercase;">
                  THE DANCE <span style="color:${BRAND.primary};">EXCLUSIVE</span>
                </div>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td class="card" style="background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:14px;padding:40px;">
                ${body}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:28px 16px 8px 16px;color:${BRAND.textMuted};font-size:12px;line-height:18px;">
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

export function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0;">
    <tr>
      <td style="border-radius:8px;background:${BRAND.primary};">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-weight:700;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.bg};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export function divider(): string {
  return `<div style="height:1px;background:${BRAND.border};margin:24px 0;"></div>`;
}
