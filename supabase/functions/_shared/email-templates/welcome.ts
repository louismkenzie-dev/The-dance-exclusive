import { BRAND, ctaButton, escapeHtml, renderLayout } from "./layout.ts";

export interface WelcomeData {
  fullName?: string | null;
  email: string;
}

export function renderWelcome(data: WelcomeData) {
  const firstName = data.fullName?.split(" ")[0] || "there";

  const body = `
    <h1 style="margin:0 0 16px 0;font-family:'Oswald','Segoe UI',sans-serif;font-size:32px;line-height:38px;font-weight:700;color:${BRAND.text};letter-spacing:0.5px;">
      Welcome, ${escapeHtml(firstName)}.
    </h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${BRAND.text};">
      You're in. Your account at <strong style="color:${BRAND.primary};">The Dance Exclusive</strong> is ready to go.
    </p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:${BRAND.textMuted};">
      Browse our children's and adult classes, book trials, and manage everything from your account.
    </p>

    ${ctaButton("Browse Classes", `${BRAND.appUrl}/classes/children`)}

    <div style="font-size:11px;font-weight:700;color:${BRAND.primary};letter-spacing:1.5px;text-transform:uppercase;margin:32px 0 12px 0;">
      What's next?
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0;">
      <tr>
        <td width="49%" valign="top" style="padding:0;">
          <div style="padding:18px;background:#0d1117;border:1px solid ${BRAND.border};border-radius:10px;border-top:3px solid ${BRAND.primary};">
            <div style="font-size:12px;font-weight:700;color:${BRAND.primary};letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">
              For your child
            </div>
            <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:22px;color:${BRAND.textMuted};">
              <li>Add your child's profile under <strong style="color:${BRAND.text};">My Account</strong></li>
              <li>Sign the medical waiver to complete their profile</li>
              <li>Book a free trial class to get started</li>
            </ul>
          </div>
        </td>
        <td width="2%">&nbsp;</td>
        <td width="49%" valign="top" style="padding:0;">
          <div style="padding:18px;background:#0d1117;border:1px solid ${BRAND.border};border-radius:10px;border-top:3px solid #e85a9b;">
            <div style="font-size:12px;font-weight:700;color:#e85a9b;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">
              Booking for yourself
            </div>
            <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:22px;color:${BRAND.textMuted};">
              <li>Complete your profile under <strong style="color:${BRAND.text};">My Account</strong></li>
              <li>Browse adult classes — no experience needed</li>
              <li>Book a drop-in or commit to a full term</li>
            </ul>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:28px 0 0 0;font-size:13px;line-height:20px;color:${BRAND.textMuted};">
      Welcome to the family,<br/>The Dance Exclusive team
    </p>
  `;

  return {
    subject: `Welcome to The Dance Exclusive`,
    html: renderLayout({
      title: "Welcome",
      preheader: "Your account is ready — let's get you dancing.",
      body,
    }),
  };
}
