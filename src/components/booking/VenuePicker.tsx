import { useState, type ReactNode } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChoiceSheet, type ChoiceOption } from "./ChoiceSheet";

export interface VenueOption {
  id: string;
  name: string;
  /** Town or area: "Kelvedon". */
  area?: string | null;
  /** Classes at this venue (for the current audience). */
  count: number;
  /** "2.1 miles" once the parent has said where they are. */
  distanceLabel?: string | null;
}

interface VenuePickerProps {
  venues: VenueOption[];
  /** "all" or a venue id. */
  value: string;
  onChange: (id: string) => void;
  /** Classes across every venue. */
  totalCount: number;
  /** Rendered at the top of the sheet — the "near me" postcode search. */
  above?: ReactNode;
  className?: string;
  themeClass?: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "Choose a venue" — the first decision a family makes. A field-shaped
 * button showing where they're looking, opening a sheet of venues with the
 * town, how many classes run there and how far away it is.
 */
export function VenuePicker({ venues, value, onChange, totalCount, above, className, themeClass }: VenuePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value === "all" ? null : venues.find((v) => v.id === value) ?? null;

  const options: ChoiceOption[] = [
    { id: "all", label: "All venues", meta: plural(totalCount, "class", "classes") },
    ...venues.map((v) => ({
      id: v.id,
      label: v.name,
      meta: [v.area, plural(v.count, "class", "classes")].filter(Boolean).join(" · "),
      trailing: v.distanceLabel ? <span className="text-[13px] font-medium text-muted-foreground">{v.distanceLabel}</span> : undefined,
    })),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={selected ? `Venue: ${selected.name}. Change venue` : "Choose a venue"}
        className={cn(
          "surface surface-interactive pressable flex h-14 w-full items-center gap-3 rounded-2xl px-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
          className,
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden>
          <MapPin className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {selected ? "Venue" : "Choose a venue"}
          </span>
          <span className="block truncate text-[15px] font-semibold leading-snug text-foreground">
            {selected ? selected.name : "All venues"}
          </span>
        </span>
        <span className="hidden shrink-0 text-[13px] text-muted-foreground sm:block">
          {selected ? selected.area ?? "" : plural(venues.length, "venue", "venues")}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <ChoiceSheet
        open={open}
        onOpenChange={setOpen}
        title="Choose a venue"
        description={`Classes run at ${plural(venues.length, "venue", "venues")} across Essex.`}
        options={options}
        value={value}
        onChange={onChange}
        above={above}
        themeClass={themeClass}
      />
    </>
  );
}

export default VenuePicker;
