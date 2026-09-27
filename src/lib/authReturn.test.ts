import { describe, expect, it } from "vitest";
import { safeReturnPath, signInPath } from "./authReturn";

describe("authentication return paths", () => {
  it("preserves the selected class, filters and booking anchor", () => {
    expect(safeReturnPath("/classes/children/white-court?source=timetable#choose-place")).toBe("/classes/children/white-court?source=timetable#choose-place");
  });
  it.each([null, undefined, "", "https://elsewhere.test", "//elsewhere.test", "/\\elsewhere.test", "/\n/elsewhere.test", "javascript:alert(1)"])("rejects an unsafe return: %s", path => {
    expect(safeReturnPath(path)).toBe("/");
  });
});

describe("sign-in task continuity", () => {
  it.each(["/checkout", "/classes/adult?camp=workshop-1", "/book/class-1?source=timetable#choose-place", "/classes?type=children&venue=school"])('keeps %s as a same-origin return', (path) => {
    const query = new URL(signInPath(path), "https://preview.example").searchParams;
    expect(query.get("redirect")).toBe(path);
  });
  it("keeps the requested signup mode and rejects external redirects", () => {
    const query = new URL(signInPath("https://other.example", "signup"), "https://preview.example").searchParams;
    expect(query.get("redirect")).toBe("/");
    expect(query.get("mode")).toBe("signup");
  });
});
