import { describe, expect, it } from "vitest";
import { classBrowserPath, classLinkPath, classShareUrl } from "./classLinks";

const ID = "8f3a1c2e-0000-4000-8000-000000000001";

describe("classLinkPath", () => {
  it("is the shareable class path", () => {
    expect(classLinkPath(ID)).toBe(`/book/${ID}`);
  });
});

describe("classShareUrl", () => {
  it("builds a full link from the given origin", () => {
    expect(classShareUrl(ID, "https://app.thedanceexclusive.co.uk")).toBe(
      `https://app.thedanceexclusive.co.uk/book/${ID}`,
    );
  });

  it("doesn't double the slash when the origin has a trailing one", () => {
    expect(classShareUrl(ID, "https://app.thedanceexclusive.co.uk/")).toBe(
      `https://app.thedanceexclusive.co.uk/book/${ID}`,
    );
  });
});

describe("classBrowserPath", () => {
  it("sends children's classes to the children tab", () => {
    expect(classBrowserPath(ID, "children")).toBe(`/classes/children?class=${ID}`);
  });

  it("sends adult classes to the adult tab", () => {
    expect(classBrowserPath(ID, "adult")).toBe(`/classes/adult?class=${ID}`);
  });

  it("falls back to children when the type is unknown", () => {
    expect(classBrowserPath(ID, null)).toBe(`/classes/children?class=${ID}`);
  });
});
