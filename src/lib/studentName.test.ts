import { describe, expect, it } from "vitest";
import { nameWithNickname, nicknameOf, officialName } from "./studentName";

// The dancer this was built for: booked as Christina Clark, known as Peach.
const PEACH = { first_name: "Christina", last_name: "clark", preferred_name: "Peach" };

describe("officialName — what the booking says", () => {
  it("leads with the name the studio invoices and the ambulance needs", () => {
    expect(officialName(PEACH)).toBe("Christina clark");
  });
  it("never quietly substitutes the nickname", () => {
    expect(officialName(PEACH)).not.toContain("Peach");
  });
  it("copes with half a name", () => {
    expect(officialName({ first_name: "Ellie", last_name: null })).toBe("Ellie");
    expect(officialName({ first_name: null, last_name: "Davis" })).toBe("Davis");
  });
  it("falls back when there is no dancer record at all", () => {
    expect(officialName(null)).toBe("Adult attendee");
    expect(officialName({ first_name: "  ", last_name: " " })).toBe("Adult attendee");
    expect(officialName(null, "No profile")).toBe("No profile");
  });
});

describe("nicknameOf — only when it is really different", () => {
  it("returns the nickname the class actually uses", () => {
    expect(nicknameOf(PEACH)).toBe("Peach");
  });
  it("stays quiet when it just repeats the first name", () => {
    expect(nicknameOf({ first_name: "Ellie", preferred_name: "Ellie" })).toBeNull();
    expect(nicknameOf({ first_name: "Ellie", preferred_name: "  ellie " })).toBeNull();
  });
  it("stays quiet when there is none", () => {
    expect(nicknameOf({ first_name: "Kirsty", preferred_name: null })).toBeNull();
    expect(nicknameOf({ first_name: "Kirsty", preferred_name: "   " })).toBeNull();
    expect(nicknameOf(null)).toBeNull();
  });
  it("keeps a shortening that is a real difference", () => {
    expect(nicknameOf({ first_name: "Elizabeth", preferred_name: "Beth" })).toBe("Beth");
  });
});

describe("nameWithNickname — one line where there is no room for two", () => {
  it("shows both, official first", () => {
    expect(nameWithNickname(PEACH)).toBe('Christina clark ("Peach")');
  });
  it("shows one when that is all there is", () => {
    expect(nameWithNickname({ first_name: "Kirsty", last_name: "McAlpine" })).toBe("Kirsty McAlpine");
  });
});
