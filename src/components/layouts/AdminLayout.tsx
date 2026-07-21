import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { icons, LogOut, ChevronRight, ChevronDown, Menu } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavConfig } from "@/hooks/useNavConfig";
import type { NavItem } from "@/config/adminNavConfig";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
      return (
        <div key={item.id}>
          <button
            type="button"
            onClick={() => toggleGroup(item.id)}
            aria-expanded={isOpen}
            className="flex w-full items-center gap-2 rounded-2xl px-3 pb-1 pt-4 text-left transition-colors"
          >
            <span className="eyebrow">{item.label}</span>
            {isOpen ? (
              <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
            )}
          </button>
          {isOpen && (
            <div className="space-y-1">
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
          "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-secondary font-semibold text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
            isActive ? "bg-primary/10 text-primary" : "bg-secondary/80 text-muted-foreground"
          )}
        >
          <LucideIcon name={item.icon} className="h-4 w-4" />
        </span>
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const sidebarBody = (
    <>
      <div className="flex flex-col items-center gap-1.5 px-5 pb-3 pt-7">
        <img src={logo} alt="The Dance Exclusive" className="w-28 object-contain" />
        <p className="eyebrow">Admin</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {navConfig.map((item) => renderItem(item))}
      </nav>

      <div className="p-3">
        <div className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {profile?.full_name?.charAt(0) || "A"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{profile?.full_name || "Admin"}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
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

export default AdminLayout;
