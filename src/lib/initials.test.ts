import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first letter of the first and last name", () => {
    expect(initialsOf("Isla", "Pritchard")).toBe("IP");
  });

  it("survives the stray spaces parents type (the blank-circle bug)", () => {
    // Real data: " Ethan" / " Muldoon-KingluM" rendered two spaces, so the
    // avatar circle looked empty.
    expect(initialsOf(" Ethan", " Muldoon-KingluM")).toBe("EM");
    expect(initialsOf("Mileena ", "Osborne-Ture")).toBe("MO");
  });

  it("handles double-barrelled names", () => {
    expect(initialsOf("Bella-Rose", "Barwell")).toBe("BB");
    expect(initialsOf("Ivy", "Broadfield-Evans")).toBe("IB");
  });

  it("accepts a single full-name string", () => {
    expect(initialsOf("Amie Whitaker")).toBe("AW");
    expect(initialsOf("Louis McKenzie (Developer)")).toBe("LM");
  });

  it("uses middle names only for the surname initial", () => {
    expect(initialsOf("Anna Marie Smith")).toBe("AS");
  });

  it("copes with one name only", () => {
    expect(initialsOf("Madonna")).toBe("M");
    expect(initialsOf("Cher", null)).toBe("C");
  });

  it("never returns blank", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf(" ", null, undefined)).toBe("?");
    expect(initialsOf("???")).toBe("?");
  });

  it("keeps apostrophes and accents working", () => {
    expect(initialsOf("O'Brien", "D'Souza")).toBe("OD");
    expect(initialsOf("Émile", "Ångström")).toBe("ÉÅ");
  });
});
