import { describe, expect, it } from "vitest";
import { classForecasts, type ForecastMembership } from "./classForecast";

const m = (class_id: string, sub: string | null, amount: number | string, status = "active"): ForecastMembership => ({
  class_id,
  stripe_subscription_id: sub,
  monthly_amount: amount,
  status,
});

describe("classForecasts", () => {
  it("splits a capped family evenly, so a £0 line still earns its share", () => {
    // Brooke's shape: £110 across four classes, two of them made free by the cap.
    const f = classForecasts([
      m("hiphop", "sub_1", 30.6),
      m("street", "sub_1", 30.6),
      m("lyrical", "sub_1", 48.8),
      m("comp", "sub_1", 0),
    ]);
    expect(["hiphop", "street", "lyrical", "comp"].map((c) => f.get(c)!.monthlyPence)).toEqual([2750, 2750, 2750, 2750]);
  });

  it("never loses a penny when the split does not divide", () => {
    const f = classForecasts([m("a", "sub_1", 50), m("b", "sub_1", 50), m("c", "sub_1", 0)]);
    const total = ["a", "b", "c"].reduce((s, c) => s + f.get(c)!.monthlyPence, 0);
    expect(total).toBe(10000);
  });

  it("adds up several families on one class", () => {
    const f = classForecasts([m("tots", "sub_1", 27.2), m("tots", "sub_2", 27.2), m("tots", "sub_3", 30.6)]);
    expect(f.get("tots")).toEqual({ monthlyPence: 8500, members: 3, notCounted: 0 });
  });

  it("counts two siblings in the same class as two members", () => {
    const f = classForecasts([m("tots", "sub_1", 27.2), m("tots", "sub_1", 27.2)]);
    expect(f.get("tots")).toEqual({ monthlyPence: 5440, members: 2, notCounted: 0 });
  });

  it("leaves paused, leaving and never-paid memberships out of the figure, but counts them", () => {
    const f = classForecasts([
      m("street", "sub_1", 30.6),
      m("street", "sub_2", 26.35, "paused"),
      m("street", "sub_3", 27.2, "cancel_scheduled"),
      m("street", "sub_4", 30.6, "incomplete"),
      m("street", "sub_5", 30.6, "cancelled"),
    ]);
    expect(f.get("street")).toEqual({ monthlyPence: 3060, members: 1, notCounted: 3 });
  });

  it("does not spread a family's money onto a class they are leaving", () => {
    const f = classForecasts([m("a", "sub_1", 30.6), m("b", "sub_1", 27.2, "cancel_scheduled")]);
    expect(f.get("a")!.monthlyPence).toBe(3060);
    expect(f.get("b")!.monthlyPence).toBe(0);
  });

  it("treats a membership with no subscription as its own family", () => {
    const f = classForecasts([m("a", null, 30.6), m("a", null, 27.2)]);
    expect(f.get("a")!.monthlyPence).toBe(5780);
  });

  it("reads numeric columns that arrive as strings, and skips memberships with no class", () => {
    const f = classForecasts([m("a", "sub_1", "30.60"), { ...m("x", "sub_1", 99), class_id: null }]);
    expect(f.get("a")!.monthlyPence).toBe(3060);
    expect(f.size).toBe(1);
  });
});
