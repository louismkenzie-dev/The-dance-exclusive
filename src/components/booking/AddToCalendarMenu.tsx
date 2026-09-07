import { useMemo } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { googleCalendarUrl, icsDataUrl, type CalendarEvent } from "@/lib/calendarLinks";
import { cn } from "@/lib/utils";

interface AddToCalendarMenuProps {
  event: CalendarEvent;
  className?: string;
}

/**
 * "Add to calendar": a quiet pill that opens two choices — Google Calendar in
 * a new tab, or an .ics file for Apple Calendar and Outlook. Everything is
 * built client-side from the event; nothing is fetched.
 */
export function AddToCalendarMenu({ event, className }: AddToCalendarMenuProps) {
  const googleHref = useMemo(() => googleCalendarUrl(event), [event]);
  const icsHref = useMemo(() => icsDataUrl(event), [event]);

  return (
    // modal={false}: Radix's modal menus lock the page while open, which can
    // stick on touch devices (see PortalLayout).
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="soft"
          className={cn("pressable h-11 rounded-full px-4 text-sm font-medium", className)}
        >
          <CalendarPlus className="text-muted-foreground" aria-hidden />
          Add to calendar
          <ChevronDown className="-mr-0.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-[14rem] rounded-xl p-1.5 shadow-lg">
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-3 py-3 text-sm">
          <a href={googleHref} target="_blank" rel="noopener noreferrer">
            Google Calendar
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-3 py-3 text-sm">
          <a href={icsHref} download="the-dance-exclusive.ics">
            Apple / Outlook (.ics)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AddToCalendarMenu;
