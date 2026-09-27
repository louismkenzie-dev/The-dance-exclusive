import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotionMedia } from "./MotionMedia";

let intersect: (entries: { isIntersecting: boolean }[]) => void;
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const media = { image: "/poster.jpg", video: "/desktop.mp4", alt: "School dancers" };
describe("in-view film playback", () => {
  it("loads once near the viewport, then pauses without discarding its source", () => {
    const { container } = render(<MotionMedia {...media} />);
    expect(container.querySelector("video")).toBeNull();
    act(() => intersect([{ isIntersecting: true }]));
    const film = container.querySelector("video")!;
    expect(film).toHaveAttribute("src", "/desktop.mp4");
    expect(film.play).toHaveBeenCalled();
    act(() => intersect([{ isIntersecting: false }]));
    expect(film.pause).toHaveBeenCalled();
    expect(container.querySelector("video")).toBe(film);
    expect(film).toHaveAttribute("src", "/desktop.mp4");
    act(() => intersect([{ isIntersecting: true }]));
    expect(container.querySelector("video")).toBe(film);
    expect(film.play).toHaveBeenCalledTimes(2);
  });

  it("selects the phone rendition without requesting the desktop film", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: query === "(max-width: 760px)", media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
    const { container, rerender } = render(<MotionMedia {...media} mobileVideo="/mobile.mp4" eager />);
    const film = container.querySelector("video")!;
    expect(film).toHaveAttribute("src", "/mobile.mp4");
    expect(film.muted).toBe(true);
    expect(film).toHaveAttribute("playsinline");
    rerender(<MotionMedia {...media} mobileVideo="/mobile.mp4" eager active={false} />);
    expect(film.pause).toHaveBeenCalled();
    expect(container.querySelector("video")).toBe(film);
  });

  it("keeps a still and never mounts a player for reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: query.includes("prefers-reduced-motion"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
    const { container } = render(<MotionMedia {...media} eager />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")).toHaveAttribute("src", "/poster.jpg");
  });
});
