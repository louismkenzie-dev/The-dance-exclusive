import { describe, expect, it } from "vitest";
import { formatPostcode, hasCompleteAddress, isValidUkPhone, isValidUkPostcode } from "./customerAddress";

describe("isValidUkPhone", () => {
  it("accepts UK mobiles and landlines in common formats", () => {
    for (const p of ["07789 740354", "07789740354", "+44 7789 740354", "+447789740354", "01376 550123", "(01376) 550-123"]) {
      expect(isValidUkPhone(p)).toBe(true);
    }
  });

  it("rejects rubbish and non-UK shapes", () => {
    for (const p of ["", "  ", "123", "hello", "999", "0778", "+1 555 0100", null, undefined]) {
      expect(isValidUkPhone(p as string)).toBe(false);
    }
  });
});

describe("isValidUkPostcode", () => {
  it("accepts real Essex postcodes in any casing/spacing", () => {
    for (const pc of ["CM7 1AB", "cm71ab", " CO15 1RN ", "SS11 8QP", "E1 6AN", "W1A 0AX"]) {
      expect(isValidUkPostcode(pc)).toBe(true);
    }
  });

  it("rejects rubbish", () => {
    for (const pc of ["", "   ", "ABC", "12345", "CM7", "hello world", null, undefined]) {
      expect(isValidUkPostcode(pc as string)).toBe(false);
    }
  });
});

describe("formatPostcode", () => {
  it("normalises to upper case with the standard space", () => {
    expect(formatPostcode("cm71ab")).toBe("CM7 1AB");
    expect(formatPostcode("  co15 1rn ")).toBe("CO15 1RN");
    expect(formatPostcode("E16AN")).toBe("E1 6AN");
  });
});

describe("hasCompleteAddress", () => {
  const full = { address_line1: "12 High Street", city: "Braintree", postcode: "CM7 1AB" };

  it("passes with street, town and a valid postcode", () => {
    expect(hasCompleteAddress(full)).toBe(true);
    expect(hasCompleteAddress({ ...full, address_line2: "Flat 2", county: "Essex" })).toBe(true);
  });

  it("fails when any required part is missing or invalid", () => {
    expect(hasCompleteAddress(null)).toBe(false);
    expect(hasCompleteAddress({ ...full, address_line1: "" })).toBe(false);
    expect(hasCompleteAddress({ ...full, city: " " })).toBe(false);
    expect(hasCompleteAddress({ ...full, postcode: "not a postcode" })).toBe(false);
  });
});
