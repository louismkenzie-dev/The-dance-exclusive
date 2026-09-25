import { describe, it, expect } from "vitest";
import { csvCell, csvRow, toCsv, csvToBase64, UTF8_BOM } from "./merchCsv";

describe("merchCsv", () => {
  describe("formula injection — parent-controlled text reaching the printer's Excel", () => {
    it.each([
      ["=1+1", "'=1+1"],
      ["=HYPERLINK(\"http://evil\",\"click\")", null], // quoted too; checked below
      ["+44 7700 900000", "'+44 7700 900000"],
      ["-Evie", "'-Evie"],
      ["@SUM(A1:A9)", "'@SUM(A1:A9)"],
      ["\tEvie", "'\tEvie"],
    ])("neutralises %s", (input, expected) => {
      const out = csvCell(input);
      expect(out.startsWith("'") || out.startsWith("\"'")).toBe(true);
      if (expected) expect(out).toBe(expected);
    });

    it("leaves an ordinary name completely alone", () => {
      expect(csvCell("Evie")).toBe("Evie");
      expect(csvCell("Anne-Marie")).toBe("Anne-Marie"); // hyphen inside is not a prefix
      expect(csvCell("Chloé")).toBe("Chloé");
    });

    it("escapes a formula that also needs quoting", () => {
      // both hazards at once: leading = and an embedded comma and quotes
      expect(csvCell('=HYPERLINK("http://x","go")')).toBe('"\'=HYPERLINK(""http://x"",""go"")"');
    });
  });

  describe("RFC 4180 quoting", () => {
    it("quotes commas, so columns cannot shift", () => {
      expect(csvCell("Smith, Evie")).toBe('"Smith, Evie"');
    });
    it("doubles embedded quotes", () => {
      expect(csvCell('Evie "Peach" Clark')).toBe('"Evie ""Peach"" Clark"');
    });
    it("quotes newlines", () => {
      expect(csvCell("Evie\nRose")).toBe('"Evie\nRose"');
      expect(csvCell("Evie\r\nRose")).toBe('"Evie\r\nRose"');
    });
    it("renders empties as an empty cell, not the word null", () => {
      expect(csvCell(null)).toBe("");
      expect(csvCell(undefined)).toBe("");
      expect(csvCell("")).toBe("");
      expect(csvCell(0)).toBe("0"); // a real zero quantity must survive
    });
  });

  describe("documents", () => {
    it("starts with a BOM so Excel reads accented names correctly", () => {
      const csv = toCsv(["Name"], [["Chloé"]]);
      expect(csv.startsWith(UTF8_BOM)).toBe(true);
      expect(csv).toContain("Chloé");
    });

    it("uses CRLF line endings", () => {
      const csv = toCsv(["A", "B"], [["1", "2"]]);
      expect(csv).toBe(`${UTF8_BOM}A,B\r\n1,2\r\n`);
    });

    it("writes a realistic print run without shifting a column", () => {
      const csv = toCsv(
        ["Order", "Dancer", "Product", "Size", "Qty", "Front", "Back", "Sleeve"],
        [
          [1207, "Clark, Christina", "Splat Front Hoodie", "Age 9-10", 1, "", "", "-Evie"],
          [1208, "Jack Smith", "Splat T-shirt", "Age 7-8", 2, "=BAD()", "", ""],
        ],
      );
      const lines = csv.replace(UTF8_BOM, "").trimEnd().split("\r\n");
      expect(lines).toHaveLength(3);
      // every row must have the same number of fields as the header once parsed
      expect(lines[1]).toContain('"Clark, Christina"');
      expect(lines[1]).toContain("'-Evie");
      expect(lines[2]).toContain("'=BAD()");
    });
  });

  describe("base64 for the email attachment", () => {
    it("round-trips plain text", () => {
      expect(atob(csvToBase64("A,B\r\n1,2\r\n"))).toBe("A,B\r\n1,2\r\n");
    });
    it("survives accented characters, which btoa alone cannot", () => {
      const csv = toCsv(["Name"], [["Chloé"]]);
      // ignoreBOM: true, or TextDecoder silently strips the BOM and the comparison fails on a
      // file that is actually byte-correct.
      const decoded = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
        Uint8Array.from(atob(csvToBase64(csv)), (c) => c.charCodeAt(0)),
      );
      expect(decoded).toBe(csv);
      expect(decoded).toContain("Chloé");
    });
  });
});

// ---------------------------------------------------------------------------
describe("the client mirror and the server copy", () => {
  it("escape identically", async () => {
    const server = await import("../../supabase/functions/_shared/merchCsv.ts");
    const CASES = ["Evie", "=1+1", "-Evie", "+44", "@X", "Smith, Evie", 'a"b', "a\nb", "Chloé", "", "\tx"];
    for (const c of CASES) {
      expect(server.csvCell(c), `differs for ${JSON.stringify(c)}`).toBe(csvCell(c));
    }
    expect(server.toCsv(["A"], [["=x"]])).toBe(toCsv(["A"], [["=x"]]));
    expect(server.csvToBase64("Chloé")).toBe(csvToBase64("Chloé"));
  });
});
