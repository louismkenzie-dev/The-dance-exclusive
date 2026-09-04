export interface NavItem {
  id: string;
  label: string;
  icon: string; // lucide icon name
  path: string;
  children?: NavItem[];
}

export const DEFAULT_NAV_CONFIG: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/admin" },
  { id: "calendar", label: "Calendar", icon: "Calendar", path: "/admin/calendar" },
  { id: "classes", label: "Classes", icon: "BookOpen", path: "/admin/classes" },
  { id: "camps", label: "Camps", icon: "Tent", path: "/admin/camps" },
  { id: "workshops", label: "Type of Class", icon: "Sparkles", path: "/admin/workshops" },
  { id: "parties", label: "Parties", icon: "PartyPopper", path: "/admin/parties" },
  { id: "merchandise", label: "Merchandise", icon: "ShoppingBag", path: "/admin/merchandise" },
  { id: "bookings", label: "Bookings", icon: "ClipboardList", path: "/admin/bookings" },
  { id: "coupons", label: "Coupons", icon: "Ticket", path: "/admin/coupons" },
  { id: "registers", label: "Registers", icon: "UserCheck", path: "/admin/registers" },
  { id: "awards", label: "Awards", icon: "Trophy", path: "/admin/awards" },
  { id: "reports", label: "Financial Report", icon: "PoundSterling", path: "/admin/reports" },
  { id: "emails", label: "Bulk Emails", icon: "Mail", path: "/admin/emails" },
  {
    id: "users",
    label: "Users",
    icon: "Users",
    path: "",
    children: [
      { id: "admins", label: "Admins", icon: "ShieldCheck", path: "/admin/admins" },
      { id: "staff", label: "Staff", icon: "UserCog", path: "/admin/staff" },
      { id: "customers", label: "Customers", icon: "Users", path: "/admin/customers" },
      { id: "students", label: "Students", icon: "GraduationCap", path: "/admin/students" },
    ],
  },
  { id: "venues", label: "Venues", icon: "MapPin", path: "/admin/venues" },
  { id: "settings", label: "Settings", icon: "Settings", path: "/admin/settings" },
];

export const NAV_SETTINGS_KEY = "admin_nav_config";

/** Every id in a config tree, including nested children. */
const collectIds = (items: NavItem[], into: Set<string> = new Set()): Set<string> => {
  for (const item of items) {
    into.add(item.id);
    if (item.children?.length) collectIds(item.children, into);
  }
  return into;
};

/**
 * A saved navigation layout is a snapshot of the menu on the day it was saved,
 * so pages added later would never appear for a studio that has customised
 * theirs. Merge instead: keep the saved order exactly as it is, and append
 * anything from the defaults that the saved layout has never seen — nested
 * defaults land inside their parent group when that group still exists.
 */
export function mergeNavConfig(saved: NavItem[], defaults: NavItem[] = DEFAULT_NAV_CONFIG): NavItem[] {
  const known = collectIds(saved);
  const merged = saved.map((item) => {
    const fallback = defaults.find((d) => d.id === item.id);
    const missingChildren = (fallback?.children ?? []).filter((c) => !known.has(c.id));
    return missingChildren.length > 0
      ? { ...item, children: [...(item.children ?? []), ...missingChildren] }
      : item;
  });
  return [...merged, ...defaults.filter((d) => !known.has(d.id))];
}
