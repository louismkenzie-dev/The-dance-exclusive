import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  /**
   * Show a "Today" shortcut button below the grid. Only applies to mode="single".
   * Defaults to true.
   */
  showTodayButton?: boolean;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown-buttons",
  fromYear,
  toYear,
  showTodayButton = true,
  ...props
}: CalendarProps) {
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = React.useState<Date | undefined>(
    (props as any).month ?? (props as any).defaultMonth,
  );

  const handleTodayClick = () => {
    const today = new Date();
    setMonth(today);
    if (props.mode === "single" && typeof (props as any).onSelect === "function") {
      (props as any).onSelect(today, today, {}, new MouseEvent("click") as any);
    }
  };

  // Check if today is selectable based on disabled prop
  const isTodayDisabled = (() => {
    const disabled = (props as any).disabled;
    if (!disabled) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (typeof disabled === "function") return disabled(today);
    if (disabled instanceof Date) {
      return disabled.toDateString() === today.toDateString();
    }
    return false;
  })();

  const showTodayShortcut = showTodayButton && props.mode === "single";

  return (
    <div className="inline-block">
      <DayPicker
        showOutsideDays={showOutsideDays}
        captionLayout={captionLayout}
        fromYear={fromYear ?? currentYear - 100}
        toYear={toYear ?? currentYear + 10}
        month={(props as any).month ?? month}
        onMonthChange={(m) => {
          setMonth(m);
          (props as any).onMonthChange?.(m);
        }}
        className={cn("p-3", className)}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "hidden",
          caption_dropdowns: "flex items-center gap-2",
          dropdown:
            "bg-background text-foreground border border-input rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
          dropdown_month: "",
          dropdown_year: "",
          vhidden: "sr-only",
          nav: "space-x-1 flex items-center",
          nav_button: cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          ),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
          row: "flex w-full mt-2",
          cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
          day_range_end: "day-range-end",
          day_selected:
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside:
            "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
          ...classNames,
        }}
        components={{
          IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
          IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        }}
        {...props}
      />
      {showTodayShortcut && (
        <div className="px-3 pb-3 -mt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleTodayClick}
            disabled={isTodayDisabled}
          >
            Today
          </Button>
        </div>
      )}
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
