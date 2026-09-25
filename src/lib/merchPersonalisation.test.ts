import { describe, it, expect } from "vitest";
import {
  PERSONALISATION_PLACEMENTS,
  DEFAULT_PERSONALISATION_PRICE,
  MAX_PERSONALISATION_LENGTH,
  normalisePersonalisationText,
  validatePersonalisationText,
  personalisationPence,
  personalisationSignature,
  placementLabel,
} from "./merchPersonalisation";

describe("merchPersonalisation", () => {
  it("offers the three placements Amie asked for, at £3", () => {
    expect(PERSONALISATION_PLACEMENTS.map((p) => p.value)).toEqual(["front", "back", "sleeve"]);
    expect(DEFAULT_PERSONALISATION_PRICE).toBe(3);
    expect(placementLabel("sleeve")).toBe("Arm / sleeve");
  });

  describe("normalising", () => {
    it("trims and collapses whitespace", () => {
      expect(normalisePersonalisationText("  Evie   Rose ")).toBe("Evie Rose");
      expect(normalisePersonalisationText("\tJack\n")).toBe("Jack");
    });
  });

  describe("validating what a parent types", () => {
    it("accepts ordinary names", () => {
      for (const name of ["Evie", "Jack Smith", "O'Brien", "Anne-Marie", "Chloé", "Team 7", "J.R."]) {
        const r = validatePersonalisationText(name);
        expect(r.ok, `${name} should be allowed`).toBe(true);
      }
    });

    it("rejects an empty field rather than charging £3 for nothing", () => {
      for (const empty of ["", "   ", null, undefined]) {
        const r = validatePersonalisationText(empty);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/untick/);
      }
    });

    it("rejects emoji and control characters", () => {
      for (const bad of ["Evie 🎀", "Jack\u0000", "‮evil", "name\u0007"]) {
        expect(validatePersonalisationText(bad).ok, `${JSON.stringify(bad)} should be refused`).toBe(false);
      }
    });

    it("enforces the length cap after normalising", () => {
      expect(validatePersonalisationText("A".repeat(MAX_PERSONALISATION_LENGTH)).ok).toBe(true);
      expect(validatePersonalisationText("A".repeat(MAX_PERSONALISATION_LENGTH + 1)).ok).toBe(false);
      // whitespace that collapses away must not count towards the limit
      expect(validatePersonalisationText(`  ${"A".repeat(MAX_PERSONALISATION_LENGTH)}  `).ok).toBe(true);
    });

    it("returns the normalised value, not the raw input", () => {
      const r = validatePersonalisationText("  Evie   Rose ");
      expect(r.ok).toBe(true);
      expect(r.value).toBe("Evie Rose");
    });

    it("refuses formula characters that are not valid in a name anyway", () => {
      for (const bad of ["=1+1", "+44", "@SUM(A1)", "1|2"]) {
        expect(validatePersonalisationText(bad).ok, `${bad} should be refused`).toBe(false);
      }
    });

    it("allows a leading hyphen, and leaves Excel safety to the CSV layer", () => {
      // "-Evie" is odd but it is made of legal characters, and "Anne-Marie" must keep working.
      // Excel treats a leading "-" as a formula, so that is neutralised when the CSV is written,
      // not by refusing the parent's text with a baffling error.
      expect(validatePersonalisationText("-Evie").ok).toBe(true);
      expect(validatePersonalisationText("Anne-Marie").ok).toBe(true);
    });
  });

  describe("pricing", () => {
    it("sums placements in pence", () => {
      expect(personalisationPence([3])).toBe(300);
      expect(personalisationPence([3, 3, 3])).toBe(900);
      expect(personalisationPence([])).toBe(0);
    });

    it("rounds each placement separately so prices cannot drift", () => {
      // 2.995 x 3 would be 898.5 if summed in pounds then rounded once.
      expect(personalisationPence([2.995, 2.995, 2.995])).toBe(900);
    });

    it("treats missing or junk prices as zero", () => {
      expect(personalisationPence([NaN, undefined as unknown as number, 3])).toBe(300);
    });
  });

  describe("basket signature", () => {
    it("is empty for no personalisation, so plain garments merge as before", () => {
      expect(personalisationSignature([])).toBe("");
      expect(personalisationSignature(null)).toBe("");
    });

    it("matches regardless of the order the placements were chosen", () => {
      const a = personalisationSignature([
        { placement: "front", text: "Evie" },
        { placement: "sleeve", text: "7" },
      ]);
      const b = personalisationSignature([
        { placement: "sleeve", text: "7" },
        { placement: "front", text: "Evie" },
      ]);
      expect(a).toBe(b);
    });

    it("treats different names as different lines — the printer cannot batch them", () => {
      const evie = personalisationSignature([{ placement: "sleeve", text: "Evie" }]);
      const jack = personalisationSignature([{ placement: "sleeve", text: "Jack" }]);
      expect(evie).not.toBe(jack);
    });

    it("ignores case and spacing, which mean nothing to a printer", () => {
      const a = personalisationSignature([{ placement: "sleeve", text: "EVIE" }]);
      const b = personalisationSignature([{ placement: "sleeve", text: " evie " }]);
      expect(a).toBe(b);
    });

    it("distinguishes the same name in different places", () => {
      const front = personalisationSignature([{ placement: "front", text: "Evie" }]);
      const sleeve = personalisationSignature([{ placement: "sleeve", text: "Evie" }]);
      expect(front).not.toBe(sleeve);
    });
  });
});

// ---------------------------------------------------------------------------
// The server re-validates everything the browser validated, so the two copies
// have to agree. If they drift, a parent is told one thing and charged another.
describe("the client mirror and the server copy", () => {
  const CASES = [
    "Evie", "  Evie   Rose ", "", "   ", "O'Brien", "Anne-Marie", "Chloé",
    "Evie 🎀", "A".repeat(21), "=1+1", "-Evie", "Team 7", "‮evil",
  ];

  it("validate the same way for every case", async () => {
    const server = await import("../../supabase/functions/_shared/merchPersonalisation.ts");
    for (const c of CASES) {
      const a = server.validatePersonalisationText(c);
      const b = validatePersonalisationText(c);
      expect(b.ok, `ok differs for ${JSON.stringify(c)}`).toBe(a.ok);
      expect(b.value, `value differs for ${JSON.stringify(c)}`).toBe(a.value);
      expect(b.error, `error differs for ${JSON.stringify(c)}`).toBe(a.error);
    }
  });

  it("price and sign identically", async () => {
    const server = await import("../../supabase/functions/_shared/merchPersonalisation.ts");
    expect(server.personalisationPence([3, 2.995])).toBe(personalisationPence([3, 2.995]));
    expect(server.DEFAULT_PERSONALISATION_PRICE).toBe(DEFAULT_PERSONALISATION_PRICE);
    expect(server.MAX_PERSONALISATION_LENGTH).toBe(MAX_PERSONALISATION_LENGTH);
    const choices = [
      { placement: "sleeve" as const, text: " EVIE " },
      { placement: "front" as const, text: "7" },
    ];
    expect(server.personalisationSignature(choices)).toBe(personalisationSignature(choices));
  });
});
