import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ADULT_PASSES } from "@/lib/pricing";

/**
 * The class passes on sale. The published packs in pricing.ts are the
 * built-in list; whatever the studio sets up in Admin → Class Passes is
 * layered over the top, so they can add their own packages without a code
 * change. Mirrors _shared/pricing.ts loadPasses() on the server, which is
 * what actually prices a basket.
 */
export interface PassDef {
  code: string;
  sessions: number;
  price: number;
  /** Days valid from purchase; null = same calendar week (Mon–Sun). */
  windowDays: number | null;
  label: string;
  description: string;
  sortOrder: number;
}

const BUILT_IN: PassDef[] = Object.entries(ADULT_PASSES).map(([code, p], i) => ({
  code,
  sessions: p.sessions,
  price: p.price,
  windowDays: p.windowDays,
  label: p.label,
  description: p.description,
  sortOrder: i + 1,
}));

export const passLabelOf = (passes: PassDef[], code: string): string =>
  passes.find((p) => p.code === code)?.label
    ?? ADULT_PASSES[code as keyof typeof ADULT_PASSES]?.label
    ?? "Class Pass";

/** Fetch the sale list, newest studio settings winning over the built-ins. */
export async function fetchPasses(): Promise<PassDef[]> {
  const { data, error } = await supabase
    .from("class_pass_types")
    .select("code, label, description, sessions, price, window_days, is_active, sort_order");
  if (error || !data) return BUILT_IN;

  const byCode = new Map(BUILT_IN.map((p) => [p.code, p]));
  for (const row of data as any[]) {
    if (!row?.code) continue;
    if (row.is_active === false) {
      byCode.delete(row.code);
      continue;
    }
    byCode.set(row.code, {
      code: row.code,
      sessions: Number(row.sessions),
      price: Number(row.price),
      windowDays: row.window_days == null ? null : Number(row.window_days),
      label: row.label,
      description: row.description ?? "",
      sortOrder: Number(row.sort_order ?? 0),
    });
  }
  return [...byCode.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price);
}

/** Passes for display. Starts from the built-in list so nothing flashes empty. */
export function usePassCatalog() {
  const [passes, setPasses] = useState<PassDef[]>(BUILT_IN);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPasses().then((rows) => {
      if (!cancelled) {
        setPasses(rows);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return { passes, loading };
}
