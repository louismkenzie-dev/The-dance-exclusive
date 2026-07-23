import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { User, LogOut, CalendarDays, Sparkles, Heart, Menu, Instagram, Facebook, Mail } from "lucide-react";
import CartButton from "@/components/portal/CartButton";
import CartDrawer from "@/components/portal/CartDrawer";
import AttendeeOnboarding from "@/components/portal/AttendeeOnboarding";
import logo from "@/assets/logo.png";
import logoDark from "@/assets/logo-dark.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
  const themeClass = isAdultSection ? "theme-adult" : isChildrenSection ? "theme-children" : "";

  // Radix Select/Dropdown popovers portal to document.body, escaping the
  // themed wrapper div — mirror the audience theme onto <body> so dropdowns
  // are blue in the children section and pink in the adult section.
  useEffect(() => {
    document.body.classList.remove("theme-adult", "theme-children");
    if (themeClass) document.body.classList.add(themeClass);
    return () => document.body.classList.remove("theme-adult", "theme-children");
  }, [themeClass]);

  // Determine nav order and emphasis based on customer preference
  const primaryIsAdult = customerType === "adult_dancer";
  const showBothEqual = !customerType || customerType === "both";
  const secondaryHidden = !showBothEqual; // hide the non-preferred tab when they chose one side

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className={`min-h-screen bg-background ${themeClass}`}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md transition-colors duration-500">
        <div className="container flex h-16 md:h-28 items-center justify-between">
          <div className="flex items-center gap-1">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col">
                <div className="p-5 border-b border-border flex items-center justify-center">
                  <img src={logoDark} alt="The Dance Exclusive" className="w-28 object-contain" />
                </div>
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                  <Link to="/classes/children" className="flex items-center gap-2 px-3 py-3 rounded-md hover:bg-accent text-sm font-semibold uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" /> Children Classes
                  </Link>
                  <Link to="/classes/adult" className="flex items-center gap-2 px-3 py-3 rounded-md hover:bg-accent text-sm font-semibold uppercase tracking-wider">
                    <Heart className="w-4 h-4" /> Adult Classes
                  </Link>
                  <div className="my-2 border-t border-border" />
                  {[
                    { to: "/about", label: "About" },
                    { to: "/team", label: "The Team" },
                    { to: "/results", label: "Results & Awards" },
                    { to: "/gallery", label: "Gallery" },
                    { to: "/shop", label: "Shop" },
                    { to: "/venues", label: "Venues" },
                    { to: "/parties", label: "Parties" },
                    { to: "/info", label: "Parent Info" },
                    { to: "/contact", label: "Contact" },
                  ].map((m) => (
                    <Link key={m.to} to={m.to} className="block px-3 py-2.5 rounded-md hover:bg-accent text-sm font-semibold uppercase tracking-wider">
                      {m.label}
                    </Link>
                  ))}
                  <div className="my-2 border-t border-border" />
                  <Link to="/timetable" className="flex items-center gap-2 px-3 py-3 rounded-md hover:bg-accent text-sm font-semibold uppercase tracking-wider">
                    <CalendarDays className="w-4 h-4" /> Timetable
                  </Link>
                  {user && (
                    <>
                      <Link to="/account/bookings" className="flex items-center gap-2 px-3 py-3 rounded-md hover:bg-accent text-sm font-semibold uppercase tracking-wider">
                        <CalendarDays className="w-4 h-4" /> My Bookings
                      </Link>
                      <Link to="/account" className="flex items-center gap-2 px-3 py-3 rounded-md hover:bg-accent text-sm font-semibold uppercase tracking-wider">
                        <User className="w-4 h-4" /> My Account
                      </Link>
                    </>
                  )}
                </nav>
                {user && (
                  <div className="p-3 border-t border-border">
                    <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start">
                      <LogOut className="w-4 h-4 mr-2" /> Sign out
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
            <Link to="/" className="flex items-center gap-2.5">
              <img src={isChildrenSection ? logo : logoDark} alt="The Dance Exclusive" className="w-14 h-14 md:w-36 md:h-36 object-contain rounded" />
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {/* Show primary tab first based on customer preference */}
            {(primaryIsAdult ? ["adult", "children"] : ["children", "adult"]).map((tabType) => {
              const isAdult = tabType === "adult";
              const isActive = isAdult ? isAdultSection : isChildrenSection;
              const isSecondary = secondaryHidden && (
                (customerType === "parent_only" && isAdult) ||
                (customerType === "adult_dancer" && !isAdult)
              );

              return (
                <Link
                  key={tabType}
                  to={`/classes/${tabType === "children" ? "children" : "adult"}`}
                  className={`relative px-5 py-2 text-sm font-semibold uppercase tracking-wider transition-all duration-300 rounded-full ${
                    isActive
                      ? isAdult
                        ? "bg-[hsl(330,90%,55%)] text-white shadow-lg shadow-[hsl(330,90%,55%)]/25"
                        : "bg-[hsl(193,100%,44%)] text-white shadow-lg shadow-[hsl(193,100%,44%)]/25"
                      : isSecondary
                        ? "text-muted-foreground/50 hover:text-muted-foreground text-xs"
                        : "text-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {isAdult ? <Heart className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {isAdult ? "Adults" : "Children"}
                  </span>
                </Link>
              );
            })}

            {/* Members' timetable — quiet pill next to the audience tabs */}
            <Link
              to="/timetable"
              className={`relative px-5 py-2 text-sm font-semibold uppercase tracking-wider transition-all duration-300 rounded-full ${
                pathname === "/timetable"
                  ? "bg-muted text-foreground"
                  : "text-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Timetable
              </span>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-foreground hover:text-foreground/80 uppercase tracking-wider text-xs font-semibold px-4">
                  Explore
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-44">
                <DropdownMenuItem onClick={() => navigate("/about")}>About</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/team")}>The Team</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/results")}>Results &amp; Awards</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/gallery")}>Gallery</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/shop")}>Shop</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/venues")}>Venues</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/parties")}>Parties</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/info")}>Parent Info</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/contact")}>Contact</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {(() => {
              let bookNowTarget = "/";
              if (isAdultSection) bookNowTarget = "/classes/adult";
              else if (isChildrenSection) bookNowTarget = "/classes/children";
              else if (customerType === "adult_dancer") bookNowTarget = "/classes/adult";
              else if (customerType === "parent_only") bookNowTarget = "/classes/children";
              const finalTarget = user ? bookNowTarget : `/auth?redirect=${encodeURIComponent(bookNowTarget)}`;
              return (
                <Button asChild size="sm" className="ml-3 font-semibold uppercase tracking-wider text-xs">
                  <Link to={finalTarget}>
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Book a Trial
                  </Link>
                </Button>
              );
            })()}
          </nav>

          <div className="flex items-center gap-2">

            {user ? (
              <>
                <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex text-muted-foreground hover:text-foreground uppercase tracking-wider text-xs">
                  <Link to="/account/bookings">
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> My Bookings
                  </Link>
                </Button>
                <CartButton />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground uppercase tracking-wider text-xs gap-2 pl-2 pr-3"
                      aria-label="Open account menu"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[11px] font-bold text-primary overflow-hidden">
                        {profile?.profile_photo ? (
                          <img src={profile.profile_photo} alt={`${profile?.full_name || "Account"} profile photo`} className="w-full h-full object-cover" />
                        ) : (
                          profile?.full_name?.charAt(0) || "U"
                        )}
                      </div>
                      <span className="hidden md:inline">My Account</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate("/account")}>
                      <User className="w-4 h-4 mr-2" /> My Account
                    </DropdownMenuItem>
                    <DropdownMenuItem className="md:hidden" onClick={() => navigate("/account/bookings")}>
                      <CalendarDays className="w-4 h-4 mr-2" /> My Bookings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="w-4 h-4 mr-2" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <CartButton />
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground uppercase tracking-wider text-xs">
                  <Link to="/auth">Sign In</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Section colour bar indicator */}
        {(isChildrenSection || isAdultSection) && (
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

      <footer className="relative border-t border-border mt-20 overflow-hidden transition-colors duration-500">
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
    </div>
  );
};

export default PortalLayout;
