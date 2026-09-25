import { describe, it, expect } from "vitest";
import { frontMedia, backMedia, hasFlip, type MerchMediaLike } from "./merchMedia";

const m = (file_path: string, extra: Partial<MerchMediaLike> = {}): MerchMediaLike => ({
  file_path,
  ...extra,
});

describe("merchMedia", () => {
  describe("with no is_back column yet (the state the database is in today)", () => {
    const media = [
      m("b.png", { sort_order: 2 }),
      m("a.png", { sort_order: 1, is_primary: true }),
    ];

    it("uses the primary as the front", () => {
      expect(frontMedia(media)?.file_path).toBe("a.png");
    });

    it("falls back to the next photo by sort order as the back", () => {
      expect(backMedia(media)?.file_path).toBe("b.png");
    });

    it("flips", () => {
      expect(hasFlip(media)).toBe(true);
    });
  });

  describe("once is_back exists", () => {
    const media = [
      m("front.png", { sort_order: 1, is_primary: true }),
      m("detail.png", { sort_order: 2 }),
      m("back.png", { sort_order: 3, is_back: true }),
    ];

    it("prefers the flagged back over sort order", () => {
      expect(backMedia(media)?.file_path).toBe("back.png");
    });

    it("never picks the back as the front", () => {
      expect(frontMedia(media)?.file_path).toBe("front.png");
    });

    it("does not pick the back as the front even when it is also flagged primary", () => {
      const odd = [m("back.png", { is_back: true, is_primary: true }), m("front.png", {})];
      expect(frontMedia(odd)?.file_path).toBe("front.png");
    });
  });

  describe("products that cannot flip", () => {
    it("returns no back for a single photo", () => {
      const one = [m("only.png", { is_primary: true })];
      expect(frontMedia(one)?.file_path).toBe("only.png");
      expect(backMedia(one)).toBeUndefined();
      expect(hasFlip(one)).toBe(false);
    });

    it("handles empty and missing media", () => {
      expect(frontMedia([])).toBeUndefined();
      expect(backMedia([])).toBeUndefined();
      expect(frontMedia(null)).toBeUndefined();
      expect(backMedia(undefined)).toBeUndefined();
      expect(hasFlip(null)).toBe(false);
    });

    it("never returns the same photo as front and back", () => {
      const cases: MerchMediaLike[][] = [
        [m("a.png", { is_primary: true })],
        [m("a.png", { is_primary: true }), m("b.png", { sort_order: 1 })],
        [m("a.png", { is_back: true })],
      ];
      for (const media of cases) {
        const f = frontMedia(media);
        const b = backMedia(media);
        if (f && b) expect(f.file_path).not.toBe(b.file_path);
      }
    });
  });

  it("orders deterministically when sort_order is missing or tied", () => {
    const a = [m("z.png"), m("a.png")];
    const b = [m("a.png"), m("z.png")];
    expect(frontMedia(a)?.file_path).toBe(frontMedia(b)?.file_path);
    expect(backMedia(a)?.file_path).toBe(backMedia(b)?.file_path);
  });

  it("does not mutate the array it is given", () => {
    const media = [m("b.png", { sort_order: 2 }), m("a.png", { sort_order: 1 })];
    const before = media.map((x) => x.file_path);
    frontMedia(media);
    backMedia(media);
    expect(media.map((x) => x.file_path)).toEqual(before);
  });
});
