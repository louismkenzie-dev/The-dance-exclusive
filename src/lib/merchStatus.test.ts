import { describe, it, expect } from "vitest";
import {
  MERCH_STATUSES, statusRank, isTerminal, canTransition, nextStatuses,
  rollupStatus, merchStatusLabel,
} from "./merchStatus";

describe("merchStatus", () => {
  // These ranks are copied from merch_order_rollup_status() in
  // 20260925150000_merch_orders.sql. If someone changes one side, this fails.
  it("ranks exactly as the SQL trigger does", () => {
    expect(statusRank("pending")).toBe(0);
    expect(statusRank("paid")).toBe(1);
    expect(statusRank("sent_to_print")).toBe(2);
    expect(statusRank("ready")).toBe(3);
    expect(statusRank("collected")).toBe(4);
    for (const off of ["expired", "cancelled", "refunded", "nonsense"]) {
      expect(statusRank(off), off).toBe(9);
    }
  });

  it("knows which states are final", () => {
    expect(["expired", "cancelled", "refunded"].every(isTerminal)).toBe(true);
    expect(["pending", "paid", "sent_to_print", "ready", "collected"].some(isTerminal)).toBe(false);
  });

  describe("transitions", () => {
    it("walks the happy path Amie described", () => {
      expect(canTransition("pending", "paid")).toBe(true);
      expect(canTransition("paid", "sent_to_print")).toBe(true);
      expect(canTransition("sent_to_print", "ready")).toBe(true);
      expect(canTransition("ready", "collected")).toBe(true);
    });

    it("refuses to skip a step", () => {
      expect(canTransition("paid", "ready")).toBe(false);
      expect(canTransition("paid", "collected")).toBe(false);
      expect(canTransition("pending", "sent_to_print")).toBe(false);
    });

    it("refuses to go backwards — a garment cannot un-print itself", () => {
      expect(canTransition("ready", "sent_to_print")).toBe(false);
      expect(canTransition("sent_to_print", "paid")).toBe(false);
      expect(canTransition("collected", "ready")).toBe(false);
    });

    it("treats a no-op as not a transition", () => {
      for (const s of MERCH_STATUSES) expect(canTransition(s, s), s).toBe(false);
    });

    it("lets nothing leave a final state", () => {
      for (const s of ["expired", "cancelled", "refunded"]) {
        expect(nextStatuses(s), s).toEqual([]);
      }
    });

    it("allows a refund from any paid state, including after hand-over", () => {
      for (const s of ["paid", "sent_to_print", "ready", "collected"]) {
        expect(canTransition(s, "refunded"), s).toBe(true);
      }
      // ...but not before the money arrived
      expect(canTransition("pending", "refunded")).toBe(false);
    });

    it("only expires something never paid for", () => {
      expect(canTransition("pending", "expired")).toBe(true);
      expect(canTransition("paid", "expired")).toBe(false);
    });

    it("rejects an unknown status rather than throwing", () => {
      expect(canTransition("nonsense", "paid")).toBe(false);
      expect(canTransition("paid", "nonsense")).toBe(false);
    });
  });

  describe("order rollup — the least-advanced live line", () => {
    it("matches the eight cases the SQL was checked against", () => {
      expect(rollupStatus(["paid", "paid"])).toBe("paid");
      expect(rollupStatus(["ready", "paid"])).toBe("paid");
      expect(rollupStatus(["ready", "ready"])).toBe("ready");
      expect(rollupStatus(["collected", "ready"])).toBe("ready");
      expect(rollupStatus(["collected", "collected"])).toBe("collected");
      expect(rollupStatus(["collected", "refunded"])).toBe("collected");
      expect(rollupStatus(["refunded", "refunded"])).toBe("refunded");
      expect(rollupStatus([])).toBe("pending");
    });

    it("ignores refunded and cancelled lines while anything is still live", () => {
      expect(rollupStatus(["refunded", "cancelled", "paid"])).toBe("paid");
    });

    it("falls back to the off-path lines when every line is off the path", () => {
      expect(rollupStatus(["cancelled", "expired"])).toBe("cancelled");
    });

    it("does not mutate the array it is given", () => {
      const lines = ["ready", "paid"];
      rollupStatus(lines);
      expect(lines).toEqual(["ready", "paid"]);
    });
  });

  it("labels every status in words Amie would use", () => {
    expect(merchStatusLabel("paid")).toBe("Waiting to print");
    expect(merchStatusLabel("sent_to_print")).toBe("At the printers");
    expect(merchStatusLabel("ready")).toBe("Ready to hand out");
    for (const s of MERCH_STATUSES) {
      expect(merchStatusLabel(s), s).not.toBe(s); // never shows the raw slug
    }
  });
});

// ---------------------------------------------------------------------------
describe("the client mirror and the server copy", () => {
  it("agree on ranks, transitions and rollup", async () => {
    const server = await import("../../supabase/functions/_shared/merchStatus.ts");
    for (const a of [...MERCH_STATUSES, "nonsense"]) {
      expect(server.statusRank(a), a).toBe(statusRank(a));
      expect(server.nextStatuses(a), a).toEqual(nextStatuses(a));
      for (const b of MERCH_STATUSES) {
        expect(server.canTransition(a, b), `${a}->${b}`).toBe(canTransition(a, b));
      }
    }
    for (const lines of [["paid", "ready"], ["refunded", "collected"], [], ["cancelled"]]) {
      expect(server.rollupStatus(lines), lines.join()).toBe(rollupStatus(lines));
    }
  });
});
