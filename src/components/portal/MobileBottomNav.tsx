import { Link, useLocation } from "react-router-dom";
import { CalendarDays, Home, Sparkles, Ticket, User } from "lucide-react";

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
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <div className="grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, active }) => {
          const isActive = active(pathname);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={`w-5 h-5 ${isActive ? "" : "opacity-80"}`} />
              <span
                className="text-[10px] font-semibold tracking-wide"
                style={{ textTransform: "none", letterSpacing: "0.02em", fontFamily: "var(--font-body)" }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
