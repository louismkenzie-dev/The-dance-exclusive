import { signInPath } from "@/lib/authReturn";
import CartButton from "@/components/portal/CartButton";
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, House, CalendarDays, MapPin, UserRound, LogOut } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicSchool } from "@/hooks/usePublicSchool";
import { defaultPublicContact } from "@/lib/publicSchool";
import "@/styles/public-site.css";
import "@/styles/public-brand.css";
import "@/styles/public-v2.css";
import "@/styles/customer-system.css";

const navigation = [
  { to: "/classes?type=children", label: "Children's classes" },
  { to: "/classes?type=adult", label: "Adult classes" },
  { to: "/about", label: "The school" },
  { to: "/team", label: "The team" },
  { to: "/venues", label: "Locations" },
  { to: "/events", label: "Camps & workshops" },
];

export function PublicSiteShell({ children, product = false, focus = false }: { children: ReactNode; product?: boolean; focus?: boolean }) {
  const { user, signOut } = useAuth();
  const { data: school } = usePublicSchool();
  const contact = school?.contact ?? defaultPublicContact;
  const { pathname, search } = useLocation();
  const home = pathname === "/";
  const adult = pathname.startsWith("/classes/adult") || (pathname === "/classes" && new URLSearchParams(search).get("type") === "adult");
  const hideTabs = focus || pathname.startsWith("/book/");
  useEffect(() => {
    document.body.classList.add("tde-customer-theme");
    document.body.classList.toggle("tde-customer-adult", adult);
    return () => document.body.classList.remove("tde-customer-theme", "tde-customer-adult");
  }, [adult]);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname, search]);
  return (
    <div className={`tde-site tde-v2 tde-customer-theme${adult ? " tde-customer-adult" : ""}${product ? " tde-product" : ""}${focus ? " tde-focus" : ""}${home ? " tde-site-home" : ""}`}>
      <a className="tde-skip" href="#main-content">
        Skip to content
      </a>
      <header className="tde-header">
        <div className="tde-header-signal" aria-hidden="true">Street dance<br />Commercial<br />Essex / UK</div>
        <nav className="tde-desktop-nav" aria-label="Main navigation">
          {user ? <><Link to="/classes">Classes</Link><Link to="/timetable">Timetable</Link><Link to="/account/bookings">My bookings</Link></> : <><Link to="/classes?type=children">Children</Link><Link to="/classes?type=adult">Adults</Link><Link to="/venues">Locations</Link></>}
        </nav>
        <Link
          to="/"
          className="tde-brand"
          aria-label="The Dance Exclusive home"
        >
          <BrandLogo tone="ink" className="h-11" />
        </Link>
        <div className="tde-header-right">
          <Link
            to={user ? "/account" : signInPath(pathname + search)}
            className="tde-account"
          >
            {user ? "Your account" : "Member login"}
          </Link>
          {!focus && <div className="tde-booking-theme"><CartButton /></div>}
          <Link to="/classes" className="tde-button tde-header-cta">
            Find your class <ArrowUpRight size={17} aria-hidden />
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="tde-menu-button" aria-label="Open navigation">
                <Menu size={25} />
              </button>
            </SheetTrigger>
            <SheetContent
              className="tde-menu-panel"
              side="right"
              aria-describedby={undefined}
            >
              <SheetTitle className="sr-only">
                The Dance Exclusive navigation
              </SheetTitle>
              <BrandLogo tone="white" className="h-14 mb-12" />
              <nav aria-label="All pages">
                {navigation.map((item, i) => (
                  <Link to={item.to} key={item.to}>
                    <span>0{i + 1}</span>
                    {item.label}
                    <ArrowUpRight size={22} aria-hidden />
                  </Link>
                ))}
              </nav>
              <div className="tde-menu-small">
                <Link to="/contact">Get in touch</Link>
                <Link to={user ? "/account" : signInPath(pathname + search)}>
                  {user ? "Your account" : "Member login"}
                </Link>
                <Link to="/term-dates">Term dates</Link>
                <Link to="/timetable">My timetable</Link>
                {user && <><Link to="/account/bookings">My bookings</Link><button type="button" onClick={() => void signOut()}><LogOut size={16} aria-hidden /> Sign out</button></>}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      {!hideTabs && <nav className="tde-mobile-tabs" aria-label="Quick navigation">
        <NavLink to="/" end><House size={21} aria-hidden /><span>Home</span></NavLink>
        <NavLink to="/classes"><CalendarDays size={21} aria-hidden /><span>Classes</span></NavLink>
        <NavLink to={user ? "/timetable" : "/venues"}>{user ? <CalendarDays size={21} aria-hidden /> : <MapPin size={21} aria-hidden />}<span>{user ? "Timetable" : "Locations"}</span></NavLink>
        <NavLink to={user ? "/account" : signInPath(pathname + search)}><UserRound size={21} aria-hidden /><span>{user ? "Account" : "Sign in"}</span></NavLink>
      </nav>}
      {product ? <footer className="tde-product-footer"><Link to="/classes">Find your class <ArrowUpRight size={16} aria-hidden /></Link><Link to="/info">Booking information</Link><Link to="/contact">Need a hand?</Link><span>© {new Date().getFullYear()} The Dance Exclusive</span></footer> :
      <footer className="tde-footer">
        <div className="tde-footer-top">
          <span className="tde-eyebrow">
            Your people. Your place. Your next move.
          </span>
          <a href={`mailto:${contact.email}`}>
            Let's talk <ArrowUpRight size={18} aria-hidden />
          </a>
        </div>
        <Link to="/classes" className="tde-footer-title">
          See you on
          <br />
          the floor.
          <ArrowUpRight aria-hidden />
        </Link>
        <Link to="/classes" className="tde-text-link tde-footer-class-link">Find your class <ArrowUpRight size={20} aria-hidden /></Link>
        <div className="tde-footer-links">
          <BrandLogo tone="ink" className="h-16" />
          <div>
            <span className="tde-eyebrow">Find your movement</span>
            {navigation.slice(0, 2).map((item) => (
              <Link to={item.to} key={item.to}>
                {item.label}
              </Link>
            ))}
            <Link to="/events">Camps & workshops</Link>
            <Link to="/parties">Dance parties</Link>
            <Link to="/schools">Dance in schools</Link>
          </div>
          <div>
            <span className="tde-eyebrow">Meet The Dance Exclusive</span>
            <Link to="/about">Our story</Link>
            <Link to="/team">Our team</Link>
            <Link to="/venues">Our locations</Link>
            <Link to="/gallery">Gallery</Link>
            <Link to="/results">Competition teams</Link>
            <Link to="/contact">Get in touch</Link>
          </div>
          <div>
            <span className="tde-eyebrow">Stay in the loop</span>
            <a
              href={contact.instagram}
              target="_blank"
              rel="noreferrer"
            >
              Instagram ↗
            </a>
            <a
              href={contact.facebook}
              target="_blank"
              rel="noreferrer"
            >
              Facebook ↗
            </a>
            <Link to="/info">Parent information</Link>
            <Link to="/term-dates">Term dates</Link>
          </div>
        </div>
        <div className="tde-footer-bottom">
          <span>© {new Date().getFullYear()} The Dance Exclusive</span>
          <span>Essex, UK. Everyone welcome.</span>
          <Link to="/info">Useful information</Link>
        </div>
      </footer>}
    </div>
  );
}
