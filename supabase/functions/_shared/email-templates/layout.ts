// Shared HTML layout for all transactional emails.
// Brand: The Dance Exclusive — "club look, inbox-safe" hybrid.
//
// Dark navy chrome (header/footer bands + page background) carries the club
// brand; the content area stays WHITE so copy survives Gmail/Outlook dark-mode
// inversions. Table-based, inline CSS only, bulletproof buttons, no external
// images/fonts/scripts — Outlook-safe.
//
// Helper convention: dynamic values must be passed through escapeHtml() by the
// caller; helper `text`/`content` arguments are treated as HTML.

export const BRAND = {
  name: "The Dance Exclusive",
  tagline: "MOVE DIFFERENT",

  // ── Club-look palette ────────────────────────────────────────────
  bg: "#0B0F16", // outer page background — near-black navy
  band: "#101724", // header/footer band navy
  ink: "#16202E", // body copy on white
  inkMuted: "#5B6675", // secondary copy on white
  contentBg: "#FFFFFF", // white content body
  panelBg: "#F4F7FB", // light panel fill
  panelBorder: "#DFE7F0", // panel/detail hairlines
  blue: "#6BC1E8", // logo blue — gradient + accents on dark navy
  blueDeep: "#1779B8", // primary CTA blue (AA on white)
  magenta: "#EE2A7B", // hot magenta — adult CTAs + gradient
  footerText: "#8C95A6", // muted grey on navy

  // ── Legacy aliases (older template code / callers) ───────────────
  primary: "#1779B8",
  primaryDark: "#116094",
  cardBg: "#FFFFFF",
  border: "#DFE7F0",
  text: "#16202E",
  textMuted: "#5B6675",
  accent: "#EE2A7B",
  success: "#1B9E66",

  appUrl: "https://app.thedanceexclusive.co.uk",
  supportEmail: "hello@thedanceexclusive.co.uk",
};

export const FONT_BODY = "'Inter','Segoe UI',Arial,sans-serif";
export const FONT_DISPLAY = "'Oswald','Arial Narrow','Segoe UI',Arial,sans-serif";

interface LayoutOpts {
  title: string;
  preheader?: string;
  body: string;
}

export function renderLayout({ title, preheader, body }: LayoutOpts): string {
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(title)}</title>
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <style>
      @media (max-width: 620px) {
        .container { width: 100% !important; }
        .card { padding: 28px 20px !important; }
        .band { padding-left: 20px !important; padding-right: 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:${FONT_BODY};-webkit-font-smoothing:antialiased;word-spacing:normal;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${BRAND.bg}" style="background:${BRAND.bg};">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="container" style="width:600px;max-width:600px;">

            <!-- Header band: wordmark on dark navy -->
            <tr>
              <td align="center" bgcolor="${BRAND.band}" class="band" style="background:${BRAND.band};border-radius:14px 14px 0 0;padding:30px 32px 24px 32px;">
                <div style="font-family:${FONT_DISPLAY};font-weight:700;font-size:21px;line-height:28px;letter-spacing:6px;color:#ffffff;text-transform:uppercase;">
                  THE DANCE EXCLUSIVE
                </div>
              </td>
            </tr>

            <!-- Thin gradient rule: logo blue blending into hot magenta -->
            <tr>
              <td style="padding:0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td width="25%" height="3" bgcolor="#6BC1E8" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                    <td width="25%" height="3" bgcolor="#978FC4" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                    <td width="25%" height="3" bgcolor="#C25C9F" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                    <td width="25%" height="3" bgcolor="#EE2A7B" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- White content body -->
            <tr>
              <td bgcolor="${BRAND.contentBg}" class="card" style="background:${BRAND.contentBg};padding:36px 40px;font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:${BRAND.ink};">
                ${body}
              </td>
            </tr>

            <!-- Footer band: dark navy -->
            <tr>
              <td align="center" bgcolor="${BRAND.band}" class="band" style="background:${BRAND.band};border-radius:0 0 14px 14px;padding:28px 32px;">
                <div style="font-family:${FONT_DISPLAY};font-weight:700;font-size:11px;line-height:16px;letter-spacing:5px;color:${BRAND.blue};text-transform:uppercase;margin-bottom:14px;">
                  MOVE DIFFERENT
                </div>
                <div style="font-family:${FONT_BODY};font-size:12px;line-height:19px;color:${BRAND.footerText};margin-bottom:10px;">
                  ${BRAND.name} &middot; Essex, United Kingdom<br />
                  Questions? Email
                  <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a>
                </div>
                <div style="font-family:${FONT_BODY};font-size:11px;line-height:17px;color:${BRAND.footerText};margin-bottom:10px;">
                  You're receiving this service email because of an account, booking or
                  enquiry with ${BRAND.name}. It isn't marketing — but if it reached you
                  in error, just ignore it or let us know and we'll put it right.
                </div>
                <div style="font-family:${FONT_BODY};font-size:11px;line-height:17px;color:${BRAND.footerText};">
                  &copy; ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
                </div>
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

/**
 * Display heading. level 1 = big Oswald-style headline, level 2 = small
 * letter-spaced uppercase section heading. Both bold, uppercase, navy.
 */
export function heading(
  text: string,
  opts: { level?: 1 | 2; align?: "left" | "center" } = {},
): string {
  const align = opts.align ?? "left";
  if (opts.level === 2) {
    return `<div style="margin:28px 0 12px 0;font-family:${FONT_BODY};font-size:12px;line-height:18px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${BRAND.ink};text-align:${align};">${text}</div>`;
  }
  return `<h1 style="margin:0 0 16px 0;font-family:${FONT_DISPLAY};font-size:26px;line-height:32px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.ink};text-align:${align};">${text}</h1>`;
}

/** Body paragraph — 16px/1.6 ink on white; muted/small/center variants. */
export function paragraph(
  html: string,
  opts: { muted?: boolean; small?: boolean; align?: "left" | "center" } = {},
): string {
  const size = opts.small ? "13px" : "16px";
  const lineHeight = opts.small ? "20px" : "26px";
  const color = opts.muted ? BRAND.inkMuted : BRAND.ink;
  return `<p style="margin:0 0 16px 0;font-family:${FONT_BODY};font-size:${size};line-height:${lineHeight};color:${color};text-align:${opts.align ?? "left"};">${html}</p>`;
}

/** Label/value row for booking details, enquiry summaries, etc. */
export function detailRow(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid ${BRAND.panelBorder};font-family:${FONT_BODY};font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.inkMuted};vertical-align:top;white-space:nowrap;">${label}</td>
      <td align="right" style="padding:9px 0 9px 16px;border-bottom:1px solid ${BRAND.panelBorder};font-family:${FONT_BODY};font-size:14px;line-height:20px;font-weight:600;color:${BRAND.ink};vertical-align:top;">${value}</td>
    </tr>
  </table>`;
}

/** Light panel card, optionally with a blue or magenta accent edge. */
export function panel(
  content: string,
  opts: { accent?: "blue" | "magenta" } = {},
): string {
  const accentColor =
    opts.accent === "magenta"
      ? BRAND.magenta
      : opts.accent === "blue"
        ? BRAND.blueDeep
        : null;
  const accentStyle = accentColor ? `border-left:4px solid ${accentColor};` : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
    <tr>
      <td bgcolor="${BRAND.panelBg}" style="background:${BRAND.panelBg};border:1px solid ${BRAND.panelBorder};${accentStyle}border-radius:10px;padding:18px 20px;">
        ${content}
      </td>
    </tr>
  </table>`;
}

/**
 * Bulletproof pill CTA — padded td with bgcolor so it renders in Outlook.
 * "blue" (default) for standard actions, "magenta" for adult-context CTAs.
 */
export function ctaButton(
  label: string,
  url: string,
  variant: "blue" | "magenta" = "blue",
): string {
  const color = variant === "magenta" ? BRAND.magenta : BRAND.blueDeep;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto;">
    <tr>
      <td align="center" bgcolor="${color}" style="background:${color};border-radius:999px;mso-padding-alt:15px 36px;">
        <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:15px 36px;font-family:${FONT_BODY};font-size:14px;line-height:18px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

/** Thin horizontal rule on the white content body. */
export function divider(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
    <tr>
      <td height="1" bgcolor="${BRAND.panelBorder}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td>
    </tr>
  </table>`;
}
