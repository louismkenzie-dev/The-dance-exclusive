import {
  BRAND,
  ctaButton,
  escapeHtml,
  FONT_BODY,
  heading,
  kicker,
  panel,
  paragraph,
  renderLayout,
  secondaryLink,
} from "./layout.ts";

export interface AccountNotFoundData {
  email: string;
  /** Registration page, e.g. https://app.thedanceexclusive.co.uk/auth?signup=1 */
  signupUrl: string;
  /** Reset form, for someone who registered under a different address. */
  forgotUrl: string;
}

/**
 * Sent when a password reset is requested for an address that has no
 * account. Families who moved from the old booking system assume their old
 * login carried across, ask for a reset, and hear nothing — the form must
 * not reveal whether an address exists. Telling the owner of the inbox, and
 * only them, is safe and turns a dead end into a sign-up.
 */
export function renderAccountNotFound(data: AccountNotFoundData) {
  const body = `
    ${kicker("Account help", { align: "center" })}
    ${heading("We couldn&#39;t find an account for this email", { align: "center" })}
    ${paragraph("Hi there,", { align: "center" })}
    ${paragraph(
      `Someone asked us to reset the password for <strong style="color:${BRAND.ink};">${escapeHtml(data.email)}</strong>, but there is no account with that address on our booking system, so there is no password to reset.`,
      { muted: true, align: "center" },
    )}
    ${paragraph(
      "Danced with us before? Logins from our old booking system did not carry across. Creating a new account takes about two minutes, and you can book straight away.",
      { muted: true, align: "center" },
    )}

    ${ctaButton("Create your account", data.signupUrl)}

    ${secondaryLink("Registered with a different email? Reset that one instead", data.forgotUrl)}

    ${panel(
      `<p style="margin:0;font-family:${FONT_BODY};font-size:13px;line-height:20px;color:${BRAND.inkMuted};"><strong style="color:${BRAND.ink};">Didn&#39;t request this?</strong> You can ignore this email &mdash; nothing has changed and no account has been created.</p>`,
      { accent: "blue" },
    )}
  `;

  return {
    subject: "No account found for this email — The Dance Exclusive",
    html: renderLayout({
      title: "No account found",
      preheader: "There is no account for this email yet. Here is how to register.",
      body,
      icon: "user",
    }),
  };
}
