import { describe, expect, it } from "vitest";
import { FOUNDER_COACH_ID, isFounderCoach, orderPublicCoaches, publicCoachTitle } from "./publicCoaches";
import type { PublicCoach } from "./publicSchool";

const coach = (id: string, first_name: string, role = "instructor"): PublicCoach => ({
  id, first_name, role, description: null, profile_photo: null, dance_skills: [],
});

describe("public team presentation", () => {
  it("features the published Amie record first without changing staff roles or input order", () => {
    const members = [coach("brad", "Brad"), coach(FOUNDER_COACH_ID, "Amie", "ceo_owner"), coach("boo", "Boo")];
    const ordered = orderPublicCoaches(members);
    expect(ordered.map((item) => item.first_name)).toEqual(["Amie", "Boo", "Brad"]);
    expect(members[0].first_name).toBe("Brad");
    expect(ordered[0].role).toBe("ceo_owner");
    expect(publicCoachTitle(ordered[0])).toBe("Founder");
  });

  it("never recreates a withdrawn founder or promotes another coach with the same name", () => {
    const members = [coach("another-amie", "Amie"), coach("director", "School director", "ceo_owner")];
    expect(orderPublicCoaches(members).find(isFounderCoach)).toBeUndefined();
    expect(members.map(publicCoachTitle)).toEqual(["Dance coach", "School director"]);
    expect(orderPublicCoaches([])).toEqual([]);
  });
});
