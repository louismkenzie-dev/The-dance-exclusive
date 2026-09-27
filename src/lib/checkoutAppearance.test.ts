import { afterEach, describe, expect, it } from "vitest";
import { buildAppearance } from "./checkoutAppearance";
afterEach(() => document.body.removeAttribute("style"));
describe("Stripe customer theme", () => {
 it("carries dark customer colours into the isolated payment iframe", () => {
  for (const [name,value] of Object.entries({background:"214 47% 6%",primary:"196 69% 57%",card:"205 45% 12%",foreground:"197 69% 95%",input:"201 28% 42%"})) document.body.style.setProperty(`--${name}`,value);
  const appearance = buildAppearance(null);
  expect(appearance.theme).toBe("night");
  expect(appearance.variables).toMatchObject({colorPrimary:"hsl(196 69% 57%)",colorBackground:"hsl(205 45% 12%)",colorText:"hsl(197 69% 95%)",fontSizeBase:"16px",borderRadius:"6px"});
  expect(appearance.rules?.[".Input"]?.border).toBe("1px solid hsl(201 28% 42%)");
 });
 it("omits missing tokens instead of passing invalid colours", () => {
  const appearance = buildAppearance(null);
  expect(appearance.variables).not.toHaveProperty("colorPrimary");
  expect(appearance.rules?.[".Input"]).not.toHaveProperty("border");
 });
});
