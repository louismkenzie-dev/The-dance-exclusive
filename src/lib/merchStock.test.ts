import { describe, it, expect } from "vitest";
import { tracksStock, variantInStock, itemInStock, availableQuantity, wouldOversell } from "./merchStock";

const printed = { tracks_stock: false };
const held = { tracks_stock: true };
const legacy = {}; // row read before the column exists

describe("merchStock", () => {
  describe("printed to order", () => {
    it("is in stock with zero on every size — the case the whole live catalogue is in", () => {
      const sizes = [
        { is_active: true, stock_quantity: 0 },
        { is_active: true, stock_quantity: 0 },
      ];
      expect(itemInStock(printed, sizes)).toBe(true);
      expect(variantInStock(printed, sizes[0])).toBe(true);
    });

    it("has no quantity limit and can never oversell", () => {
      expect(availableQuantity(printed, { stock_quantity: 0 })).toBeNull();
      expect(wouldOversell(printed, { stock_quantity: 0 }, 50)).toBe(false);
    });

    it("still respects a size being switched off", () => {
      expect(variantInStock(printed, { is_active: false, stock_quantity: 0 })).toBe(false);
      expect(itemInStock(printed, [{ is_active: false, stock_quantity: 0 }])).toBe(false);
    });
  });

  describe("stock actually held", () => {
    it("sells out at zero", () => {
      expect(itemInStock(held, [{ is_active: true, stock_quantity: 0 }])).toBe(false);
      expect(variantInStock(held, { is_active: true, stock_quantity: 0 })).toBe(false);
      expect(itemInStock(held, [{ is_active: true, stock_quantity: 2 }])).toBe(true);
    });

    it("is in stock when any one size has some left", () => {
      expect(itemInStock(held, [
        { is_active: true, stock_quantity: 0 },
        { is_active: true, stock_quantity: 1 },
      ])).toBe(true);
    });

    it("caps the quantity and spots an oversell", () => {
      expect(availableQuantity(held, { stock_quantity: 3 })).toBe(3);
      expect(wouldOversell(held, { stock_quantity: 3 }, 3)).toBe(false);
      expect(wouldOversell(held, { stock_quantity: 3 }, 4)).toBe(true);
    });

    it("never reports negative availability after an oversell", () => {
      expect(availableQuantity(held, { stock_quantity: -2 })).toBe(0);
    });
  });

  describe("before the migration is applied", () => {
    it("treats a row with no tracks_stock exactly as it behaves today", () => {
      expect(tracksStock(legacy)).toBe(true);
      expect(tracksStock(null)).toBe(true);
      expect(itemInStock(legacy, [{ is_active: true, stock_quantity: 0 }])).toBe(false);
      expect(itemInStock(legacy, [{ is_active: true, stock_quantity: 5 }])).toBe(true);
    });
  });

  it("a product with no sizes is not buyable in either mode", () => {
    expect(itemInStock(printed, [])).toBe(false);
    expect(itemInStock(held, [])).toBe(false);
    expect(itemInStock(printed, null)).toBe(false);
  });
});
