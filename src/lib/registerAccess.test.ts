import { describe, expect, it } from "vitest";
import { isStudioLead, mergeSessions } from "./registerAccess";

const session = (id: string, session_date: string, start_time: string) => ({
  id,
  session_date,
  start_time,
});

describe("isStudioLead", () => {
  it("recognises an active ceo_owner", () => {
    expect(isStudioLead({ role: "ceo_owner", is_active: true })).toBe(true);
  });

  it("treats a missing is_active as active (the column defaults to true)", () => {
    expect(isStudioLead({ role: "ceo_owner" })).toBe(true);
  });

  it("excludes a deactivated owner", () => {
    expect(isStudioLead({ role: "ceo_owner", is_active: false })).toBe(false);
  });

  it("excludes every other role, including senior ones", () => {
    for (const role of ["admin", "instructor", "assistant_instructor", "assistant", "receptionist"]) {
      expect(isStudioLead({ role, is_active: true })).toBe(false);
    }
  });

  it("handles a missing staff record", () => {
    expect(isStudioLead(null)).toBe(false);
    expect(isStudioLead(undefined)).toBe(false);
    expect(isStudioLead({ role: null })).toBe(false);
  });
});

describe("mergeSessions", () => {
  it("keeps a class-level session even though someone else is booked on it", () => {
    // The regression this whole change exists for: an assistant assigned to
    // the class must still see the session when the main teacher has a
    // per-session row. The class-level query now returns it unfiltered.
    const classLevel = [session("s1", "2026-09-08", "17:15")];
    expect(mergeSessions([[], classLevel], { onDate: "2026-09-08" }).map((s) => s.id)).toEqual(["s1"]);
  });

  it("does not show a session twice when both queries return it", () => {
    const explicit = [session("s1", "2026-09-08", "17:15")];
    const classLevel = [session("s1", "2026-09-08", "17:15")];
    expect(mergeSessions([explicit, classLevel])).toHaveLength(1);
  });

  it("merges distinct sessions from both sources", () => {
    const explicit = [session("cover", "2026-09-08", "19:00")];
    const classLevel = [session("own", "2026-09-08", "17:15")];
    expect(mergeSessions([explicit, classLevel]).map((s) => s.id)).toEqual(["own", "cover"]);
  });

  it("sorts by date, then start time", () => {
    const rows = [
      session("c", "2026-09-15", "10:00"),
      session("b", "2026-09-08", "18:00"),
      session("a", "2026-09-08", "17:15"),
    ];
    expect(mergeSessions([rows]).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks ties on id so the order is stable across reloads", () => {
    const rows = [session("z", "2026-09-08", "17:15"), session("a", "2026-09-08", "17:15")];
    expect(mergeSessions([rows]).map((s) => s.id)).toEqual(["a", "z"]);
  });

  it("filters to a single date with onDate", () => {
    const rows = [session("a", "2026-09-08", "17:15"), session("b", "2026-09-15", "17:15")];
    expect(mergeSessions([rows], { onDate: "2026-09-08" }).map((s) => s.id)).toEqual(["a"]);
  });

  it("filters to upcoming dates with fromDate, keeping the boundary day", () => {
    const rows = [
      session("past", "2026-09-01", "17:15"),
      session("today", "2026-09-05", "17:15"),
      session("future", "2026-09-08", "17:15"),
    ];
    expect(mergeSessions([rows], { fromDate: "2026-09-05" }).map((s) => s.id)).toEqual(["today", "future"]);
  });

  it("clamps to a window with fromDate + toDate, keeping both boundary days", () => {
    const rows = [
      session("before", "2026-08-28", "17:15"),
      session("start", "2026-09-01", "17:15"),
      session("mid", "2026-09-08", "17:15"),
      session("end", "2026-09-22", "17:15"),
      session("after", "2026-09-23", "17:15"),
    ];
    expect(
      mergeSessions([rows], { fromDate: "2026-09-01", toDate: "2026-09-22" }).map((s) => s.id),
    ).toEqual(["start", "mid", "end"]);
  });

  it("survives null and undefined query results", () => {
    expect(mergeSessions([null, undefined, [session("a", "2026-09-08", "17:15")]])).toHaveLength(1);
    expect(mergeSessions([])).toEqual([]);
  });

  it("skips malformed rows rather than throwing", () => {
    const rows = [
      { id: "", session_date: "2026-09-08", start_time: "17:15" },
      { id: "ok", session_date: "", start_time: "17:15" },
      session("good", "2026-09-08", "17:15"),
    ];
    expect(mergeSessions(rows.length ? [rows] : []).map((s) => s.id)).toEqual(["good"]);
  });
});
