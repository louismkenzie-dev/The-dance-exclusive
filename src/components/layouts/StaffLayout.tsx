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
  Menu,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useStaffMember, getStaffPhotoUrl } from "@/hooks/useStaffMember";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/staff", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/staff/classes", label: "My classes", icon: Calendar },
  { to: "/staff/registers", label: "Registers", icon: ClipboardList },
  { to: "/staff/documents", label: "Documents", icon: FileText },
  { to: "/staff/profile", label: "My profile", icon: User },
];

const StaffLayout = () => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { staff } = useStaffMember();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const sidebarBody = (
    <>
      <div className="px-5 pb-3 pt-7">
        <Link to="/staff" className="flex flex-col items-center gap-1.5">
          <img src={logo} alt="The Dance Exclusive" className="w-28 object-contain" />
          <p className="eyebrow">Staff portal</p>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
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
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "bg-secondary/80 text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate">{item.label}</span>
            </RouterNavLink>
          );
        })}
      </nav>

      <div className="p-3">
        <div className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {photo ? (
              <img src={photo} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {staff?.full_name || profile?.full_name || "Staff"}
            </p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {staff?.role?.replace("_", " ") || "Team"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed bottom-3 left-3 top-3 z-40 hidden w-[264px] flex-col overflow-hidden rounded-3xl bg-card shadow-soft-lg md:flex">
        {sidebarBody}
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/50 bg-background/80 px-3 backdrop-blur-xl md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[280px] flex-col p-0">
            {sidebarBody}
          </SheetContent>
        </Sheet>
        <span className="flex-1 pr-10 text-center font-display text-lg font-bold tracking-tight text-foreground">
          The Dance Exclusive
        </span>
      </header>

      <main className="md:pl-[280px]">
        <Outlet />
      </main>
    </div>
  );
};

export default StaffLayout;
