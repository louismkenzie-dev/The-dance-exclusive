import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollDanceStudio } from "./ScrollDanceStudio";
import { createDanceStudio } from "@/lib/danceStudio";

vi.mock("@/lib/danceStudio", () => ({ createDanceStudio: vi.fn() }));
const create = vi.mocked(createDanceStudio);

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
    observe() { this.callback([{ isIntersecting: true }]); }
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); create.mockReset(); });

describe("progressively enhanced Blender stage", () => {
  it("keeps a still and a way onward when WebGL cannot initialise", async () => {
    create.mockRejectedValue(new Error("WebGL unavailable"));
    const { container } = render(<ScrollDanceStudio active onToggle={() => {}} />);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("heading", { name: "Turn it up." })).toBeVisible();
    expect(screen.getByRole("link", { name: "Find your local class" })).toHaveAttribute("href", "#find-a-location");
    expect(container.querySelector("section")).toHaveAttribute("data-enhanced", "false");
    expect(container.querySelector("picture img")).toHaveAttribute("src", "/media/tde-animated-studio.jpg");
  });

  it("does not initialise WebGL when reduced motion is requested", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
    render(<ScrollDanceStudio active onToggle={() => {}} />);
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Pause motion" })).not.toBeInTheDocument();
  });

  it("aborts loading and releases the scene when navigating away", async () => {
    const dispose = vi.fn(); create.mockResolvedValue({ dispose, setProgress: vi.fn() });
    const { unmount } = render(<ScrollDanceStudio active onToggle={() => {}} />);
    await screen.findByRole("button", { name: "Pause motion" });
    const signal = create.mock.calls[0][2];
    unmount();
    expect(signal.aborted).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
