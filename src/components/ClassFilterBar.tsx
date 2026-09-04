import { CalendarDays, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VenueFilterChips, { type VenueChipOption } from "@/components/VenueFilterChips";
import { AGE_BANDS, hasActiveFilters, type ClassFilters } from "@/lib/classFilters";
import { cn } from "@/lib/utils";

interface ClassFilterBarProps {
  venues: VenueChipOption[];
  /** Days something actually runs on, in week order. */
  days: string[];
  filters: ClassFilters;
  onChange: (next: Partial<ClassFilters>) => void;
  onReset: () => void;
  /** How many classes are showing, so the effect of a filter is visible. */
  resultCount: number;
  totalCount: number;
  /** Adult pages don't need children's age bands. */
  showAgeBands?: boolean;
  className?: string;
}

const Chip = ({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <Button
    type="button"
    size="sm"
    variant={active ? "default" : "outline"}
    className="h-8"
    onClick={onClick}
  >
    {children}
  </Button>
);

const titleCase = (day: string) => day.charAt(0).toUpperCase() + day.slice(1);

/**
 * Narrow a long class list down: venue, age group, day, and a plain search.
 *
 * Deliberately a single row of one-tap chips rather than a form — a parent on
 * a phone should be able to get from "sixty classes" to "the three near me for
 * a six-year-old" without typing anything.
 */
const ClassFilterBar = ({
  venues, days, filters, onChange, onReset, resultCount, totalCount,
  showAgeBands = true, className,
}: ClassFilterBarProps) => {
  const filtering = hasActiveFilters(filters);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="max-w-md mx-auto relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          aria-label="Search classes by name, style, day or venue"
          placeholder="Search classes — name, style, day or venue…"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
        {filters.search && (
          <button
            type="button"
            aria-label="Clear class search"
            onClick={() => onChange({ search: "" })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <VenueFilterChips
        venues={venues}
        value={filters.venueId}
        onChange={(venueId) => onChange({ venueId })}
        className="justify-center"
      />

      {showAgeBands && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold inline-flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Age
          </span>
          <Chip active={filters.ageBandId === "all"} onClick={() => onChange({ ageBandId: "all" })}>
            All ages
          </Chip>
          {AGE_BANDS.map((band) => (
            <Chip
              key={band.id}
              active={filters.ageBandId === band.id}
              onClick={() => onChange({ ageBandId: band.id })}
            >
              {band.label}
            </Chip>
          ))}
        </div>
      )}

      {days.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold inline-flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Day
          </span>
          <Chip active={filters.day === "all"} onClick={() => onChange({ day: "all" })}>
            Any day
          </Chip>
          {days.map((day) => (
            <Chip key={day} active={filters.day === day} onClick={() => onChange({ day })}>
              {titleCase(day)}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <span>
          Showing <span className="text-foreground font-semibold">{resultCount}</span>
          {filtering && totalCount !== resultCount ? ` of ${totalCount}` : ""}{" "}
          {resultCount === 1 ? "class" : "classes"}
        </span>
        {filtering && (
          <button type="button" onClick={onReset} className="text-primary hover:underline font-medium">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
};

export default ClassFilterBar;
