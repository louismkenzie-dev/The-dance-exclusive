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

  // The school splits each term at half term ("Autumn, term 1" / "Autumn,
  // term 2"), so the break usually falls BETWEEN groups rather than inside
  // one. Name it there too — a parent scanning the list should see "half
  // term — no classes", not just a new heading.
  const breakBetween = (gi: number): string | null => {
    const group = groups[gi];
    const next = groups[gi + 1];
    if (!next || group.inHoliday || next.inHoliday) return null;
    const lastBlock = group.blocks[group.blocks.length - 1];
    const last = lastBlock.sessions[lastBlock.sessions.length - 1];
    const first = next.blocks[0]?.sessions[0];
    if (!last || !first) return null;
    const from = dateOf(last);
    const to = dateOf(first);
    const names = termData.holidays
      .filter((h) => h.end_date > from && h.start_date < to)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .map((h) => h.name);
    return names.length > 0 ? [...new Set(names)].join(" · ") : null;
  };

  const breakRule = (label: string) => (
    <div className="flex items-center gap-2 py-1" aria-label={`${label} — no classes`}>
      <div className="h-px flex-1 border-t border-dashed border-border" />
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label} — no classes</span>
      <div className="h-px flex-1 border-t border-dashed border-border" />
    </div>
  );

  return (
    <div className={className}>
      {groups.map((group, gi) => (
        <div key={`${group.label}-${gi}`} className="space-y-1.5">
          <div className="flex items-baseline justify-between pt-2 first:pt-0">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                group.inHoliday ? "text-pink-400" : "text-primary"
              }`}
            >
              {group.label}
              {group.inHoliday && (
                <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground">
                  (runs through the holiday)
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
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
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 pl-1 pb-0.5 pt-1">
                        {format(parseISO(d), "MMMM")}
                      </div>
                    )}
                    {renderSession(s)}
                  </div>
                );
              })}
              {block.breakAfter && breakRule(block.breakAfter)}
            </div>
          ))}
          {(() => {
            const between = breakBetween(gi);
            return between ? breakRule(between) : null;
          })()}
        </div>
      ))}
    </div>
  );
}

export default TermSessionGroups;
