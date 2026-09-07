import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { User, LogOut, CalendarDays, Sparkles, Heart, Menu, Instagram, Facebook, Mail, ChevronDown } from "lucide-react";
import CartButton from "@/components/portal/CartButton";
import MobileBottomNav from "@/components/portal/MobileBottomNav";
import CartDrawer from "@/components/portal/CartDrawer";
import AttendeeOnboarding from "@/components/portal/AttendeeOnboarding";
import logo from "@/assets/logo.png";
import logoDark from "@/assets/logo-dark.png";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Pages that belong to the brand site rather than the booking product. */
const MARKETING_PATHS = new Set([
  "/", "/about", "/team", "/results", "/gallery", "/venues", "/parties", "/info", "/contact", "/shop",
]);

/** Brand-site pages, in the order the menus list them. */
const EXPLORE_LINKS = [
  { to: "/about", label: "About" },
  { to: "/team", label: "The team" },
  { to: "/results", label: "Results & awards" },
  { to: "/gallery", label: "Gallery" },
  { to: "/shop", label: "Shop" },
  { to: "/venues", label: "Venues" },
  { to: "/parties", label: "Parties" },
  { to: "/info", label: "Parent info" },
  { to: "/contact", label: "Contact" },
];
/** The desktop "Explore" menu also carries term dates, between parties and parent info. */
const EXPLORE_MENU = [...EXPLORE_LINKS.slice(0, 7), { to: "/term-dates", label: "Term dates" }, ...EXPLORE_LINKS.slice(7)];

const SOCIAL_LINKS = [
  { href: "https://instagram.com/thedanceexclusive", label: "Instagram", icon: Instagram },
  { href: "https://facebook.com/thedanceexclusive", label: "Facebook", icon: Facebook },
  { href: "mailto:hello@thedanceexclusive.co.uk", label: "Email", icon: Mail },
];

const PortalLayout = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const customerType = profile?.customer_type as string | null;
  const isAdultSection = pathname.startsWith("/classes/adult") || pathname.includes("adult");
  const isChildrenSection = pathname.startsWith("/classes/children");
  // The marketing site keeps its dark stage-light look; everything a family
  // does — browse, book, pay, manage — is one light product, unless they are
  // an adult dancer, whose whole journey stays in the after-dark theme.
  const isMarketing = MARKETING_PATHS.has(pathname);
  const isAdultDancer = customerType === "adult_dancer";
  const themeClass = isAdultSection
    ? "theme-adult"
    : isChildrenSection
      ? "theme-children"
      : isMarketing
        ? ""
        : isAdultDancer
          ? "theme-adult"
          : "theme-children";
  const isBookingJourney = themeClass !== "";
  // Checkout and its confirmation are focus screens: no tab bar or footer
  // competing with the one action that matters.
  const isFocusRoute = pathname.startsWith("/checkout");

  // Radix Select/Dropdown popovers portal to document.body, escaping the
  // themed wrapper div — mirror the audience theme onto <body> so dropdowns
  // are blue in the children section and pink in the adult section.
  // Sheets and dialogs portal to <body> too, so the journey's typography
  // scope rides along with the theme; otherwise a sheet title would fall
  // back to the site's uppercase display face.
  useEffect(() => {
    document.body.classList.remove("theme-adult", "theme-children", "portal-ui");
    if (themeClass) document.body.classList.add(themeClass);
    if (isBookingJourney) document.body.classList.add("portal-ui");
    return () => document.body.classList.remove("theme-adult", "theme-children", "portal-ui");
  }, [themeClass, isBookingJourney]);

  // Determine nav order and emphasis based on customer preference
  const primaryIsAdult = customerType === "adult_dancer";
  const showBothEqual = !customerType || customerType === "both";
  const secondaryHidden = !showBothEqual; // hide the non-preferred tab when they chose one side

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // ── Chrome styling ─────────────────────────────────────────────────────
  // In the booking journey the chrome is a calm product header: Inter,
  // sentence case, neutral pills, one ink button. Outside it (the brand
  // site) the Oswald uppercase styling stays exactly as it was.
  const j = isBookingJourney;
  // The mark with dark lettering reads on the light theme; the white-lettered
  // mark on the dark ones.
  const logoSrc = themeClass === "theme-children" ? logo : logoDark;
  // Menu labels are stored in sentence case; the brand site shows them in
  // Title Case via CSS so it renders as it always has.
  const brandCase = j ? "" : "capitalize";

  const navLink = j
    ? "pressable inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors"
    : "relative px-5 py-2 text-sm font-semibold uppercase tracking-wider transition-all duration-300 rounded-full";
  const navIdle = j
    ? "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
    : "text-foreground hover:bg-muted/60 hover:text-foreground";
  const navMuted = j
    ? "text-muted-foreground/60 hover:text-muted-foreground"
    : "text-muted-foreground/50 hover:text-muted-foreground text-xs";
  const menuRow = j
    ? "flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-medium leading-6 text-foreground transition-colors hover:bg-muted"
    : "flex items-center gap-2 px-3 py-3 rounded-md hover:bg-accent text-sm font-semibold uppercase tracking-wider";
  const menuSubRow = j
    ? menuRow
    : "block px-3 py-2.5 rounded-md hover:bg-accent text-sm font-semibold uppercase tracking-wider";
  const menuActive = (to: string) => (j && pathname === to ? "bg-muted" : "");
  const menuIcon = (Icon: typeof User) => (j ? null : <Icon className="w-4 h-4" />);

  return (
    <div className={`min-h-screen bg-background ${isFocusRoute ? "" : "pb-16 md:pb-0"} ${themeClass} ${isBookingJourney ? "portal-ui" : ""}`}>
      {/* Header */}
      <header
        className={cn(
          "sticky top-0 z-50 border-b border-border backdrop-blur-md",
          j ? "bg-background/90" : "bg-background/95 transition-colors duration-500",
        )}
      >
        <div className={cn("container flex items-center justify-between gap-3", j ? "h-16 md:h-20" : "h-16 md:h-28")}>
          <div className="flex items-center gap-1">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("md:hidden", j && "-ml-2 h-11 w-11 rounded-full text-foreground hover:bg-muted hover:text-foreground")}
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className={cn("w-72 p-0 flex flex-col", j && "gap-0 border-border bg-card text-card-foreground")}
              >
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className={cn("border-b border-border flex items-center", j ? "px-5 py-3.5" : "p-5 justify-center")}>
                  <img
                    src={j ? logoSrc : logoDark}
                    alt="The Dance Exclusive"
                    className={j ? "h-12 w-12 object-contain" : "w-28 object-contain"}
                  />
                </div>
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Menu">
                  <Link to="/classes/children" className={cn(menuRow, menuActive("/classes/children"))}>
                    {menuIcon(Sparkles)} {j ? "Children's classes" : "Children Classes"}
                  </Link>
                  <Link to="/classes/adult" className={cn(menuRow, menuActive("/classes/adult"))}>
                    {menuIcon(Heart)} {j ? "Adult classes" : "Adult Classes"}
                  </Link>
                  <div className="my-2 border-t border-border" />
                  {EXPLORE_LINKS.map((m) => (
                    <Link key={m.to} to={m.to} className={cn(menuSubRow, menuActive(m.to))}>
                      {m.label}
                    </Link>
                  ))}
                  <div className="my-2 border-t border-border" />
                  <Link to="/timetable" className={cn(menuRow, menuActive("/timetable"))}>
                    {menuIcon(CalendarDays)} Timetable
                  </Link>
                  <Link to="/term-dates" className={cn(menuRow, menuActive("/term-dates"))}>
                    {menuIcon(CalendarDays)} Term dates
                  </Link>
                  {user && (
                    <>
                      <Link to="/account/bookings" className={cn(menuRow, menuActive("/account/bookings"))}>
                        {menuIcon(CalendarDays)} My bookings
                      </Link>
                      <Link to="/account" className={cn(menuRow, menuActive("/account"))}>
                        {menuIcon(User)} My account
                      </Link>
                    </>
                  )}
                </nav>
                {user && (
                  <div className="p-3 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                      className={cn("w-full justify-start", j && "h-11 rounded-xl text-[15px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground")}
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Sign out
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
            <Link to="/" className="flex items-center gap-2.5" aria-label="The Dance Exclusive home">
              <img
                src={logoSrc}
                alt="The Dance Exclusive"
                className={cn("object-contain", j ? "h-12 w-12 md:h-14 md:w-14" : "w-14 h-14 md:w-36 md:h-36 rounded")}
              />
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
            {/* Show primary tab first based on customer preference */}
            {(primaryIsAdult ? ["adult", "children"] : ["children", "adult"]).map((tabType) => {
              const isAdult = tabType === "adult";
              const isActive = isAdult ? isAdultSection : isChildrenSection;
              const isSecondary = secondaryHidden && (
                (customerType === "parent_only" && isAdult) ||
                (customerType === "adult_dancer" && !isAdult)
              );
              const activeClass = j
                ? "bg-muted text-foreground"
                : isAdult
                  ? "bg-[hsl(330,90%,55%)] text-white shadow-lg shadow-[hsl(330,90%,55%)]/25"
                  : "bg-[hsl(193,100%,44%)] text-white shadow-lg shadow-[hsl(193,100%,44%)]/25";

              return (
                <Link
                  key={tabType}
                  to={`/classes/${tabType === "children" ? "children" : "adult"}`}
                  className={cn(navLink, isActive ? activeClass : isSecondary ? navMuted : navIdle)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="flex items-center gap-1.5">
                    {!j && (isAdult ? <Heart className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />)}
                    {isAdult ? "Adults" : "Children"}
                  </span>
                </Link>
              );
            })}

            {/* Members' timetable — quiet pill next to the audience tabs */}
            <Link
              to="/timetable"
              className={cn(navLink, pathname === "/timetable" ? "bg-muted text-foreground" : navIdle)}
              aria-current={pathname === "/timetable" ? "page" : undefined}
            >
              <span className="flex items-center gap-1.5">
                {!j && <CalendarDays className="w-3.5 h-3.5" />} Timetable
              </span>
            </Link>

            {/* modal={false}: Radix's modal dropdowns lock the page
                (pointer-events: none on body) while open — on touch devices
                that lock can stick on first open and freeze the screen. */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={j
                    ? "rounded-full px-3.5 text-sm font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
                    : "text-foreground hover:text-foreground/80 uppercase tracking-wider text-xs font-semibold px-4"}
                >
                  Explore
                  {j && <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className={cn("w-44", brandCase, j && "rounded-xl p-1.5 shadow-lg")}>
                {EXPLORE_MENU.map((m) => (
                  <DropdownMenuItem key={m.to} onClick={() => navigate(m.to)} className={cn(j && "rounded-lg px-2.5 py-2")}>
                    {m.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              asChild
              size="sm"
              variant={j ? "ink" : "default"}
              className={j ? "ml-2 rounded-full px-4 text-sm font-medium" : "ml-3 font-semibold uppercase tracking-wider text-xs"}
            >
              <Link to="/classes/children">
                {!j && <CalendarDays className="w-3.5 h-3.5 mr-1.5" />} View classes
              </Link>
            </Button>
          </nav>

          <div className={cn("flex items-center", j ? "gap-1" : "gap-2")}>

            {user ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className={cn(
                    "hidden md:inline-flex text-muted-foreground hover:text-foreground",
                    j ? "rounded-full px-3.5 text-sm font-medium hover:bg-muted/70" : "uppercase tracking-wider text-xs",
                  )}
                >
                  <Link to="/account/bookings">
                    {!j && <CalendarDays className="w-3.5 h-3.5 mr-1.5" />} My bookings
                  </Link>
                </Button>
                <CartButton />
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={j
                        ? "pressable h-11 w-11 justify-center rounded-full p-0 hover:bg-muted data-[state=open]:bg-muted"
                        : "text-muted-foreground hover:text-foreground uppercase tracking-wider text-xs gap-2 pl-2 pr-3"}
                      aria-label="Open account menu"
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center overflow-hidden rounded-full",
                          j
                            ? "h-9 w-9 bg-accent text-[13px] font-semibold text-accent-foreground"
                            : "w-7 h-7 bg-primary/20 border border-primary/30 text-[11px] font-bold text-primary",
                        )}
                      >
                        {profile?.profile_photo ? (
                          <img src={profile.profile_photo} alt={`${profile?.full_name || "Account"} profile photo`} className="w-full h-full object-cover" />
                        ) : (
                          profile?.full_name?.charAt(0) || "U"
                        )}
                      </div>
                      <span className={j ? "sr-only" : "hidden md:inline"}>My account</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={cn("w-48", brandCase, j && "rounded-xl p-1.5 shadow-lg")}>
                    <DropdownMenuItem onClick={() => navigate("/account")} className={cn(j && "rounded-lg px-2.5 py-2")}>
                      <User className="w-4 h-4 mr-2" /> My account
                    </DropdownMenuItem>
                    <DropdownMenuItem className={cn("md:hidden", j && "rounded-lg px-2.5 py-2")} onClick={() => navigate("/account/bookings")}>
                      <CalendarDays className="w-4 h-4 mr-2" /> My bookings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className={cn(j && "rounded-lg px-2.5 py-2")}>
                      <LogOut className="w-4 h-4 mr-2" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <CartButton />
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className={j
                    ? "h-10 rounded-full px-4 text-sm font-medium text-foreground hover:bg-muted hover:text-foreground"
                    : "text-muted-foreground hover:text-foreground uppercase tracking-wider text-xs"}
                >
                  <Link to="/auth">Sign in</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Section colour bar indicator — brand-site header only */}
        {!j && (isChildrenSection || isAdultSection) && (
          <div
            className="h-1 w-full transition-all duration-500"
            style={{
              background: isAdultSection
                ? "linear-gradient(90deg, hsl(330, 90%, 55%), hsl(280, 80%, 50%))"
                : "linear-gradient(90deg, hsl(193, 100%, 44%), hsl(193, 90%, 38%))",
            }}
          />
        )}
      </header>

      <main>
        <Outlet />
      </main>
      <CartDrawer />
      <AttendeeOnboarding />
      {!isFocusRoute && <MobileBottomNav />}

      {j ? (
        /* Booking journey: a compact, quiet footer. */
        <footer className={`border-t border-border mt-16 md:mt-20 ${isFocusRoute ? "hidden" : ""}`}>
          <div className="container py-10 md:py-12">
            <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-12">
              <div className="max-w-xs">
                <img src={logoSrc} alt="The Dance Exclusive" className="h-12 w-12 object-contain" />
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Essex's award-winning commercial &amp; street dance school for children and adults.
                  Step in, stand out.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:gap-14">
                <div>
                  <h4 className="text-[13px] font-semibold text-foreground">Classes</h4>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li><Link to="/classes/children" className="hover:text-foreground transition-colors">Children's classes</Link></li>
                    <li><Link to="/classes/adult" className="hover:text-foreground transition-colors">Adult classes</Link></li>
                    <li><Link to="/classes/children" className="hover:text-foreground transition-colors">Holiday camps</Link></li>
                    <li><Link to="/classes/adult" className="hover:text-foreground transition-colors">Workshops</Link></li>
                    <li><Link to="/term-dates" className="hover:text-foreground transition-colors">Term dates</Link></li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-foreground">Your account</h4>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li><Link to={user ? "/timetable" : "/auth"} className="hover:text-foreground transition-colors">Timetable</Link></li>
                    <li><Link to={user ? "/account/bookings" : "/auth"} className="hover:text-foreground transition-colors">My bookings</Link></li>
                    <li><Link to={user ? "/account" : "/auth"} className="hover:text-foreground transition-colors">My account</Link></li>
                    <li><Link to="/auth" className="hover:text-foreground transition-colors">Sign in / register</Link></li>
                  </ul>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <h4 className="text-[13px] font-semibold text-foreground">Connect</h4>
                  <div className="mt-3 flex gap-2">
                    {SOCIAL_LINKS.map(({ href, label, icon: Icon }) => (
                      <a
                        key={href}
                        href={href}
                        {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        aria-label={label}
                        className="pressable flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">Essex, United Kingdom</p>
                </div>
              </div>
            </div>
            <div className="mt-10 flex flex-col gap-1.5 border-t border-border pt-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>© {new Date().getFullYear()} The Dance Exclusive · Essex, UK</p>
              <p className="text-muted-foreground/70">Step in, stand out</p>
            </div>
          </div>
        </footer>
      ) : (
        <footer className={`relative border-t border-border mt-20 overflow-hidden transition-colors duration-500 ${isFocusRoute ? "hidden" : ""}`}>
          <div className="absolute inset-0 stage-light-duo opacity-25 pointer-events-none" />
          <div className="relative container py-16">
            <div className="grid gap-12 md:grid-cols-4">
              <div>
                <img src={logoDark} alt="The Dance Exclusive" className="w-28 object-contain mb-4" />
                <p className="text-sm text-muted-foreground normal-case leading-relaxed">
                  Essex's award-winning commercial &amp; street dance school for children and adults.
                  Step in, stand out.
                </p>
              </div>
              <div>
                <h4 className="font-display text-sm uppercase tracking-widest mb-4">Classes</h4>
                <ul className="space-y-2.5 text-sm text-muted-foreground normal-case">
                  <li><Link to="/classes/children" className="hover:text-primary hover:underline underline-offset-4 transition-colors">Children's Classes</Link></li>
                  <li><Link to="/classes/adult" className="hover:text-primary hover:underline underline-offset-4 transition-colors">Adult Classes</Link></li>
                  <li><Link to="/classes/children" className="hover:text-primary hover:underline underline-offset-4 transition-colors">Holiday Camps</Link></li>
                  <li><Link to="/classes/adult" className="hover:text-primary hover:underline underline-offset-4 transition-colors">Workshops</Link></li>
                  <li><Link to="/term-dates" className="hover:text-primary hover:underline underline-offset-4 transition-colors">Term Dates</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-display text-sm uppercase tracking-widest mb-4">Your Account</h4>
                <ul className="space-y-2.5 text-sm text-muted-foreground normal-case">
                  <li><Link to={user ? "/timetable" : "/auth"} className="hover:text-primary hover:underline underline-offset-4 transition-colors">Timetable</Link></li>
                  <li><Link to={user ? "/account/bookings" : "/auth"} className="hover:text-primary hover:underline underline-offset-4 transition-colors">My Bookings</Link></li>
                  <li><Link to={user ? "/account" : "/auth"} className="hover:text-primary hover:underline underline-offset-4 transition-colors">My Account</Link></li>
                  <li><Link to="/auth" className="hover:text-primary hover:underline underline-offset-4 transition-colors">Sign In / Register</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-display text-sm uppercase tracking-widest mb-4">Connect</h4>
                <div className="flex gap-3 mb-4">
                  <a href="https://instagram.com/thedanceexclusive" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                    <Instagram className="w-4 h-4" />
                  </a>
                  <a href="https://facebook.com/thedanceexclusive" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                    <Facebook className="w-4 h-4" />
                  </a>
                  <a href="mailto:hello@thedanceexclusive.co.uk" aria-label="Email" className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                    <Mail className="w-4 h-4" />
                  </a>
                </div>
                <p className="text-sm text-muted-foreground normal-case">Essex, United Kingdom</p>
              </div>
            </div>
            <div className="mt-14 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                © {new Date().getFullYear()} The Dance Exclusive • Essex, UK
              </p>
              <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">Step In, Stand Out</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default PortalLayout;
