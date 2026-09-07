import { describe, expect, it } from "vitest";
import { friendlyPaymentError } from "./paymentErrors";

describe("friendlyPaymentError", () => {
  it("translates a plain decline and drops the redundant raw text", () => {
    const r = friendlyPaymentError("Your card was declined.", "card_declined");
    expect(r.title).toBe("Your card was declined");
    expect(r.body).toMatch(/bank didn't approve/);
    expect(r.detail).toBeUndefined();
  });

  it("matches on message text when no code is given", () => {
    expect(friendlyPaymentError("Your card was declined.").title).toBe("Your card was declined");
    expect(friendlyPaymentError("Your card has insufficient funds.").title).toBe("Not enough funds on this card");
    expect(friendlyPaymentError("Your card has expired.").title).toBe("This card has expired");
    expect(friendlyPaymentError("Your card's security code is incorrect.").title).toBe("The security code doesn't match");
    expect(friendlyPaymentError("Your card number is invalid.").title).toBe("The card number doesn't look right");
    expect(friendlyPaymentError("Your card's expiration year is in the past.").title).toBe("The expiry date doesn't look right");
    expect(friendlyPaymentError("An error occurred while processing your card. Try again in a little bit.").title).toBe("Something went wrong at the bank");
  });

  it("prefers the code over the message text", () => {
    const r = friendlyPaymentError("Your card was declined.", "insufficient_funds");
    expect(r.title).toBe("Not enough funds on this card");
    // The raw text is not the canonical insufficient-funds sentence, so it is kept.
    expect(r.detail).toBe("Your card was declined.");
  });

  it("keeps the raw message as detail when it adds information", () => {
    const r = friendlyPaymentError("Your card was declined. This transaction requires authentication.", "card_declined");
    expect(r.title).toBe("Your card was declined");
    expect(r.detail).toBe("Your card was declined. This transaction requires authentication.");
  });

  it("recognises 3D Secure and authentication failures", () => {
    expect(friendlyPaymentError("We are unable to authenticate your payment method. Please choose a different payment method and try again.").title)
      .toBe("We couldn't confirm it was you");
    expect(friendlyPaymentError("3D Secure authentication failed").title).toBe("We couldn't confirm it was you");
    expect(friendlyPaymentError("anything", "payment_intent_authentication_failure").title).toBe("We couldn't confirm it was you");
  });

  it("recognises network trouble", () => {
    expect(friendlyPaymentError("Failed to fetch").title).toBe("Connection problem");
    expect(friendlyPaymentError("The request timed out").title).toBe("Connection problem");
    expect(friendlyPaymentError("Failed to fetch").detail).toBeUndefined();
  });

  it("falls back to a neutral title with the raw text as the body", () => {
    const r = friendlyPaymentError("Something unusual happened with code XYZ.");
    expect(r).toEqual({ title: "Payment didn't go through", body: "Something unusual happened with code XYZ." });
  });

  it("copes with an empty message", () => {
    const r = friendlyPaymentError("");
    expect(r.title).toBe("Payment didn't go through");
    expect(r.body).toBe("Please try again.");
  });

  it("frames our own pre-flight gates without hiding their text", () => {
    const address = friendlyPaymentError("Please add and save your home address before paying.");
    expect(address.title).toBe("Add your home address first");
    expect(address.body).toBe("Please add and save your home address before paying.");
    const terms = friendlyPaymentError("Please confirm you have read and accepted the Terms & Conditions.");
    expect(terms.title).toBe("Please accept the terms first");
    expect(terms.body).toBe("Please confirm you have read and accepted the Terms & Conditions.");
  });
});
