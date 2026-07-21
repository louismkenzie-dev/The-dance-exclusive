import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  User,
  LogOut,
  CalendarDays,
  Sparkles,
  Heart,
  Menu,
  Instagram,
  Facebook,
  Mail,
  Home,
} from "lucide-react";
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

const marketingLinks = [
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

const PortalLayout = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const customerType = profile?.customer_type as string | null;
  const isAdultSection = pathname.startsWith("/classes/adult") || pathname.includes("adult");
  const isChildrenSection = pathname.startsWith("/classes/children");
  const themeClass = isAdultSection ? "theme-adult dark" : isChildrenSection ? "theme-children" : "";
  const brandLogo = isAdultSection ? logoDark : logo;

  // Determine nav order and emphasis based on customer preference
  const primaryIsAdult = customerType === "adult_dancer";
  const showBothEqual = !customerType || customerType === "both";
  const secondaryHidden = !showBothEqual; // hide the non-preferred tab when they chose one side

  let bookNowTarget = "/";
  if (isAdultSection) bookNowTarget = "/classes/adult";
  else if (isChildrenSection) bookNowTarget = "/classes/children";
  else if (customerType === "adult_dancer") bookNowTarget = "/classes/adult";
  else if (customerType === "parent_only") bookNowTarget = "/classes/children";
  const bookTrialTarget = user ? bookNowTarget : `/auth?redirect=${encodeURIComponent(bookNowTarget)}`;

  const classesDockTarget = primaryIsAdult ? "/classes/adult" : "/classes/children";
  const dockItems = [
    { to: "/", label: "Home", icon: Home, active: pathname === "/" },
    {
      to: classesDockTarget,
      label: "Classes",
      icon: Sparkles,
      active: pathname.startsWith("/classes"),
    },
    {
      to: user ? "/account/bookings" : "/auth?redirect=%2Faccount%2Fbookings",
      label: "Bookings",
      icon: CalendarDays,
      active: pathname.startsWith("/account/bookings"),
    },
    {
      to: user ? "/account" : "/auth",
      label: "Account",
      icon: User,
      active: pathname === "/account" || pathname === "/account/children",
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className={`min-h-screen bg-background text-foreground transition-colors duration-500 ${themeClass}`}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl transition-colors duration-500">
        <div className="container flex h-16 items-center justify-between md:h-20">
          <div className="flex items-center gap-1">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-80 flex-col p-0">
                <div className="flex items-center justify-center border-b border-border/50 p-6">
                  <img src={brandLogo} alt="The Dance Exclusive" className="w-24 object-contain" />
                </div>
                <nav className="flex-1 space-y-1 overflow-y-auto p-4">
                  <Link
                    to="/classes/children"
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary/60"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    Children's classes
                  </Link>
                  <Link
                    to="/classes/adult"
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary/60"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Heart className="h-4 w-4" />
                    </span>
                    Adult classes
                  </Link>
                  <div className="px-4 pb-1 pt-4">
                    <span className="eyebrow">Explore</span>
                  </div>
                  {marketingLinks.map((m) => (
                    <Link
                      key={m.to}
                      to={m.to}
                      className="block rounded-2xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                    >
                      {m.label}
                    </Link>
                  ))}
                  {user && (
                    <>
                      <div className="px-4 pb-1 pt-4">
                        <span className="eyebrow">Your account</span>
                      </div>
                      <Link
                        to="/account/bookings"
                        className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                      >
                        <CalendarDays className="h-4 w-4" /> My bookings
                      </Link>
                      <Link
                        to="/account"
                        className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                      >
                        <User className="h-4 w-4" /> My account
                      </Link>
                    </>
                  )}
                </nav>
                {user && (
                  <div className="border-t border-border/50 p-4">
                    <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start">
                      <LogOut className="mr-2 h-4 w-4" /> Sign out
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src={brandLogo}
                alt="The Dance Exclusive"
                className="h-11 w-11 rounded-xl object-contain md:h-14 md:w-14"
              />
              <span className="hidden font-display text-base font-extrabold tracking-tight lg:block">
                The Dance Exclusive
              </span>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {/* Show primary tab first based on customer preference */}
            {(primaryIsAdult ? ["adult", "children"] : ["children", "adult"]).map((tabType) => {
              const isAdult = tabType === "adult";
              const isActive = isAdult ? isAdultSection : isChildrenSection;
              const isSecondary =
                secondaryHidden &&
                ((customerType === "parent_only" && isAdult) ||
                  (customerType === "adult_dancer" && !isAdult));

              return (
                <Link
                  key={tabType}
                  to={`/classes/${tabType === "children" ? "children" : "adult"}`}
                  className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : isSecondary
                        ? "text-xs text-muted-foreground/60 hover:text-muted-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {isAdult ? <Heart className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {isAdult ? "Adults" : "Children"}
                  </span>
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full px-4 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Explore
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48 rounded-2xl p-1.5">
                {marketingLinks.map((m) => (
                  <DropdownMenuItem key={m.to} className="rounded-xl" onClick={() => navigate(m.to)}>
                    {m.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button asChild size="sm" className="ml-3">
              <Link to={bookTrialTarget}>
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Book a trial
              </Link>
            </Button>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
                >
                  <Link to="/account/bookings">
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> My bookings
                  </Link>
                </Button>
                <CartButton />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 pl-2 pr-3 text-muted-foreground hover:text-foreground"
                      aria-label="Open account menu"
                    >
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {profile?.profile_photo ? (
                          <img
                            src={profile.profile_photo}
                            alt={`${profile?.full_name || "Account"} profile photo`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          profile?.full_name?.charAt(0) || "U"
                        )}
                      </div>
                      <span className="hidden md:inline">Account</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
                    <DropdownMenuItem className="rounded-xl" onClick={() => navigate("/account")}>
                      <User className="mr-2 h-4 w-4" /> My account
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl md:hidden" onClick={() => navigate("/account/bookings")}>
                      <CalendarDays className="mr-2 h-4 w-4" /> My bookings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="rounded-xl" onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <CartButton />
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                  <Link to="/auth">Sign in</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Section colour indicator */}
        {(isChildrenSection || isAdultSection) && (
          <div className="h-0.5 w-full bg-gradient-to-r from-primary via-primary/70 to-transparent transition-all duration-500" />
        )}
      </header>

      <main className="pb-28 md:pb-0">
        <motion.div
          key={pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.6, 0.3, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
      <CartDrawer />
      <AttendeeOnboarding />

      {/* Floating dock — mobile app-style navigation */}
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-4 z-40 md:hidden"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex h-16 max-w-md items-center justify-around rounded-full border border-border/50 bg-card/90 px-2 shadow-soft-xl backdrop-blur-xl">
          {dockItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={`flex min-w-16 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 transition-colors ${
                item.active ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <footer className="relative mt-24 overflow-hidden border-t border-border/50 transition-colors duration-500">
        <div className="aurora-duo pointer-events-none absolute inset-0 opacity-60" />
        <div className="container relative py-16 md:py-20">
          <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <img src={brandLogo} alt="The Dance Exclusive" className="mb-5 w-20 rounded-2xl object-contain" />
              <p className="font-display text-2xl font-extrabold tracking-tight">
                Move <em className="font-serif font-normal italic text-primary">different.</em>
              </p>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Essex's award-winning commercial &amp; street dance school for children and adults.
              </p>
            </div>
            <div>
              <h4 className="eyebrow mb-5">Classes</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <Link to="/classes/children" className="transition-colors hover:text-primary">
                    Children's classes
                  </Link>
                </li>
                <li>
                  <Link to="/classes/adult" className="transition-colors hover:text-primary">
                    Adult classes
                  </Link>
                </li>
                <li>
                  <Link to="/classes/children" className="transition-colors hover:text-primary">
                    Holiday camps
                  </Link>
                </li>
                <li>
                  <Link to="/classes/adult" className="transition-colors hover:text-primary">
                    Workshops
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="eyebrow mb-5">Your account</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <Link to={user ? "/account/bookings" : "/auth"} className="transition-colors hover:text-primary">
                    My bookings
                  </Link>
                </li>
                <li>
                  <Link to={user ? "/account" : "/auth"} className="transition-colors hover:text-primary">
                    My account
                  </Link>
                </li>
                <li>
                  <Link to="/auth" className="transition-colors hover:text-primary">
                    Sign in / register
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="eyebrow mb-5">Connect</h4>
              <div className="mb-4 flex gap-3">
                <a
                  href="https://instagram.com/thedanceexclusive"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/70 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href="https://facebook.com/thedanceexclusive"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/70 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Facebook className="h-4 w-4" />
                </a>
                <a
                  href="mailto:hello@thedanceexclusive.co.uk"
                  aria-label="Email"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/70 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Mail className="h-4 w-4" />
                </a>
              </div>
              <p className="text-sm text-muted-foreground">Essex, United Kingdom</p>
            </div>
          </div>
          <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-border/50 pt-6 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} The Dance Exclusive · Essex, UK
            </p>
            <p className="text-xs text-muted-foreground/70">Move different</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PortalLayout;
