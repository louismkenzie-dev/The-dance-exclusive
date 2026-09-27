import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeIntro } from "./HomeIntro";

beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); history.replaceState({}, "", "/"); delete document.documentElement.dataset.homeIntro; });

describe("homepage brand arrival", () => {
  it("starts the page motion during the reveal, then releases the screen without waiting for media", () => {
    const reveal = vi.fn();
    render(<HomeIntro onReveal={reveal} />);
    expect(screen.getByRole("dialog", { name: "Welcome to The Dance Exclusive" })).toBeVisible();
    act(() => vi.advanceTimersByTime(1550));
    expect(reveal).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(700));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(reveal).toHaveBeenCalledOnce();
    expect(document.documentElement).not.toHaveAttribute("data-home-intro");
  });
  it("can be skipped immediately and does not replay on a return visit", () => {
    const reveal = vi.fn();
    const view = render(<HomeIntro onReveal={reveal} />);
    fireEvent.click(screen.getByRole("button", { name: /Skip intro/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(reveal).toHaveBeenCalledOnce();
    view.unmount();
    render(<HomeIntro onReveal={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("bypasses the intro for reduced motion", () => {
    const preference = window.matchMedia("");
    vi.spyOn(window, "matchMedia").mockReturnValue({ ...preference, matches: true });
    const reveal = vi.fn();
    render(<HomeIntro onReveal={reveal} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(reveal).toHaveBeenCalledOnce();
  });
  it("does not interrupt links to a homepage section", () => {
    history.replaceState({}, "", "/#find-your-class");
    const reveal = vi.fn();
    render(<HomeIntro onReveal={reveal} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(reveal).toHaveBeenCalledOnce();
  });
});
