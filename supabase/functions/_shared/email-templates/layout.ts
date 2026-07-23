// Shared HTML layout for all transactional emails.
// Brand: The Dance Exclusive — the website's dark "club look", in the inbox.
//
// Near-black navy stage, the real splat logo, Oswald display type (with an
// Arial Narrow fallback for clients that block webfonts), the signature
// blue→magenta gradient rule, and dark panel cards — mirroring the marketing
// site. Table-based, inline CSS, bulletproof buttons — Outlook-safe.
//
// Helper convention: dynamic values must be passed through escapeHtml() by the
// caller; helper `text`/`content` arguments are treated as HTML.

export const BRAND = {
  name: "The Dance Exclusive",
  tagline: "STEP IN, STAND OUT",

  // ── Club-look palette (dark, matching the site) ──────────────────
  bg: "#070B12", // outer page — deep stage black-navy
  band: "#0B111C", // header/footer band
  ink: "#EEF3F9", // primary copy on dark navy
  inkMuted: "#93A1B5", // secondary copy on dark navy
  contentBg: "#0E1522", // content card navy
  panelBg: "#151F30", // raised panel fill
  panelBorder: "#243350", // panel/detail hairlines
  blue: "#6BC1E8", // logo blue — accents + links on navy
  blueDeep: "#5BC0EF", // link/CTA blue (readable on navy)
  magenta: "#EE2A7B", // hot magenta — CTAs + gradient
  footerText: "#7C8AA0", // muted grey on navy

  // ── Legacy aliases (older template code / callers) ───────────────
  primary: "#5BC0EF",
  primaryDark: "#2FA8E0",
  cardBg: "#0E1522",
  border: "#243350",
  text: "#EEF3F9",
  textMuted: "#93A1B5",
  accent: "#EE2A7B",
  success: "#2FCB8B",

  appUrl: "https://app.thedanceexclusive.co.uk",
  supportEmail: "hello@thedanceexclusive.co.uk",
  /** Public export of the splat logo (light-on-dark variant), served from the site. */
  logoUrl: "https://the-dance-exclusive.vercel.app/brand/email-logo.png",
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
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
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
    <!--[if !mso]><!-->
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap');
    </style>
    <!--<![endif]-->
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
        <td align="center" style="padding:36px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="container" style="width:600px;max-width:600px;">

            <!-- Logo on the stage -->
            <tr>
              <td align="center" bgcolor="${BRAND.band}" class="band" style="background:${BRAND.band};border:1px solid ${BRAND.panelBorder};border-bottom:0;border-radius:18px 18px 0 0;padding:34px 32px 24px 32px;">
                <a href="https://the-dance-exclusive.vercel.app" target="_blank" style="text-decoration:none;">
                  <img src="${BRAND.logoUrl}" width="170" alt="The Dance Exclusive" style="display:block;width:170px;max-width:60%;height:auto;border:0;" />
                </a>
                <div style="margin-top:16px;font-family:${FONT_DISPLAY};font-weight:600;font-size:12px;line-height:16px;letter-spacing:6px;color:${BRAND.blue};text-transform:uppercase;">
                  STEP IN &nbsp;&middot;&nbsp; STAND OUT
                </div>
              </td>
            </tr>

            <!-- Signature gradient rule: logo blue blending into hot magenta -->
            <tr>
              <td style="padding:0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td width="20%" height="3" bgcolor="#38BDF2" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                    <td width="20%" height="3" bgcolor="#6BA3E8" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                    <td width="20%" height="3" bgcolor="#9B7BD8" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                    <td width="20%" height="3" bgcolor="#C85AA8" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                    <td width="20%" height="3" bgcolor="#EE2A7B" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Content on dark navy -->
            <tr>
              <td bgcolor="${BRAND.contentBg}" class="card" style="background:${BRAND.contentBg};border:1px solid ${BRAND.panelBorder};border-top:0;border-bottom:0;padding:38px 40px;font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:${BRAND.ink};">
                ${body}
              </td>
            </tr>

            <!-- Footer band -->
            <tr>
              <td align="center" bgcolor="${BRAND.band}" class="band" style="background:${BRAND.band};border:1px solid ${BRAND.panelBorder};border-top:1px solid ${BRAND.panelBorder};border-radius:0 0 18px 18px;padding:28px 32px;">
                <div style="font-family:${FONT_DISPLAY};font-weight:700;font-size:12px;line-height:17px;letter-spacing:5px;color:${BRAND.blue};text-transform:uppercase;margin-bottom:6px;">
                  THE DANCE EXCLUSIVE
                </div>
                <div style="font-family:${FONT_BODY};font-size:11px;line-height:17px;letter-spacing:2px;color:${BRAND.magenta};text-transform:uppercase;margin-bottom:14px;">
                  Essex&#39;s award-winning street &amp; commercial dance school
                </div>
                <div style="font-family:${FONT_BODY};font-size:12px;line-height:19px;color:${BRAND.footerText};margin-bottom:10px;">
                  Essex, United Kingdom &nbsp;&middot;&nbsp;
                  <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a><br />
                  <a href="https://instagram.com/thedanceexclusive" target="_blank" style="color:${BRAND.footerText};text-decoration:underline;">Instagram</a>
                  &nbsp;&middot;&nbsp;
                  <a href="https://facebook.com/thedanceexclusive" target="_blank" style="color:${BRAND.footerText};text-decoration:underline;">Facebook</a>
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
 * Display heading. level 1 = big Oswald headline, level 2 = small
 * letter-spaced uppercase section heading. Both bold, uppercase, on navy.
 */
export function heading(
  text: string,
  opts: { level?: 1 | 2; align?: "left" | "center" } = {},
): string {
  const align = opts.align ?? "left";
  if (opts.level === 2) {
    return `<div style="margin:28px 0 12px 0;font-family:${FONT_BODY};font-size:12px;line-height:18px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${BRAND.blue};text-align:${align};">${text}</div>`;
  }
  return `<h1 style="margin:0 0 16px 0;font-family:${FONT_DISPLAY};font-size:28px;line-height:34px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${BRAND.ink};text-align:${align};">${text}</h1>`;
}

/** Body paragraph — 16px/1.6 light ink on navy; muted/small/center variants. */
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

/** Raised navy panel card, optionally with a blue or magenta accent edge. */
export function panel(
  content: string,
  opts: { accent?: "blue" | "magenta" } = {},
): string {
  const accentColor =
    opts.accent === "magenta"
      ? BRAND.magenta
      : opts.accent === "blue"
        ? "#38BDF2"
        : null;
  const accentStyle = accentColor ? `border-left:4px solid ${accentColor};` : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
    <tr>
      <td bgcolor="${BRAND.panelBg}" style="background:${BRAND.panelBg};border:1px solid ${BRAND.panelBorder};${accentStyle}border-radius:12px;padding:18px 20px;">
        ${content}
      </td>
    </tr>
  </table>`;
}

/**
 * Bulletproof pill CTA — padded td with bgcolor so it renders in Outlook.
 * "blue" (default) for standard actions, "magenta" for stand-out CTAs.
 */
export function ctaButton(
  label: string,
  url: string,
  variant: "blue" | "magenta" = "blue",
): string {
  const color = variant === "magenta" ? BRAND.magenta : "#1690D6";
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto;">
    <tr>
      <td align="center" bgcolor="${color}" style="background:${color};border-radius:999px;mso-padding-alt:15px 36px;">
        <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:15px 36px;font-family:${FONT_DISPLAY};font-size:14px;line-height:18px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

/** Thin horizontal rule on the navy content body. */
export function divider(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
    <tr>
      <td height="1" bgcolor="${BRAND.panelBorder}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td>
    </tr>
  </table>`;
}
