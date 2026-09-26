import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CoachPhotoGrid } from "./CoachProfiles";
import { FOUNDER_COACH_ID } from "@/lib/publicCoaches";
import type { PublicCoach } from "@/lib/publicSchool";

const amie: PublicCoach = { id: FOUNDER_COACH_ID, first_name: "Amie", role: "ceo_owner", profile_photo: null, description: "Amie's complete published biography.", dance_skills: ["Street"] };
afterEach(cleanup);

describe("touch and keyboard coach biographies", () => {
  it("opens the full Founder biography without leaving the grid, and closes it", () => {
    render(<MemoryRouter><CoachPhotoGrid coaches={[amie]} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Meet Amie, Founder/ }));
    expect(screen.getByRole("dialog", { name: "Amie" })).toBeVisible();
    expect(screen.getByRole("dialog")).toHaveTextContent(amie.description!);
    expect(screen.getByRole("link", { name: /Explore Amie's classes/ })).toHaveAttribute("href", `/team/${FOUNDER_COACH_ID}`);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps every published coach and handles a missing biography honestly", () => {
    const coaches = Array.from({ length: 12 }, (_, i) => ({ ...amie, id: `coach-${i}`, first_name: `Coach ${i}`, role: "instructor", description: null }));
    render(<MemoryRouter><CoachPhotoGrid coaches={coaches} /></MemoryRouter>);
    expect(screen.getAllByRole("button", { name: /Open biography/ })).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: /Meet Coach 0,/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("A biography hasn't been added yet");
    expect(screen.getByRole("link", { name: /Explore Coach 0's classes/ })).toHaveAttribute("href", "/team/coach-0");
  });
});
