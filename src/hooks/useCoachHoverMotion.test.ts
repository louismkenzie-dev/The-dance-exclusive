import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { stepCoachSpring, useCoachHoverMotion } from "./useCoachHoverMotion";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("coach hover spring", () => {
  it("resets and cancels motion when reduced motion or touch mode becomes active", () => {
    const preference = { ...window.matchMedia(""), matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.spyOn(window, "matchMedia").mockReturnValue(preference);
    let tick: FrameRequestCallback = () => {};
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { tick = callback; return 1; });
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const card = document.createElement("button");
    const ref = { current: card };
    renderHook(() => useCoachHoverMotion(ref));
    const enter = new Event("pointerenter");
    Object.defineProperty(enter, "pointerType", { value: "mouse" });
    card.dispatchEvent(enter);
    tick(16);
    expect(Number(card.style.getPropertyValue("--coach-hover"))).toBeGreaterThan(0);
    preference.matches = false;
    preference.addEventListener.mock.calls[0][1]();
    expect(card).not.toHaveAttribute("data-coach-motion");
    expect(card.style.getPropertyValue("--coach-hover")).toBe("0");
    expect(cancel).toHaveBeenCalledWith(1);
  });
  it("travels the same distance at 60Hz and 120Hz", () => {
    const simulate = (rate: number) => {
      let state = { position: 0, velocity: 0 };
      for (let frame = 0; frame < rate / 2; frame++) state = stepCoachSpring(state.position, state.velocity, 1, 1 / rate);
      return state;
    };
    expect(simulate(60).position).toBeCloseTo(simulate(120).position, 8);
    expect(simulate(60).velocity).toBeCloseTo(simulate(120).velocity, 8);
  });
  it("preserves momentum on an interrupted hover, then settles without bouncing", () => {
    let state = stepCoachSpring(0, 0, 1, 0.05);
    const entry = state.position;
    state = stepCoachSpring(state.position, state.velocity, 0, 1 / 120);
    expect(state.position).toBeGreaterThan(entry);
    for (let frame = 0; frame < 120; frame++) {
      state = stepCoachSpring(state.position, state.velocity, 0, 1 / 120);
      expect(state.position).toBeGreaterThanOrEqual(0);
      expect(state.position).toBeLessThan(1);
    }
    expect(state.position).toBeLessThan(0.001);
  });
});
