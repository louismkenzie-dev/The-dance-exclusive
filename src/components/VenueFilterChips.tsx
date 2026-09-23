import { useMemo, useState } from "react";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface VenueChipOption {
  id: string;
  name: string;
}

interface VenueFilterChipsProps {
  venues: VenueChipOption[];
  /** "all" or a venue id. */
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  className?: string;
}

/** Above this many, the open panel gets a search box — fourteen venues is
 *  more than anyone reads through. */
const SEARCH_FROM = 8;

/**
 * The venue switcher used on every calendar, timetable and class list.
 *
 * Louis: "all of the venues appear here ... they are taking up too much real
 * estate space, instead perhaps they should be under a collapsible thing
 * where you can filter the venues."
 *
 * Fourteen venues wrapped to four rows and pushed the calendar itself below
 * the fold, every visit, to change something almost nobody changes. So it
 * rests as one line saying what is being shown, and opens to the full list
 * when it is actually wanted. Picking a venue closes it again.
 */
const VenueFilterChips = ({ venues, value, onChange, allLabel = "All venues", className }: VenueFilterChipsProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = venues.find((v) => v.id === value) ?? null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? venues.filter((v) => v.name.toLowerCase().includes(q)) : venues;
  }, [venues, query]);

  if (venues.length < 2) return null;

  const pick = (next: string) => {
    onChange(next);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className={className}>
      <Collapsible open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
        <div className="flex flex-wrap items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button
              size="sm"
              variant={selected ? "default" : "outline"}
              className="h-8 gap-1.5"
              aria-label={selected ? `Showing ${selected.name}. Change venue` : "Filter by venue"}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span className="max-w-[16rem] truncate">{selected ? selected.name : allLabel}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          {selected ? (
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => pick("all")}>
              Show all {venues.length}
            </Button>
          ) : (
            !open && (
              <span className="text-xs text-muted-foreground">
                {venues.length} venues
              </span>
            )
          )}
        </div>

        <CollapsibleContent className="pt-2.5">
          {venues.length >= SEARCH_FROM && (
            <div className="relative mb-2 max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a venue"
                className="h-8 pl-8 text-sm"
                aria-label="Find a venue"
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={value === "all" ? "default" : "outline"}
              className="h-8 gap-1.5"
              onClick={() => pick("all")}
            >
              <MapPin className="h-3.5 w-3.5" />
              {allLabel}
            </Button>
            {matches.map((v) => (
              <Button
                key={v.id}
                size="sm"
                variant={value === v.id ? "default" : "outline"}
                className="h-8"
                onClick={() => pick(v.id)}
              >
                {v.name}
              </Button>
            ))}
            {matches.length === 0 && (
              <span className="text-sm text-muted-foreground">No venue matches &ldquo;{query.trim()}&rdquo;.</span>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default VenueFilterChips;
