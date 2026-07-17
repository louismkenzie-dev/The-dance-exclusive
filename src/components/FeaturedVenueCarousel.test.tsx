import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The default export fetches from Supabase; the pure FeaturedVenueCards under
// test does not, but the module import must not construct a real client.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { FeaturedVenueCards, type FeaturedVenue } from "./FeaturedVenueCarousel";

const makeVenue = (overrides: Partial<FeaturedVenue> = {}): FeaturedVenue => ({
  id: crypto.randomUUID(),
  name: "Kelvedon Institute",
  city: "Kelvedon",
  county: "Essex",
  status: "confirmed",
  publicly_visible: true,
  is_featured: true,
  featured_order: 1,
  short_description: "Our Kelvedon home.",
  description: null,
  hero_image: null,
  photo_outside: null,
  ...overrides,
});

const renderCards = (venues: FeaturedVenue[]) =>
  render(
    <MemoryRouter>
      <FeaturedVenueCards venues={venues} />
    </MemoryRouter>,
  );

describe("FeaturedVenueCards", () => {
  it("renders featured venues in configured order with accessible controls", () => {
    renderCards([
      makeVenue({ name: "Second Venue", featured_order: 2 }),
      makeVenue({ name: "First Venue", featured_order: 1 }),
      makeVenue({ name: "Third Venue", featured_order: 3 }),
    ]);
    const cards = screen.getAllByTestId("featured-venue-card");
    expect(cards).toHaveLength(3);
    const names = cards.map((c) => c.querySelector("h3")?.textContent);
    expect(names).toEqual(["First Venue", "Second Venue", "Third Venue"]);
    expect(screen.getByRole("region", { name: /featured venues/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous featured venue/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next featured venue/i })).toBeInTheDocument();
  });

  it("hides provisional venues that are not explicitly public", () => {
    renderCards([
      makeVenue({ name: "Public Venue" }),
      makeVenue({ name: "Provisional Venue", status: "provisional", publicly_visible: false }),
    ]);
    expect(screen.getAllByTestId("featured-venue-card")).toHaveLength(1);
    expect(screen.queryByText("Provisional Venue")).not.toBeInTheDocument();
  });

  it("renders nothing when no venues are featured", () => {
    const { container } = renderCards([makeVenue({ is_featured: false })]);
    expect(container.querySelector("section")).toBeNull();
  });

  it("uses a fallback image when no asset is mapped", () => {
    renderCards([makeVenue({ hero_image: null, photo_outside: null })]);
    const img = screen.getByRole("img", { name: /kelvedon institute/i });
    expect(img).toHaveAttribute("src", "/placeholder.svg");
  });
});
