import { describe, it, expect } from "vitest";
import { DEFAULT_NAV_CONFIG, mergeNavConfig, type NavItem } from "./adminNavConfig";

describe("admin navigation merge", () => {
  const defaults: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/admin" },
    { id: "classes", label: "Classes", icon: "BookOpen", path: "/admin/classes" },
    { id: "awards", label: "Awards", icon: "Trophy", path: "/admin/awards" },
    {
      id: "users", label: "Users", icon: "Users", path: "",
      children: [
        { id: "staff", label: "Staff", icon: "UserCog", path: "/admin/staff" },
        { id: "students", label: "Students", icon: "GraduationCap", path: "/admin/students" },
      ],
    },
  ];

  it("adds pages the saved menu has never seen, at the end", () => {
    const saved: NavItem[] = [
      { id: "classes", label: "Our Classes", icon: "BookOpen", path: "/admin/classes" },
      { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/admin" },
    ];
    const merged = mergeNavConfig(saved, defaults);
    expect(merged.map((i) => i.id)).toEqual(["classes", "dashboard", "awards", "users"]);
  });

  it("leaves the studio's own order and labels alone", () => {
    const saved: NavItem[] = [
      { id: "classes", label: "Our Classes", icon: "Sparkles", path: "/admin/classes" },
    ];
    const merged = mergeNavConfig(saved, defaults);
    expect(merged[0]).toEqual({ id: "classes", label: "Our Classes", icon: "Sparkles", path: "/admin/classes" });
  });

  it("drops a new child into the group it belongs to", () => {
    const saved: NavItem[] = [
      {
        id: "users", label: "Users", icon: "Users", path: "",
        children: [{ id: "staff", label: "Staff", icon: "UserCog", path: "/admin/staff" }],
      },
    ];
    const merged = mergeNavConfig(saved, defaults);
    expect(merged[0].children?.map((c) => c.id)).toEqual(["staff", "students"]);
  });

  it("adds nothing when the saved menu is already complete", () => {
    expect(mergeNavConfig(defaults, defaults)).toHaveLength(defaults.length);
  });

  it("never loses a page a studio has hidden inside a group", () => {
    // "students" lives in the saved menu at the top level — it must not be
    // added a second time inside Users.
    const saved: NavItem[] = [
      { id: "students", label: "Students", icon: "GraduationCap", path: "/admin/students" },
      { id: "users", label: "Users", icon: "Users", path: "", children: [] },
    ];
    const merged = mergeNavConfig(saved, defaults);
    const ids = JSON.stringify(merged).match(/"students"/g) ?? [];
    expect(ids).toHaveLength(1);
  });

  it("keeps every real default reachable", () => {
    const merged = mergeNavConfig([], DEFAULT_NAV_CONFIG);
    expect(merged.map((i) => i.id)).toEqual(DEFAULT_NAV_CONFIG.map((i) => i.id));
  });
});
