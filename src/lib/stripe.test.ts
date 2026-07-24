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

  it("returns the matching live pair (live key + live connected account)", () => {
    const cfg = resolvePaymentsConfig("live");
    expect(cfg.environment).toBe("live");
    expect(cfg.publishableKey.startsWith("pk_live_")).toBe(true);
    expect(cfg.connectedAccount?.startsWith("acct_")).toBe(true);
    // Never mix environments: a live key must never ship with the test account.
    expect(cfg.connectedAccount).not.toBe(resolvePaymentsConfig("sandbox").connectedAccount);
  });
});
