import { describe, expect, it, vi } from "vitest";

// The stripe module imports the app-wide supabase client (which touches
// browser APIs at import time) — the config-pair logic under test never uses
// it, so stub it out.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { resolvePaymentsConfig } from "./stripe";

describe("resolvePaymentsConfig", () => {
  it("returns a matching sandbox pair (test key + test account, never mixed)", () => {
    const cfg = resolvePaymentsConfig("sandbox");
    expect(cfg.environment).toBe("sandbox");
    expect(cfg.publishableKey.startsWith("pk_test_")).toBe(true);
    expect(cfg.connectedAccount?.startsWith("acct_")).toBe(true);
  });

  it("fails closed when live mode is requested but no live key is configured", () => {
    // This build has no pk_live baked in and no live env token — a fallback
    // to sandbox here would mismatch the server's live PaymentIntents, so it
    // must throw instead.
    expect(() => resolvePaymentsConfig("live")).toThrow(/live payments/i);
  });
});
