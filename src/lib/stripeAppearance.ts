import type { Appearance } from "@stripe/stripe-js";

// ---------------------------------------------------------------------------
// Stripe appearance. The Payment Element lives in an iframe, so it cannot
// read our CSS variables — the tokens are resolved here from the themed page
// root and handed over as plain colours, and the theme flips to "night" when
// the page ground is dark (the adult portal).
// ---------------------------------------------------------------------------

/** The raw HSL triplet of a token ("193 100% 36%"), or null when unset. */
function readToken(root: Element | null, name: string): string | null {
  if (typeof window === "undefined") return null;
  const el = root ?? document.body ?? document.documentElement;
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  return raw || null;
}

const hsl = (raw: string | null, alpha?: number): string | undefined =>
  raw == null ? undefined : alpha == null ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;

/** Lightness of an HSL triplet: "36 22% 97.5%" → 97.5. */
const lightnessOf = (raw: string | null): number | null => {
  if (!raw) return null;
  const l = parseFloat(raw.split(/\s+/)[2] ?? "");
  return Number.isFinite(l) ? l : null;
};

/** Drop unset entries so Stripe never receives an empty colour. */
const compact = (o: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== "")) as Record<string, string>;

export function buildAppearance(root: Element | null): Appearance {
  const light = (lightnessOf(readToken(root, "--background")) ?? 100) >= 50;
  const primaryRaw = readToken(root, "--primary");
  const accentRaw = readToken(root, "--accent");
  const primary = hsl(primaryRaw);
  const card = hsl(readToken(root, "--card"));
  const fg = hsl(readToken(root, "--foreground"));
  const muted = hsl(readToken(root, "--muted-foreground"));
  const border = hsl(readToken(root, "--border"));
  const input = hsl(readToken(root, "--input"));
  const destructive = hsl(readToken(root, "--destructive"));
  // The accent is a soft tint on the light theme and a saturated brand
  // colour on the dark one — only the tint works as a selected-row fill.
  const accentFill = (lightnessOf(accentRaw) ?? 0) >= 80 ? hsl(accentRaw) : undefined;
  const focusRing = hsl(primaryRaw, 0.2);

  return {
    theme: light ? "stripe" : "night",
    labels: "above",
    variables: compact({
      colorPrimary: primary,
      colorBackground: card,
      colorText: fg,
      colorTextSecondary: muted,
      colorTextPlaceholder: muted,
      colorDanger: destructive,
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      fontSizeBase: "16px",
      borderRadius: "12px",
      spacingUnit: "5px",
    }),
    rules: {
      ".Input": compact({
        border: input ? `1px solid ${input}` : undefined,
        boxShadow: "none",
        padding: "14px 16px",
      }),
      ".Input:focus": compact({
        borderColor: primary,
        boxShadow: focusRing ? `0 0 0 3px ${focusRing}` : undefined,
      }),
      ".Input--invalid": compact({
        borderColor: destructive,
        boxShadow: "none",
      }),
      ".Label": {
        fontWeight: "500",
        fontSize: "13px",
      },
      ".Tab": compact({
        border: border ? `1px solid ${border}` : undefined,
        borderRadius: "12px",
      }),
      ".AccordionItem": compact({
        border: border ? `1px solid ${border}` : undefined,
        borderRadius: "12px",
      }),
      ".AccordionItem--selected": compact({
        borderColor: primary,
        backgroundColor: accentFill,
      }),
      ".Error": {
        fontSize: "13px",
      },
    },
  };
}
