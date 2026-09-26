import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { HomeClassFinder, HomeLocations } from "./HomeDiscovery";
import type { PublicClass, PublicSchool, PublicVenue } from "@/lib/publicSchool";

const venues = [
  { id: "hall", name: "Town Hall", city: "Chelmsford", slug: "town-hall", address_line1: "High Street", postcode: "CM1" },
  { id: "school", name: "School Studio", city: "Chelmsford", slug: "school", address_line1: "School Road", postcode: "CM2" },
  { id: "other", name: "Other Hall", city: "Brentwood", slug: "other" },
] as PublicVenue[];
const makeClass = (class_type: "adult" | "children", name: string): PublicClass => ({
  id: class_type, name, class_type, venue_id: "hall", age_min: class_type === "adult" ? 18 : 6,
  age_max: null, school_year_min: null, school_year_max: null, audience_label: null,
  start_time: "17:00:00", end_time: "18:00:00", day_of_week: "monday", days_of_week: ["monday"],
  price_per_session: 8, allow_monthly: false, allow_termly: false, allow_yearly: false,
  remainingSessions: 10,
} as PublicClass);
const school = { classes: [makeClass("children", "Junior street"), makeClass("adult", "Adult commercial")], venues } as PublicSchool;
afterEach(cleanup);

describe("homepage discovery", () => {
  it("switches the results and destination together, retaining eligibility and schedule", () => {
    render(<MemoryRouter><HomeClassFinder school={school} loading={false} error={false} /></MemoryRouter>);
    expect(screen.getByText("Ages 6+", { exact: false })).toBeVisible();
    expect(screen.getByText(/17:00/)).toBeVisible();
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

  it("groups every venue in a town and links to the actual venue", () => {
    render(<MemoryRouter><HomeLocations school={school} loading={false} error={false} /></MemoryRouter>);
    const select = screen.getByRole("combobox", { name: /Where would you like to dance/ });
    expect(within(select).getAllByRole("option")).toHaveLength(3);
    fireEvent.change(select, { target: { value: "chelmsford" } });
    expect(screen.getByRole("link", { name: /Town Hall/ })).toHaveAttribute("href", "/venues/town-hall");
    expect(screen.getByRole("link", { name: /School Studio/ })).toHaveAttribute("href", "/venues/school");
    expect(screen.queryByRole("link", { name: /Other Hall/ })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "brentwood" } });
    expect(screen.getByRole("link", { name: /Other Hall/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Town Hall/ })).not.toBeInTheDocument();
  });
});
