import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { icons, LogOut, ChevronRight, ChevronDown, Menu } from "lucide-react";
import logo from "@/assets/logo-dark.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavConfig } from "@/hooks/useNavConfig";
import type { NavItem } from "@/config/adminNavConfig";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import AdminOnboardingTour from "@/components/admin/AdminOnboardingTour";

const LucideIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = (icons as any)[name];
  if (!Icon) return <Menu className={className} />;
  return <Icon className={className} />;
};

const AdminLayout = () => {
  const { pathname } = useLocation();
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { navConfig } = useNavConfig();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Determine which groups should be auto-expanded based on active route
  const autoExpandedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of navConfig) {
      if (item.children?.some((c) => pathname === c.path || pathname.startsWith(c.path + "/"))) {
        ids.add(item.id);
      }
    }
    return ids;
  }, [navConfig, pathname]);

  const [manualToggle, setManualToggle] = useState<Record<string, boolean>>({});

  const isGroupOpen = (id: string) => {
    if (id in manualToggle) return manualToggle[id];
    return autoExpandedIds.has(id);
  };

  const toggleGroup = (id: string) => {
    setManualToggle((prev) => ({ ...prev, [id]: !isGroupOpen(id) }));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const renderItem = (item: NavItem, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      const isOpen = isGroupOpen(item.id);
      const isChildActive = item.children!.some(
        (c) => pathname === c.path || pathname.startsWith(c.path + "/")
      );
      return (
        <div key={item.id}>
          <button
            onClick={() => toggleGroup(item.id)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 w-full",
              depth > 0 && "ml-4",
              isChildActive
                ? "text-sidebar-primary-foreground font-semibold"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            style={{ fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 'normal' }}
          >
            <LucideIcon name={item.icon} className="w-4 h-4" />
            {item.label}
            {isOpen ? (
              <ChevronDown className="w-3 h-3 ml-auto" />
            ) : (
              <ChevronRight className="w-3 h-3 ml-auto" />
            )}
          </button>
          {isOpen && (
            <div className="pl-3 space-y-0.5">
              {item.children!.map((child) => renderItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const isActive = pathname === item.path || (item.path !== "/admin" && pathname.startsWith(item.path));
    return (
      <Link
        key={item.id}
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200",
          depth > 0 && "py-2",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
        style={{ fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 'normal' }}
      >
        <LucideIcon name={item.icon} className="w-4 h-4" />
        {item.label}
        {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
      </Link>
    );
  };

  const SidebarBody = (
    <>
      <div className="p-5 border-b border-sidebar-border">
          <div className="flex flex-col items-center gap-1">
            <img src={logo} alt="The Dance Exclusive" className="w-36 object-contain" />
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest" style={{ fontFamily: 'var(--font-body)' }}>Admin</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navConfig.map((item) => renderItem(item))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center text-xs font-bold text-sidebar-primary">
              {profile?.full_name?.charAt(0) || "A"}
            </div>
            <div className="flex-1 min-w-0" style={{ fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 'normal' }}>
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{profile?.full_name || "Admin"}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{profile?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" style={{ fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 'normal' }}>
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
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 h-16 px-3 border-b border-border bg-background/95 backdrop-blur">
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
          <span className="flex-1 text-center font-display font-bold text-2xl tracking-wider text-primary pr-10">DANCE EXCLUSIVE</span>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* First-login onboarding tour — auto-opens once, re-launchable from the Dashboard */}
      <AdminOnboardingTour />
    </div>
  );
};

export default AdminLayout;
