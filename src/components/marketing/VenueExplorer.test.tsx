import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VenueExplorer } from "./VenueExplorer";
import type { PublicVenue } from "@/lib/publicSchool";
vi.mock("./VenueMapCanvas", () => ({ default: () => <div>Map</div> }));
let intersect: (entries: { isIntersecting: boolean }[]) => void;
const venues = ["One", "Two"].map((name, i) => ({ id: name, name, slug: name.toLowerCase(), city: "Essex", postcode: "CM1 1AA", address_line1: "1 Street", latitude: 51.7, longitude: .4 + i, hero_image: null })) as PublicVenue[];
function setup() { return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><VenueExplorer venues={venues} /></MemoryRouter></QueryClientProvider>); }
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", class { constructor(callback: typeof intersect) { intersect = callback; } observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("venue tour interaction", () => {
  it("cycles only in view and stops on manual selection", async () => {
    setup();
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByRole("heading", { name: "One" })).toBeVisible();
    await act(async () => intersect([{ isIntersecting: true }]));
    act(() => vi.advanceTimersByTime(5500));
    expect(screen.getByRole("heading", { name: "Two" })).toBeVisible();
    act(() => intersect([{ isIntersecting: false }]));
    act(() => vi.advanceTimersByTime(12000));
    expect(screen.getByRole("heading", { name: "Two" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Explore all 2 venues"), { target: { value: "One" } });
    act(() => vi.advanceTimersByTime(12000));
    expect(screen.getByRole("heading", { name: "One" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Play venue tour" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Explore venue & classes" })).toHaveAttribute("href", "/venues/one");
  });
  it("does not autoplay when reduced motion is requested", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ ...window.matchMedia(""), matches: true });
    setup();
    await act(async () => intersect([{ isIntersecting: true }]));
    act(() => vi.advanceTimersByTime(12000));
    expect(screen.getByRole("heading", { name: "One" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reduced motion" })).toBeDisabled();
  });
});
