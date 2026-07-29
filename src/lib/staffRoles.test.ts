import { describe, expect, it } from "vitest";
import { compareStaffBySeniority, staffRoleRank } from "./staffRoles";

const member = (name: string, role: string | null) => ({ name, role });
const byName = (m: { name: string }) => m.name;
const order = (members: { name: string; role: string | null }[]) =>
  [...members].sort((a, b) => compareStaffBySeniority(a, b, byName)).map((m) => m.name);

describe("staffRoleRank", () => {
  it("ranks leadership above instructors above assistants", () => {
    expect(staffRoleRank("ceo_owner")).toBeLessThan(staffRoleRank("admin"));
    expect(staffRoleRank("admin")).toBeLessThan(staffRoleRank("instructor"));
    expect(staffRoleRank("instructor")).toBeLessThan(staffRoleRank("assistant_instructor"));
    expect(staffRoleRank("assistant_instructor")).toBeLessThan(staffRoleRank("assistant"));
    expect(staffRoleRank("assistant")).toBeLessThan(staffRoleRank("receptionist"));
  });

  it("puts custom and missing roles last", () => {
    expect(staffRoleRank("volunteer")).toBeLessThan(staffRoleRank("Guest DJ"));
    expect(staffRoleRank("Guest DJ")).toBeLessThan(staffRoleRank(null));
  });
});

describe("compareStaffBySeniority", () => {
  it("orders the real roster leadership → instructors → assistants", () => {
    expect(
      order([
        member("Jacob", "assistant_instructor"),
        member("Brad", "instructor"),
        member("Amie", "ceo_owner"),
        member("Imogen", "assistant_instructor"),
        member("Jane", "instructor"),
      ]),
    ).toEqual(["Amie", "Brad", "Jane", "Imogen", "Jacob"]);
  });

  it("sorts alphabetically within the same role", () => {
    expect(
      order([
        member("Leah", "instructor"),
        member("Boo", "instructor"),
        member("Ella", "instructor"),
      ]),
    ).toEqual(["Boo", "Ella", "Leah"]);
  });

  it("keeps choreographers with the teaching group, above assistants", () => {
    expect(
      order([
        member("Ash", "assistant"),
        member("Cass", "choreographer"),
        member("Bea", "instructor"),
      ]),
    ).toEqual(["Bea", "Cass", "Ash"]);
  });
});
