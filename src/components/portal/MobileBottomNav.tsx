import { Link, useLocation } from "react-router-dom";
import { CalendarDays, Home, Sparkles, Ticket, User } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * App-style tab bar for phones. The five places a parent actually goes live
 * one thumb-tap away instead of behind the hamburger menu; desktop keeps the
 * full header nav (hidden from md up). Signed-out taps on the account tabs
 * land on the sign-in page via the route guards.
 */
const TABS = [
  { to: "/", label: "Home", icon: Home, active: (p: string) => p === "/" },
  { to: "/classes/children", label: "Classes", icon: Sparkles, active: (p: string) => p.startsWith("/classes/") || p.startsWith("/book/") },
  { to: "/timetable", label: "Timetable", icon: CalendarDays, active: (p: string) => p === "/timetable" },
  { to: "/account/bookings", label: "Bookings", icon: Ticket, active: (p: string) => p === "/account/bookings" },
  { to: "/account", label: "Account", icon: User, active: (p: string) => p === "/account" || p === "/account/children" },
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();

  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md md:hidden"
      aria-label="Main"
    >
      <div className="grid h-14 grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, active }) => {
          const isActive = active(pathname);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-foreground" aria-hidden />
              )}
              <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
              <span className={cn("text-[11px] leading-none", isActive ? "font-semibold" : "font-medium")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
