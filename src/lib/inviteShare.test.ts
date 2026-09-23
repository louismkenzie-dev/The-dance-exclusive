import { describe, expect, it } from "vitest";
import { accountBookingsUrl, describeDates, inviteMessage } from "./inviteShare";

const ORIGIN = "https://app.thedanceexclusive.co.uk";

describe("accountBookingsUrl", () => {
  it("points at the family's bookings page", () => {
    expect(accountBookingsUrl(ORIGIN)).toBe("https://app.thedanceexclusive.co.uk/account/bookings");
  });
  it("never doubles the slash", () => {
    expect(accountBookingsUrl("https://app.thedanceexclusive.co.uk/")).toBe(
      "https://app.thedanceexclusive.co.uk/account/bookings",
    );
  });
  it("never produces the www address two parents were sent", () => {
    expect(accountBookingsUrl(ORIGIN)).not.toContain("www.");
  });
});

describe("describeDates", () => {
  it("reads as a day a parent recognises", () => {
    expect(describeDates(["2026-09-16"])).toBe("Wed 16 Sep");
  });
  it("sorts, whatever order they were picked in", () => {
    expect(describeDates(["2026-09-30", "2026-09-23"])).toBe("Wed 23 Sep, Wed 30 Sep");
  });
  it("shortens a long run rather than filling the message", () => {
    expect(describeDates(["2026-09-23", "2026-09-30", "2026-10-07", "2026-10-14"]))
      .toBe("Wed 23 Sep, Wed 30 Sep, Wed 7 Oct +1 more");
  });
  it("says nothing when the plan has no dates of its own", () => {
    expect(describeDates(null)).toBe("");
    expect(describeDates([])).toBe("");
  });
});

describe("inviteMessage — Kirsty's £10, the one that went missing", () => {
  it("is the message Amie can paste straight into WhatsApp", () => {
    expect(inviteMessage({
      parentName: "Kirsty McAlpine",
      className: "All Levels Hip Hop",
      dates: ["2026-09-16"],
      total: 10,
      origin: ORIGIN,
    })).toBe(
      "Hi Kirsty, here's the link to pay for All Levels Hip Hop (Wed 16 Sep) — £10.00. "
      + "It's waiting in your account: https://app.thedanceexclusive.co.uk/account/bookings",
    );
  });

  it("rebuilds identically however many times it is reshared", () => {
    const details = { parentName: "Kirsty McAlpine", className: "All Levels Hip Hop", dates: ["2026-09-16"], total: 10, origin: ORIGIN };
    expect(inviteMessage(details)).toBe(inviteMessage(details));
  });
});

describe("inviteMessage — the awkward ones", () => {
  it("drops the price when the checkout will work it out", () => {
    const msg = inviteMessage({ parentName: "Jo Bloggs", className: "Ballet", dates: ["2026-10-05"], total: 0, origin: ORIGIN });
    expect(msg).toBe("Hi Jo, here's the link to pay for Ballet (Mon 5 Oct). It's waiting in your account: " + accountBookingsUrl(ORIGIN));
    expect(msg).not.toContain("£");
  });
  it("drops the dates for a plan that has none (monthly, termly)", () => {
    expect(inviteMessage({ parentName: "Jo", className: "Ballet", dates: null, total: 27, origin: ORIGIN }))
      .toContain("pay for Ballet — £27.00.");
  });
  it("still reads as a message when a name is missing", () => {
    expect(inviteMessage({ parentName: null, className: null, origin: ORIGIN }))
      .toBe("Hi there, here's the link to pay for the class. It's waiting in your account: " + accountBookingsUrl(ORIGIN));
  });
  it("shows pence, because £10.5 is not a price", () => {
    expect(inviteMessage({ parentName: "Jo", className: "Ballet", total: 10.5, origin: ORIGIN })).toContain("£10.50.");
  });
});
