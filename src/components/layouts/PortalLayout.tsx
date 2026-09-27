import { Outlet, useLocation } from "react-router-dom";
import { PublicSiteShell } from "@/components/marketing/PublicSiteShell";
import CartDrawer from "@/components/portal/CartDrawer";
import AttendeeOnboarding from "@/components/portal/AttendeeOnboarding";

/** Customer pages share one brand shell; tools retain their existing task layouts. */
const PortalLayout = () => {
  const { pathname } = useLocation();
  const integratedClass = /^\/classes\/(children|adult)\/[^/]+$/.test(pathname);
  const product = /^\/classes\/(children|adult)$/.test(pathname) ||
    pathname.startsWith("/book/") || pathname.startsWith("/account") ||
    pathname.startsWith("/checkout") || pathname === "/timetable" || pathname === "/term-dates";
  const focus = pathname.startsWith("/checkout");
  // Booking forms own attendee setup. Do not launch a second wizard over them or checkout.
  const ownsAttendees = integratedClass || pathname.startsWith("/book/") || focus;
  return <PublicSiteShell product={product} focus={focus}>
    {product ? <div className="tde-booking-page portal-ui"><Outlet /></div> : <Outlet />}
    <CartDrawer />
    {!ownsAttendees && <AttendeeOnboarding />}
  </PublicSiteShell>;
};

export default PortalLayout;
