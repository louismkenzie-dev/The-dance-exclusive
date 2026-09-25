import { describe, it, expect } from "vitest";
import {
  MERCH_SIZES, compareSizes, printRunRows, aggregate, totalGarments,
  personalisedCount, printRunCsvRows, PRINT_RUN_HEADER, type PrintLine,
} from "./merchPrintRun";
import { toCsv } from "./merchCsv";

const line = (o: Partial<PrintLine>): PrintLine => ({
  order_number: 1, product_name: "Splat Hoodie", size: "M", quantity: 1, attendee_name: "Evie", ...o,
});

describe("merchPrintRun", () => {
  describe("size ordering — the thing that mis-counts a batch if it is wrong", () => {
    it("puts Age 9-10 before Age 11-12, which alphabetical sorting does not", () => {
      const sorted = ["Age 11-12", "Age 9-10", "Age 3-4"].sort(compareSizes);
      expect(sorted).toEqual(["Age 3-4", "Age 9-10", "Age 11-12"]);
      // prove the naive version would have been wrong
      expect(["Age 11-12", "Age 9-10"].sort()).toEqual(["Age 11-12", "Age 9-10"]);
    });

    it("orders adult sizes small to large, not alphabetically", () => {
      const sorted = ["XL", "S", "XXL", "M", "XS", "L"].sort(compareSizes);
      expect(sorted).toEqual(["XS", "S", "M", "L", "XL", "XXL"]);
    });

    it("keeps the studio's own list as the source of truth", () => {
      const sorted = [...MERCH_SIZES].reverse().sort(compareSizes);
      expect(sorted).toEqual(MERCH_SIZES);
    });

    it("puts an unrecognised size last rather than dropping it", () => {
      const sorted = ["Toddler", "M", "One Size"].sort(compareSizes);
      expect(sorted).toEqual(["M", "One Size", "Toddler"]);
    });

    it("is case and whitespace tolerant", () => {
      expect(compareSizes(" m ", "M")).toBe(0);
      expect(compareSizes("age 9-10", "Age 11-12")).toBeLessThan(0);
    });

    it("handles null and empty without throwing", () => {
      expect(() => ["M", null, undefined, ""].sort(compareSizes as never)).not.toThrow();
    });
  });

  describe("rows", () => {
    it("pivots personalisation into fixed columns", () => {
      const rows = printRunRows([
        line({ personalisations: [{ placement: "sleeve", text: "Evie" }, { placement: "front", text: "7" }] }),
      ]);
      expect(rows[0]).toMatchObject({ front: "7", back: "", sleeve: "Evie" });
    });

    it("leaves all three columns blank when nothing was personalised", () => {
      const rows = printRunRows([line({})]);
      expect(rows[0]).toMatchObject({ front: "", back: "", sleeve: "" });
    });

    it("sorts by product, then size, then dancer", () => {
      const rows = printRunRows([
        line({ product_name: "Tee", size: "Age 11-12", attendee_name: "Zara" }),
        line({ product_name: "Hoodie", size: "M", attendee_name: "Bea" }),
        line({ product_name: "Tee", size: "Age 9-10", attendee_name: "Amy" }),
        line({ product_name: "Hoodie", size: "M", attendee_name: "Ali" }),
      ]);
      expect(rows.map((r) => `${r.product}/${r.size}/${r.dancer}`)).toEqual([
        "Hoodie/M/Ali", "Hoodie/M/Bea", "Tee/Age 9-10/Amy", "Tee/Age 11-12/Zara",
      ]);
    });

    it("never emits a negative or fractional quantity", () => {
      const rows = printRunRows([line({ quantity: -3 }), line({ quantity: 2.7 })]);
      expect(rows.map((r) => r.quantity).sort()).toEqual([0, 2]);
    });

    it("copes with a line whose product or dancer is missing", () => {
      const rows = printRunRows([{ quantity: 1 }]);
      expect(rows[0]).toMatchObject({ product: "", dancer: "", size: "", order: "" });
    });
  });

  describe("aggregate for the covering email", () => {
    it("totals by product and size", () => {
      const agg = aggregate([
        line({ product_name: "Hoodie", size: "Age 9-10", quantity: 2 }),
        line({ product_name: "Hoodie", size: "Age 9-10", quantity: 1 }),
        line({ product_name: "Hoodie", size: "Age 11-12", quantity: 1 }),
      ]);
      expect(agg).toEqual([
        { product: "Hoodie", size: "Age 9-10", quantity: 3 },
        { product: "Hoodie", size: "Age 11-12", quantity: 1 },
      ]);
    });

    it("does not merge the same size across different products", () => {
      const agg = aggregate([
        line({ product_name: "Hoodie", size: "M", quantity: 1 }),
        line({ product_name: "Tee", size: "M", quantity: 1 }),
      ]);
      expect(agg).toHaveLength(2);
    });

    it("counts garments, and how many carry a name", () => {
      const lines = [
        line({ quantity: 2, personalisations: [{ placement: "sleeve", text: "Evie" }] }),
        line({ quantity: 3 }),
      ];
      expect(totalGarments(lines)).toBe(5);
      expect(personalisedCount(lines)).toBe(2);
    });

    it("is empty for an empty run rather than throwing", () => {
      expect(aggregate([])).toEqual([]);
      expect(totalGarments([])).toBe(0);
      expect(personalisedCount([])).toBe(0);
    });
  });

  describe("the file Laurence opens", () => {
    it("produces a CSV whose columns cannot shift, even with hostile text", () => {
      const csv = toCsv(PRINT_RUN_HEADER, printRunCsvRows([
        line({ order_number: 1207, attendee_name: "Clark, Christina", size: "Age 9-10",
               personalisations: [{ placement: "sleeve", text: "-Evie" }] }),
        line({ order_number: 1208, attendee_name: "Jack", product_name: "Splat Tee", size: "Age 7-8",
               quantity: 2, personalisations: [{ placement: "front", text: "=BAD()" }] }),
      ]));
      const body = csv.replace("﻿", "").trimEnd().split("\r\n");
      expect(body[0]).toBe("Order,Dancer,Product,Size,Qty,Front,Back,Sleeve");
      expect(body).toHaveLength(3);
      expect(csv).toContain('"Clark, Christina"'); // comma quoted, so Size does not slide a column
      expect(csv).toContain("'-Evie");             // leading hyphen neutralised
      expect(csv).toContain("'=BAD()");            // formula neutralised
    });

    it("has one row per line, not per garment — quantity is a column", () => {
      const rows = printRunCsvRows([line({ quantity: 5 })]);
      expect(rows).toHaveLength(1);
      expect(rows[0][4]).toBe(5);
    });
  });
});

// ---------------------------------------------------------------------------
describe("the client mirror and the server copy", () => {
  it("aggregate and sort identically", async () => {
    const server = await import("../../supabase/functions/_shared/merchPrintRun.ts");
    const lines = [
      line({ product_name: "Tee", size: "Age 11-12" }),
      line({ product_name: "Hoodie", size: "XL", quantity: 3,
             personalisations: [{ placement: "back", text: "Evie" }] }),
      line({ product_name: "Tee", size: "Age 9-10" }),
    ];
    expect(server.printRunRows(lines)).toEqual(printRunRows(lines));
    expect(server.aggregate(lines)).toEqual(aggregate(lines));
    expect(server.totalGarments(lines)).toBe(totalGarments(lines));
    expect(server.MERCH_SIZES).toEqual(MERCH_SIZES);
    expect(["Age 11-12", "Age 9-10"].sort(server.compareSizes))
      .toEqual(["Age 11-12", "Age 9-10"].sort(compareSizes));
  });
});
