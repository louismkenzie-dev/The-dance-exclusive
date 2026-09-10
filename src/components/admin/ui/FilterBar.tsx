import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  /** Chips, pickers, toggles — anything that narrows the list. */
  children?: ReactNode;
  className?: string;
}

/**
 * Search on top, filters underneath in a row that scrolls sideways on a
 * phone rather than wrapping into a wall of controls.
 */
export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  children,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {onSearch && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-12 w-full rounded-2xl border border-border bg-card pl-10 pr-10 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="pressable absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {children && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {children}
        </div>
      )}
    </div>
  );
}

export default FilterBar;
