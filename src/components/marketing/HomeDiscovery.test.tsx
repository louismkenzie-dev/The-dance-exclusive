import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeClassFinder, HomeLocations } from "./HomeDiscovery";
import type { PublicClass, PublicSchool, PublicVenue } from "@/lib/publicSchool";

const venues = [
  { id: "hall", name: "Town Hall", city: "Chelmsford", slug: "town-hall", address_line1: "High Street", postcode: "CM1 1AA", latitude: 51.8, longitude: 0.5 },
  { id: "school", name: "School Studio", city: "Chelmsford", slug: "school", address_line1: "School Road", postcode: "CM2 1AA", latitude: 51.7, longitude: 0.5 },
  { id: "other", name: "Other Hall", city: "Brentwood", slug: "other", latitude: 51.6, longitude: 0.5 },
] as PublicVenue[];
const makeClass = (class_type: "adult" | "children", name: string): PublicClass => ({
  id: class_type, name, class_type, venue_id: "hall", age_min: class_type === "adult" ? 18 : 6,
  age_max: null, school_year_min: null, school_year_max: null, audience_label: null,
  start_time: "17:00:00", end_time: "18:00:00", day_of_week: "monday", days_of_week: ["monday"],
  price_per_session: 8, allow_monthly: false, allow_termly: false, allow_yearly: false,
  remainingSessions: 10,
  sessions: [{ id: `${class_type}-date`, session_date: "2026-10-05", start_time: "17:00:00", end_time: "18:00:00" }],
} as PublicClass);
const school = { classes: [makeClass("children", "Junior street"), makeClass("adult", "Adult commercial")], venues } as PublicSchool;
const locationsSchool = { ...school, classes: [...school.classes, { ...makeClass("children", "School street"), id: "school-class", venue_id: "school" }] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("homepage discovery", () => {
  it("switches the results and destination together, retaining eligibility and schedule", () => {
    render(<MemoryRouter><HomeClassFinder school={school} loading={false} error={false} /></MemoryRouter>);
    expect(screen.getByText("Ages 6+", { exact: false })).toBeVisible();
    expect(screen.getByText("5:00pm")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Adults" }));
    expect(screen.getByRole("button", { name: "Adults" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Adult commercial")).toBeVisible();
    expect(screen.queryByText("Junior street")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore all adult classes/ })).toHaveAttribute("href", "/classes?type=adult");
    expect(screen.getByText(/Ages 18\+/)).toBeVisible();
  });

  it("keeps an adult recovery path when adult results are empty", () => {
    render(<MemoryRouter><HomeClassFinder school={{ ...school, classes: [school.classes[0]] }} loading={false} error={false} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Adults" }));
    expect(screen.getByText(/No adult classes/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Ask the team/ })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: /Explore all adult classes/ })).toHaveAttribute("href", "/classes?type=adult");
  });

  it("uses postcode distance order and links to each actual venue, then clears", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 200, result: { latitude: 51.7, longitude: 0.5 } }) }));
    render(<MemoryRouter><HomeLocations school={locationsSchool} loading={false} error={false} /></MemoryRouter>);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Your postcode" }), { target: { value: "cm2 1aa" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText(/Closest clubs to CM2 1AA/);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/venues/school");
    expect(screen.getByText(/under a mile away/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Town Hall/ })).toHaveAttribute("href", "/venues/town-hall");
    fireEvent.click(screen.getByRole("button", { name: "Clear postcode" }));
    expect(screen.queryByRole("link", { name: /School Studio/ })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your postcode" })).toHaveValue("");
  });

  it("recovers from an invalid postcode without showing stale matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    render(<MemoryRouter><HomeLocations school={locationsSchool} loading={false} error={false} /></MemoryRouter>);
    fireEvent.change(screen.getByRole("textbox", { name: "Your postcode" }), { target: { value: "invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Postcode not found");
    await waitFor(() => expect(screen.getByRole("button", { name: "Search" })).toBeEnabled());
    expect(screen.queryByRole("link", { name: /Town Hall/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /All 3 locations/ })).toHaveAttribute("href", "/venues");
  });
});
