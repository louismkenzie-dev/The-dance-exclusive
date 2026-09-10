import { describe, expect, it } from "vitest";
// The rule lives with the edge functions, because that is where a booking is
// actually created. It is pure and imports nothing, so it can be tested here
// alongside everything else rather than going unchecked.
import { chooseInvite, type InviteRow } from "../../supabase/functions/_shared/invites";

const inv = (id: string, student_id: string | null, plan: string | null): InviteRow => ({ id, student_id, plan });

describe("chooseInvite", () => {
  it("spends nothing when there is nothing pending", () => {
    expect(chooseInvite([], "asher", "trial")).toBeNull();
  });

  it("spends the invite saved for this child", () => {
    const rows = [inv("i1", "asher", "trial")];
    expect(chooseInvite(rows, "asher", "trial")?.id).toBe("i1");
  });

  it("never spends a place saved for a different child", () => {
    const rows = [inv("i1", "sibling", "trial")];
    expect(chooseInvite(rows, "asher", "trial")).toBeNull();
  });

  it("spends an invite named for the family as a whole", () => {
    const rows = [inv("i1", null, "trial")];
    expect(chooseInvite(rows, "asher", "trial")?.id).toBe("i1");
  });

  it("prefers the plan actually bought over the oldest", () => {
    // Oldest first, as the caller orders them.
    const rows = [inv("old-session", "asher", "session"), inv("new-trial", "asher", "trial")];
    expect(chooseInvite(rows, "asher", "trial")?.id).toBe("new-trial");
  });

  it("falls back to the oldest when no plan matches", () => {
    const rows = [inv("old", "asher", "session"), inv("newer", "asher", "session")];
    expect(chooseInvite(rows, "asher", "monthly")?.id).toBe("old");
  });

  it("spends only one, so two payment links on one class are not both cleared", () => {
    const rows = [inv("link-a", "asher", "session"), inv("link-b", "asher", "session")];
    const first = chooseInvite(rows, "asher", "session");
    expect(first?.id).toBe("link-a");
    // The second survives for its own payment.
    expect(chooseInvite(rows.filter((r) => r.id !== first?.id), "asher", "session")?.id).toBe("link-b");
  });

  it("handles a booking with no attendee (adult self-booking with a family invite)", () => {
    expect(chooseInvite([inv("i1", null, "session")], null, "session")?.id).toBe("i1");
    expect(chooseInvite([inv("i1", "asher", "session")], null, "session")).toBeNull();
  });
});
