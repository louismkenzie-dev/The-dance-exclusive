import { describe, it, expect } from "vitest";
import { checkAttachments, MAX_ATTACHMENT_BASE64 } from "./emailAttachments";

const ok = { filename: "print-run-7.csv", content: "QSxCCjEsMgo=" };

describe("emailAttachments", () => {
  it("passes a normal print run", () => {
    expect(checkAttachments([ok])).toBeNull();
  });

  it("passes when there are none — most emails have no attachment", () => {
    expect(checkAttachments(undefined)).toBeNull();
    expect(checkAttachments(null)).toBeNull();
    expect(checkAttachments([])).toBeNull();
  });

  describe("refuses rather than strips", () => {
    // The whole point: a covering note with no CSV would leave Amie thinking the printer had the
    // run, with the lines already marked as sent, so they would never be printed.
    it("rejects an attachment with no content", () => {
      expect(checkAttachments([{ filename: "x.csv", content: "" }])).toMatch(/filename or content/);
    });

    it("rejects an attachment with no filename", () => {
      expect(checkAttachments([{ filename: "", content: "abc" }])).toMatch(/filename or content/);
    });

    it("rejects non-string content", () => {
      expect(checkAttachments([{ filename: "x.csv", content: 123 as unknown as string }]))
        .toMatch(/filename or content/);
    });

    it("rejects a filename containing a path", () => {
      expect(checkAttachments([{ filename: "../../etc/passwd", content: "abc" }])).toMatch(/path/);
      expect(checkAttachments([{ filename: "a\\b.csv", content: "abc" }])).toMatch(/path/);
    });

    it("rejects an oversized attachment, and says how big it was", () => {
      const huge = { filename: "big.csv", content: "A".repeat(MAX_ATTACHMENT_BASE64 + 1) };
      expect(checkAttachments([huge])).toMatch(/too large \(\d+KB encoded\)/);
    });

    it("sums across several attachments rather than checking each alone", () => {
      const half = { filename: "a.csv", content: "A".repeat(MAX_ATTACHMENT_BASE64 * 0.6) };
      expect(checkAttachments([half])).toBeNull();
      expect(checkAttachments([half, { ...half, filename: "b.csv" }])).toMatch(/too large/);
    });
  });

  it("allows a filename right on the size limit", () => {
    expect(checkAttachments([{ filename: "edge.csv", content: "A".repeat(MAX_ATTACHMENT_BASE64) }]))
      .toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("the client mirror and the server copy", () => {
  it("agree", async () => {
    const server = await import("../../supabase/functions/_shared/emailAttachments.ts");
    expect(server.MAX_ATTACHMENT_BASE64).toBe(MAX_ATTACHMENT_BASE64);
    for (const c of [
      [ok],
      [{ filename: "", content: "x" }],
      [{ filename: "a/b.csv", content: "x" }],
      [{ filename: "x.csv", content: "A".repeat(MAX_ATTACHMENT_BASE64 + 1) }],
    ]) {
      expect(server.checkAttachments(c)).toBe(checkAttachments(c));
    }
  });
});
