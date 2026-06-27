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
