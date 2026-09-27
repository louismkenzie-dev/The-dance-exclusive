import { describe, expect, it } from "vitest";
import { publicCoachPhoto } from "./publicCoachPhoto";
import portraits from "./coachPortraits.json";

describe("public coach portrait selection", () => {
  const [id, portrait] = Object.entries(portraits)[0];
  it("uses the branded edition of its original photo", () => {
    expect(publicCoachPhoto({ id, profile_photo: portrait.source })).toBe(portrait.portrait);
  });
  it("honours a coach's subsequent photo change or removal", () => {
    const replacement = "https://example.com/new-photo.jpg";
    expect(publicCoachPhoto({ id, profile_photo: replacement })).toBe(replacement);
    expect(publicCoachPhoto({ id, profile_photo: null })).toBeNull();
  });
  it("preserves photos for newly published coaches", () => {
    expect(publicCoachPhoto({ id: "new-coach", profile_photo: "https://example.com/photo.jpg" })).toBe("https://example.com/photo.jpg");
  });
});
