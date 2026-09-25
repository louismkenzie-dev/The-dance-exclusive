// Mirror of src/lib/emailAttachments.ts — KEEP THE TWO IN SYNC.
// emailAttachments.test.ts fails if they ever disagree.
//
/**
 * Validating files sent alongside an email — today only the merchandise print run CSV.
 *
 * The rule that matters is REJECT, NEVER STRIP. If the attachment cannot go, the email must not
 * go either: otherwise Amie sees "sent", Laurence receives a covering note with nothing attached,
 * and the order lines have already been marked as sent to print — so they drop out of the queue
 * and are never printed. A refused send is recoverable; a silently empty one is not.
 */

export interface EmailAttachment {
  filename: string;
  /** base64-encoded, which is what Resend expects. */
  content: string;
}

/**
 * Resend allows far more, but a print run is a few kilobytes of text. A megabyte means something
 * has gone wrong upstream and it is better to refuse than to send it.
 */
export const MAX_ATTACHMENT_BASE64 = 1_000_000;

/** Returns a human-readable problem, or null when the attachments are fine. */
export function checkAttachments(attachments: EmailAttachment[] | undefined | null): string | null {
  if (!attachments?.length) return null;
  let total = 0;
  for (const a of attachments) {
    if (!a?.filename || typeof a.content !== "string" || !a.content) {
      return "An attachment is missing its filename or content.";
    }
    if (/[/\\]/.test(a.filename)) {
      return `Attachment filename must not contain a path: ${a.filename}`;
    }
    total += a.content.length;
  }
  if (total > MAX_ATTACHMENT_BASE64) {
    return `Attachments are too large (${Math.round(total / 1024)}KB encoded).`;
  }
  return null;
}
