import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
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

/** One-tap venue switcher used on every calendar / timetable / class list:
 *  "All venues" plus a chip per venue. Hidden when there's only one venue. */
const VenueFilterChips = ({ venues, value, onChange, allLabel = "All venues", className }: VenueFilterChipsProps) => {
  if (venues.length < 2) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        size="sm"
        variant={value === "all" ? "default" : "outline"}
        className="h-8 gap-1.5"
        onClick={() => onChange("all")}
      >
        <MapPin className="h-3.5 w-3.5" />
        {allLabel}
      </Button>
      {venues.map((v) => (
        <Button
          key={v.id}
          size="sm"
          variant={value === v.id ? "default" : "outline"}
          className="h-8"
          onClick={() => onChange(v.id)}
        >
          {v.name}
        </Button>
      ))}
    </div>
  );
};

export default VenueFilterChips;
