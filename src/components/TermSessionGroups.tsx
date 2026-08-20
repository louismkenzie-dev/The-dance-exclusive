import { useEffect, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  groupSessionsByTerm,
  type HolidayRange,
  type TermRange,
} from "@/lib/termGrouping";

/**
 * Renders any session list grouped by school term, split at holidays:
 *
 *   AUTUMN TERM 2026 · 13 classes
 *     [7 session rows, with faint month markers]
 *     ····· October half term — no classes ·····
 *     [6 session rows]
 *
 * The rows themselves come from `renderSession`, so the admin builder
 * (editable rows) and parent pickers (checkbox rows) share the scaffolding.
 */

// Terms and holidays change rarely — fetch once per page load, shared by
// every instance (the builder + pickers can mount several).
let termDataPromise: Promise<{ terms: TermRange[]; holidays: HolidayRange[] }> | null = null;
const loadTermData = () => {
  termDataPromise ??= (async () => {
    const [termsRes, holidaysRes] = await Promise.all([
      supabase.from("school_terms").select("name, start_date, end_date").order("start_date"),
      supabase.from("school_holidays").select("name, start_date, end_date").order("start_date"),
    ]);
    return {
      terms: (termsRes.data as TermRange[]) ?? [],
      holidays: (holidaysRes.data as HolidayRange[]) ?? [],
    };
  })().catch(() => {
    termDataPromise = null; // allow a retry on the next mount
    return { terms: [], holidays: [] };
  });
  return termDataPromise;
};

interface TermSessionGroupsProps<S> {
  sessions: S[];
  dateOf: (s: S) => string;
  renderSession: (s: S) => ReactNode;
  className?: string;
}

export function TermSessionGroups<S>({
  sessions,
  dateOf,
  renderSession,
  className,
}: TermSessionGroupsProps<S>) {
  const [termData, setTermData] = useState<{ terms: TermRange[]; holidays: HolidayRange[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTermData().then((data) => {
      if (!cancelled) setTermData(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Until term data arrives (or when there is none), render the plain list —
  // grouping is an enhancement, never a blocker.
  if (!termData || (termData.terms.length === 0 && termData.holidays.length === 0)) {
    return <div className={className}>{sessions.map((s) => renderSession(s))}</div>;
  }

  const groups = groupSessionsByTerm(sessions, dateOf, termData.terms, termData.holidays);

  return (
    <div className={className}>
      {groups.map((group, gi) => (
        <div key={`${group.label}-${gi}`} className="space-y-1.5">
          <div className="flex items-baseline justify-between pt-2 first:pt-0">
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
              {group.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {group.total} {group.total === 1 ? "class" : "classes"}
            </span>
          </div>
          {group.blocks.map((block, bi) => (
            <div key={bi} className="space-y-1.5">
              {block.sessions.map((s, si) => {
                const d = dateOf(s);
                const prev = si > 0 ? dateOf(block.sessions[si - 1]) : null;
                const newMonth = !prev || d.slice(0, 7) !== prev.slice(0, 7);
                return (
                  <div key={d + si}>
                    {newMonth && (
                      <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50 pl-1 pb-0.5 pt-1">
                        {format(parseISO(d), "MMMM")}
                      </div>
                    )}
                    {renderSession(s)}
                  </div>
                );
              })}
              {block.breakAfter && (
                <div className="flex items-center gap-2 py-1" aria-label={`${block.breakAfter} — no classes`}>
                  <div className="h-px flex-1 border-t border-dashed border-border" />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {block.breakAfter} — no classes
                  </span>
                  <div className="h-px flex-1 border-t border-dashed border-border" />
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default TermSessionGroups;
