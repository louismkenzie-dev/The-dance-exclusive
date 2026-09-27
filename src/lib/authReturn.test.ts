import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./authReturn";

describe("authentication return paths", () => {
  it("preserves the selected class, filters and booking anchor", () => {
    expect(safeReturnPath("/classes/children/white-court?source=timetable#choose-place")).toBe("/classes/children/white-court?source=timetable#choose-place");
  });
  it.each([null, undefined, "", "https://elsewhere.test", "//elsewhere.test", "/\\elsewhere.test", "/\n/elsewhere.test", "javascript:alert(1)"])("rejects an unsafe return: %s", path => {
    expect(safeReturnPath(path)).toBe("/");
  });
});
