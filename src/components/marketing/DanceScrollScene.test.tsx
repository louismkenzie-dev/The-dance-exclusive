import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DanceScrollScene } from "./DanceScrollScene";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("mobile star scene", () => {
  it("pauses direct scroll scrubbing without collapsing or rebuilding the aperture", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: query.includes("pointer: coarse"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
    const view = (active: boolean) => <MemoryRouter><DanceScrollScene active={active} reduced={false} onToggle={() => {}} /></MemoryRouter>;
    const { container, rerender } = render(view(true));
    const aperture = container.querySelector<HTMLElement>(".tde-scroll-aperture")!;
    const clip = aperture.style.clipPath;
    expect(clip).toContain("polygon");
    rerender(view(false));
    expect(container.querySelector("section")).toHaveAttribute("data-enhanced", "true");
    expect(aperture.style.clipPath).toBe(clip);
    rerender(view(true));
    expect(container.querySelector(".tde-scroll-aperture")).toBe(aperture);
  });
});
