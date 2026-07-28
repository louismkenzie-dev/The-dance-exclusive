import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live numbers for the public marketing site, so pages never show stale
 * claims as the studio grows:
 *  - venues / coaches / weeklyClasses count what admin actually manages
 *  - foundedYear / dancers / titles are studio history the platform can't
 *    derive — admin sets them in Settings → Company (app_settings)
 */
export interface SiteStats {
  venues: number | null;
  venueTowns: string[];
  coaches: number | null;
  weeklyClasses: number | null;
  foundedYear: number | null;
  yearsRunning: number | null;
  dancers: number | null;
  titles: number | null;
}

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
];

/** 5 → "five"; numbers beyond twelve fall back to digits. */
export const numberWord = (n: number | null | undefined): string =>
  n == null ? "" : WORDS[n] ?? String(n);

export const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export async function fetchSiteStats(): Promise<SiteStats> {
  const [venuesRes, coachesRes, classesRes, settingsRes] = await Promise.all([
    supabase.from("venues").select("city", { count: "exact" }).eq("publicly_visible", true),
    (supabase.from("staff_public" as any) as any).select("id", { count: "exact", head: true }),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("status", "confirmed")
      .eq("publicly_visible", true),
    supabase.from("app_settings").select("key, value").in("key", ["founded_year", "stat_dancers", "stat_titles"]),
  ]);

  const settings = new Map(((settingsRes.data as any[]) ?? []).map((r) => [r.key, r.value]));
  const setting = (key: string): number | null => {
    const v = parseInt(settings.get(key) ?? "", 10);
    return Number.isFinite(v) ? v : null;
  };

  const foundedYear = setting("founded_year");
  const towns = [...new Set(((venuesRes.data as any[]) ?? []).map((v) => v.city).filter(Boolean))] as string[];

  const count = (c: number | null | undefined) => (c != null && c > 0 ? c : null);

  return {
    venues: count(venuesRes.count),
    venueTowns: towns,
    coaches: count((coachesRes as any).count),
    weeklyClasses: count(classesRes.count),
    foundedYear,
    yearsRunning: foundedYear ? Math.max(1, new Date().getFullYear() - foundedYear) : null,
    dancers: setting("stat_dancers"),
    titles: setting("stat_titles"),
  };
}

/** Fetch-once hook; null while loading (callers keep their static fallbacks). */
export function useSiteStats(): SiteStats | null {
  const [stats, setStats] = useState<SiteStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchSiteStats()
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => { /* keep fallbacks */ });
    return () => { cancelled = true; };
  }, []);
  return stats;
}
