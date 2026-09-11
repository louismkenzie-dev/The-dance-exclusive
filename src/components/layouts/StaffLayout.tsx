import { useEffect, useState } from "react";
import { Link, NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  FileText,
  User,
  LogOut,
  ChevronRight,
  Menu,
} from "lucide-react";
import logo from "@/assets/logo-dark.png";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";
import { useStaffMember, getStaffPhotoUrl } from "@/hooks/useStaffMember";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/staff", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/staff/classes", label: "My Classes", icon: Calendar },
  { to: "/staff/registers", label: "Registers", icon: ClipboardList },
  { to: "/staff/documents", label: "Documents", icon: FileText },
  { to: "/staff/profile", label: "My Profile", icon: User },
];

const StaffLayout = () => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { staff } = useStaffMember();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const photo = staff?.profile_photo
    ? getStaffPhotoUrl(staff.profile_photo)
    : profile?.profile_photo ?? undefined;
  const initial = (staff?.first_name?.[0] || profile?.full_name?.[0] || "S").toUpperCase();

  const SidebarBody = (
    <>
      <div className="p-5 border-b border-sidebar-border">
          <Link to="/staff" className="flex flex-col items-center gap-1">
            <img src={logo} alt="The Dance Exclusive" className="w-32 object-contain" />
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Staff Portal</p>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.end
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <RouterNavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
              </RouterNavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center text-xs font-bold text-sidebar-primary overflow-hidden">
              {photo ? (
                <img src={photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">
                {staff?.full_name || profile?.full_name || "Staff"}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate capitalize">
                {staff?.role?.replace("_", " ") || "Team"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border flex-col">
        {SidebarBody}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className={cn(
            "md:hidden sticky top-0 z-30 flex items-center gap-2 px-3 border-b border-border bg-background/95 backdrop-blur transition-[height] duration-300 ease-out",
            scrolled ? "h-14" : "h-20",
          )}
        >
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border flex flex-col">
              {SidebarBody}
            </SheetContent>
          </Sheet>
          {/* The wordmark greets you at full size and steps back once you
              start scrolling. White, because this bar is always dark. It is
              centred in the strip left between the menu button and the right
              edge, so it doesn't sit under the button. */}
          <div className="flex flex-1 justify-center pr-10">
            <BrandLogo
              tone="white"
              className={cn(
                "transition-all duration-300 ease-out",
                scrolled ? "h-7" : "h-10",
              )}
            />
          </div>
        </header>
        <main
          className="app-screen portal-ui flex-1 overflow-auto"
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 24)}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default StaffLayout;