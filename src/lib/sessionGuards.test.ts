import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { countPinnedBookings, describeHold } from "./sessionGuards";

const sessions = [
  { id: "s1", class_id: "hiphop", session_date: "2026-09-03" },
  { id: "s2", class_id: "hiphop", session_date: "2026-09-10" },
  { id: "s3", class_id: "lyrical", session_date: "2026-09-03" },
];

describe("countPinnedBookings", () => {
  it("counts confirmed bookings pinned to the exact class and date", () => {
    const counts = countPinnedBookings(
      [
        { class_id: "hiphop", notes: "Trial | session 2026-09-03" },
        { class_id: "hiphop", notes: "Stripe PaymentIntent: pi_x | session 2026-09-03 | reminder sent" },
        { class_id: "hiphop", notes: "Class pass abc — session 2026-09-10" },
        { class_id: "lyrical", notes: "Trial | session 2026-09-10" },
      ],
      sessions,
    );
    expect(counts.get("s1")).toBe(2);
    expect(counts.get("s2")).toBe(1);
    // lyrical's 10 Sept has no session row in the list, so nothing to hold
    expect(counts.get("s3")).toBeUndefined();
  });

  it("ignores standing bookings (no pinned date) and blank notes", () => {
    const counts = countPinnedBookings(
      [
        { class_id: "hiphop", notes: "Stripe PaymentIntent: pi_y" },
        { class_id: "hiphop", notes: null },
        { class_id: "hiphop", notes: "Added by admin" },
      ],
      sessions,
    );
    expect(counts.size).toBe(0);
  });

  it("does not match a different class on the same date", () => {
    const counts = countPinnedBookings(
      [{ class_id: "street", notes: "Trial | session 2026-09-03" }],
      sessions,
    );
    expect(counts.size).toBe(0);
  });
});

describe("describeHold", () => {
  it("reads naturally for one or many", () => {
    expect(describeHold({ booked: 1, attended: 0 })).toBe("1 dancer booked");
    expect(describeHold({ booked: 3, attended: 0 })).toBe("3 dancers booked");
    expect(describeHold({ booked: 0, attended: 2 })).toBe("2 on the register");
    expect(describeHold({ booked: 2, attended: 1 })).toBe("2 dancers booked, 1 on the register");
  });
});
