// Shared HTML layout for all transactional emails.
// Brand: The Dance Exclusive — the app's own look, in the inbox.
//
// Built on the same tokens as the site (near-black background, dark cards
// with hairline borders, blue-tinted icon tiles, Oswald display type with
// Inter body copy, the blue→magenta signature line) and the same generosity
// of space — the email should feel like a screen of the app, not a form.
// Table-based, inline CSS, bulletproof buttons — Outlook-safe.
//
// Fonts: Apple Mail, iOS Mail, Samsung Mail, Outlook for Mac and Thunderbird
// load the linked Google Fonts. Gmail and Outlook for Windows/iOS don't load
// web fonts at all — they get condensed system fallbacks tuned to sit right.
//
// Helper convention: dynamic values must be passed through escapeHtml() by the
// caller; helper `text`/`content` arguments are treated as HTML.

const APP = "https://app.thedanceexclusive.co.uk";

export const BRAND = {
  name: "The Dance Exclusive",
  tagline: "STEP IN, STAND OUT",

  // ── Site palette (index.css tokens, resolved to hex) ─────────────
  bg: "#080A0C", // --background
  band: "#111318", // --card
  contentBg: "#111318", // --card
  panelBg: "#171B23", // raised card inside the card
  panelBorder: "#23272F", // --border
  ink: "#FAFAFA", // --foreground
  inkSoft: "#C9CFD8", // readable body copy on the card
  inkMuted: "#818898", // --muted-foreground
  blue: "#5BC0EF", // icon / link blue (logo blue on dark)
  blueDeep: "#00B0E0", // --primary
  magenta: "#F4258C", // --accent
  footerText: "#6F7787",

  // ── Legacy aliases (older template code / callers) ───────────────
  primary: "#00B0E0",
  primaryDark: "#0A94BF",
  cardBg: "#111318",
  border: "#23272F",
  text: "#FAFAFA",
  textMuted: "#818898",
  accent: "#F4258C",
  success: "#2FCB8B",

  appUrl: APP,
  supportEmail: "hello@thedanceexclusive.co.uk",
  // Must live on the custom domain: vercel.app hosts sit behind Vercel
  // Authentication, so mail clients get a 401 instead of the image.
  // Email can't use SVG (Gmail/Outlook drop it), so this is the logo at 4x
  // its display size — as sharp as a vector on any screen.
  logoUrl: `${APP}/brand/email-logo-4x.png`,
};

/** Email-sized photos served from the app's public folder (public/email/). */
export const HERO = {
  /** Silhouetted crew under blue and magenta light — the default. */
  stage: `${APP}/email/hero-stage.jpg`,
  /** Kids mid-move under blue light — children's classes. */
  kids: `${APP}/email/hero-kids.jpg`,
  /** Heels silhouette in magenta and blue — adult classes. */
  adults: `${APP}/email/hero-adults.jpg`,
};

/**
 * The app's lucide icons as blue-tinted tiles (public/email/icons/). Two
 * sizes: 56px for a headline tile, 36px beside a detail row.
 */
export type IconName =
  | "calendar" | "clock" | "map-pin" | "user" | "users" | "bell" | "sparkles"
  | "ticket" | "credit-card" | "cake" | "key" | "mail" | "phone"
  | "graduation-cap" | "party-popper" | "heart" | "check-circle"
  | "shield-check" | "award" | "calendar-check" | "alert-circle";

export const iconUrl = (name: IconName, size: 56 | 36 = 56) =>
  `${APP}/email/icons/${name}-${size}.png`;

export const FONT_BODY =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
// Oswald is condensed, so the fallbacks are condensed too — iPhone/iPad
// (Avenir Next Condensed), Windows (Arial Narrow), Android (Roboto Condensed).
export const FONT_DISPLAY =
  "'Oswald','Avenir Next Condensed','Arial Narrow','Roboto Condensed','Segoe UI',Arial,sans-serif";

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap";

interface LayoutOpts {
  title: string;
  preheader?: string;
  body: string;
  /** Full-width photo under the masthead. Omit for none. */
  hero?: { url: string; alt?: string };
  /** Headline icon tile, centred above the content (like the app's cards). */
  icon?: IconName;
}

export function renderLayout({ title, preheader, body, hero, icon }: LayoutOpts): string {
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
    <style>
      td, p, a, h1, h2, div { font-family: 'Arial Narrow', Arial, sans-serif !important; }
    </style>
    <![endif]-->
    <!--[if !mso]><!-->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="${GOOGLE_FONTS_URL}" rel="stylesheet" type="text/css" />
    <style type="text/css">
      @import url('${GOOGLE_FONTS_URL}');
    </style>
    <!--<![endif]-->
    <style type="text/css">
      body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
      img { -ms-interpolation-mode: bicubic; }
      a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
      @media (max-width: 620px) {
        .container { width: 100% !important; }
        .card { padding: 32px 24px 28px 24px !important; }
        .band { padding-left: 24px !important; padding-right: 24px !important; }
        .panel { padding: 22px 20px !important; }
        .h1 { font-size: 34px !important; line-height: 38px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:${FONT_BODY};-webkit-font-smoothing:antialiased;word-spacing:normal;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${BRAND.bg}" style="background:${BRAND.bg};">
      <tr>
        <td align="center" style="padding:28px 12px 44px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="container" style="width:600px;max-width:600px;">

            <!-- Signature line: logo blue into hot magenta, as at the top of the app -->
            <tr>
              <td style="padding:0;border-radius:3px 3px 0 0;overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td width="20%" height="3" bgcolor="#38BDF2" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                    <td width="20%" height="3" bgcolor="#5BA6E6" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                    <td width="20%" height="3" bgcolor="#8E7ED9" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                    <td width="20%" height="3" bgcolor="#C455B0" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                    <td width="20%" height="3" bgcolor="#F4258C" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Masthead -->
            <tr>
              <td align="center" bgcolor="${BRAND.band}" class="band" style="background:${BRAND.band};border-left:1px solid ${BRAND.panelBorder};border-right:1px solid ${BRAND.panelBorder};padding:34px 32px 30px 32px;">
                <a href="${BRAND.appUrl}" target="_blank" style="text-decoration:none;">
                  <img src="${BRAND.logoUrl}" width="92" alt="The Dance Exclusive" style="display:block;width:92px;height:auto;border:0;margin:0 auto;" />
                </a>
              </td>
            </tr>

            ${hero ? `
            <!-- Photo -->
            <tr>
              <td style="padding:0;border-left:1px solid ${BRAND.panelBorder};border-right:1px solid ${BRAND.panelBorder};background:${BRAND.band};line-height:0;font-size:0;">
                <img src="${escapeHtml(hero.url)}" width="598" alt="${escapeHtml(hero.alt ?? "")}" style="display:block;width:100%;max-width:598px;height:auto;border:0;" />
              </td>
            </tr>` : ""}

            <!-- Content -->
            <tr>
              <td bgcolor="${BRAND.contentBg}" class="card" style="background:${BRAND.contentBg};border-left:1px solid ${BRAND.panelBorder};border-right:1px solid ${BRAND.panelBorder};padding:44px 44px 36px 44px;font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:${BRAND.ink};">
                ${icon ? iconTile(icon, { align: "center", size: 56 }) : ""}
                ${body}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" bgcolor="${BRAND.band}" class="band" style="background:${BRAND.band};border:1px solid ${BRAND.panelBorder};border-top:1px solid ${BRAND.panelBorder};border-radius:0 0 20px 20px;padding:28px 32px 30px 32px;">
                <div style="font-family:${FONT_DISPLAY};font-weight:700;font-size:13px;line-height:18px;letter-spacing:3px;color:${BRAND.ink};text-transform:uppercase;margin-bottom:4px;">
                  THE DANCE EXCLUSIVE
                </div>
                <div style="font-family:${FONT_BODY};font-weight:600;font-size:11px;line-height:16px;letter-spacing:2.5px;color:${BRAND.blueDeep};text-transform:uppercase;margin-bottom:18px;">
                  Step in &nbsp;&middot;&nbsp; Stand out
                </div>
                <div style="font-family:${FONT_BODY};font-size:12px;line-height:20px;color:${BRAND.inkMuted};margin-bottom:14px;">
                  <a href="${BRAND.appUrl}" target="_blank" style="color:${BRAND.blue};text-decoration:none;font-weight:600;">app.thedanceexclusive.co.uk</a>
                  &nbsp;&middot;&nbsp;
                  <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a><br />
                  <a href="https://instagram.com/thedanceexclusive" target="_blank" style="color:${BRAND.inkMuted};text-decoration:underline;">Instagram</a>
                  &nbsp;&middot;&nbsp;
                  <a href="https://facebook.com/thedanceexclusive" target="_blank" style="color:${BRAND.inkMuted};text-decoration:underline;">Facebook</a>
                </div>
                <div style="font-family:${FONT_BODY};font-size:11px;line-height:17px;color:${BRAND.footerText};margin-bottom:8px;">
                  You're receiving this service email because of an account, booking or
                  enquiry with ${BRAND.name}. It isn't marketing — if it reached you
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

/** Blue-tinted icon tile, as on the app's feature cards. */
export function iconTile(
  name: IconName,
  opts: { size?: 56 | 36; align?: "left" | "center" } = {},
): string {
  const size = opts.size ?? 56;
  const align = opts.align ?? "left";
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="${align}" style="margin:0 ${align === "center" ? "auto" : "0"} 22px ${align === "center" ? "auto" : "0"};">
    <tr>
      <td style="line-height:0;font-size:0;">
        <img src="${iconUrl(name, size)}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;border:0;" />
      </td>
    </tr>
  </table>`;
}

/** Small letter-spaced label above a headline — "Trial reminder", "Booking confirmed". */
export function kicker(
  text: string,
  opts: { align?: "left" | "center"; color?: "magenta" | "blue" } = {},
): string {
  const color = opts.color === "magenta" ? BRAND.magenta : BRAND.blueDeep;
  return `<div style="margin:0 0 12px 0;font-family:${FONT_BODY};font-size:12px;line-height:16px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${color};text-align:${opts.align ?? "left"};">${text}</div>`;
}

/**
 * Display heading. level 1 = big Oswald headline (the app's section title),
 * level 2 = card title (the app's h3). Both uppercase, on the card.
 */
export function heading(
  text: string,
  opts: { level?: 1 | 2; align?: "left" | "center" } = {},
): string {
  const align = opts.align ?? "left";
  if (opts.level === 2) {
    return `<div style="margin:32px 0 10px 0;font-family:${FONT_DISPLAY};font-size:24px;line-height:30px;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;color:${BRAND.ink};text-align:${align};">${text}</div>`;
  }
  return `<h1 class="h1" style="margin:0 0 18px 0;font-family:${FONT_DISPLAY};font-size:40px;line-height:44px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${BRAND.ink};text-align:${align};">${text}</h1>`;
}

/** Body paragraph — 16px/27px soft ink; muted/small/center variants. */
export function paragraph(
  html: string,
  opts: { muted?: boolean; small?: boolean; align?: "left" | "center" } = {},
): string {
  const size = opts.small ? "13px" : "16px";
  const lineHeight = opts.small ? "21px" : "27px";
  const color = opts.muted ? BRAND.inkMuted : BRAND.inkSoft;
  return `<p style="margin:0 0 18px 0;font-family:${FONT_BODY};font-size:${size};line-height:${lineHeight};color:${color};text-align:${opts.align ?? "left"};">${html}</p>`;
}

/** Pick the app icon that suits a detail label, so every template gets tiles for free. */
function iconForLabel(label: string): IconName | null {
  const l = label.toLowerCase();
  if (/date|day|when|start|end|expires|renew/.test(l)) return "calendar";
  if (/time/.test(l)) return "clock";
  if (/venue|location|where|address|hall|studio/.test(l)) return "map-pin";
  if (/dancer|attendee|child|student|name|for/.test(l)) return "user";
  if (/class|session|workshop|camp|event/.test(l)) return "sparkles";
  if (/price|amount|total|paid|cost|fee|balance/.test(l)) return "credit-card";
  if (/email/.test(l)) return "mail";
  if (/phone|mobile|tel/.test(l)) return "phone";
  if (/booking|ref|ticket|order/.test(l)) return "ticket";
  if (/teacher|instructor|coach|staff|team|guests|children/.test(l)) return "users";
  return null;
}

/**
 * Label/value row with an icon tile — the app's list style. Icon is picked
 * from the label unless given; pass `null` for no tile.
 */
export function detailRow(label: string, value: string, icon?: IconName | null): string {
  const chosen = icon === undefined ? iconForLabel(label) : icon;
  const tile = chosen
    ? `<td width="36" valign="middle" style="width:36px;padding:0 14px 0 0;line-height:0;font-size:0;">
          <img src="${iconUrl(chosen, 36)}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border:0;" />
        </td>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      ${tile}
      <td valign="middle" style="padding:8px 0;">
        <div style="font-family:${FONT_BODY};font-size:11px;line-height:15px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND.inkMuted};margin:0 0 2px 0;">${label}</div>
        <div style="font-family:${FONT_BODY};font-size:16px;line-height:22px;font-weight:600;color:${BRAND.ink};">${value}</div>
      </td>
    </tr>
  </table>`;
}

/** Bold Oswald title inside a panel — the class or event name. */
export function panelTitle(text: string): string {
  return `<div style="font-family:${FONT_DISPLAY};font-size:24px;line-height:30px;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;color:${BRAND.ink};margin:0 0 14px 0;">${text}</div>`;
}

/** Raised card inside the email, like the app's feature cards. */
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
  const accentStyle = accentColor ? `border-left:3px solid ${accentColor};` : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 26px 0;">
    <tr>
      <td bgcolor="${BRAND.panelBg}" class="panel" style="background:${BRAND.panelBg};border:1px solid ${BRAND.panelBorder};${accentStyle}border-radius:16px;padding:24px 26px;">
        ${content}
      </td>
    </tr>
  </table>`;
}

/**
 * Full-width pill button, like the app's primary button — bright blue with
 * dark text. "magenta" for stand-out CTAs (white text).
 */
export function ctaButton(
  label: string,
  url: string,
  variant: "blue" | "magenta" = "blue",
): string {
  const bg = variant === "magenta" ? BRAND.magenta : BRAND.blueDeep;
  const fg = variant === "magenta" ? "#ffffff" : BRAND.bg;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 30px 0;">
    <tr>
      <td align="center" bgcolor="${bg}" style="background:${bg};border-radius:14px;mso-padding-alt:18px 24px;">
        <a href="${escapeHtml(url)}" target="_blank" style="display:block;padding:18px 24px;font-family:${FONT_DISPLAY};font-size:16px;line-height:20px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${fg};text-decoration:none;border-radius:14px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

/** Thin hairline, like the app's section borders. */
export function divider(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0;">
    <tr>
      <td height="1" bgcolor="${BRAND.panelBorder}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td>
    </tr>
  </table>`;
}
