import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PortalLayout from "@/components/layouts/PortalLayout";
import AdminLayout from "@/components/layouts/AdminLayout";
import StaffLayout from "@/components/layouts/StaffLayout";

// The booking journey stays in the main bundle: a parent on a phone gets the
// landing page, class browser and checkout without any further downloads.
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import ClassBrowser from "./pages/portal/ClassBrowser";
import Timetable from "./pages/portal/Timetable";
import BookClass from "./pages/portal/BookClass";
import Account from "./pages/portal/Account";
import MyBookings from "./pages/portal/MyBookings";
import Checkout from "./pages/portal/Checkout";
import CheckoutReturn from "./pages/portal/CheckoutReturn";

// Everything else loads on demand, so parents never download the admin or
// staff areas at all — a large cut to the bundle phones fetch on 4G.
const StaffOnboarding = lazy(() => import("./pages/StaffOnboarding"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminClasses = lazy(() => import("./pages/admin/Classes"));
const AdminCamps = lazy(() => import("./pages/admin/Camps"));
const AdminBookings = lazy(() => import("./pages/admin/Bookings"));
const AdminRegisters = lazy(() => import("./pages/admin/Registers"));
const AdminAdmins = lazy(() => import("./pages/admin/Admins"));
const AdminCustomers = lazy(() => import("./pages/admin/Customers"));
const AdminStudents = lazy(() => import("./pages/admin/Students"));
const AdminVenues = lazy(() => import("./pages/admin/Venues"));
const AdminStaff = lazy(() => import("./pages/admin/Staff"));
const AdminWorkshops = lazy(() => import("./pages/admin/Workshops"));
const AdminCalendar = lazy(() => import("./pages/admin/Calendar"));
const AdminParties = lazy(() => import("./pages/admin/Parties"));
const AdminMerchandise = lazy(() => import("./pages/admin/Merchandise"));
const AdminCoupons = lazy(() => import("./pages/admin/Coupons"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const SettingsCompany = lazy(() => import("./pages/admin/SettingsCompany"));
const SettingsTermDates = lazy(() => import("./pages/admin/SettingsTermDates"));
const SettingsNavigation = lazy(() => import("./pages/admin/SettingsNavigation"));

// Staff pages
const StaffDashboard = lazy(() => import("./pages/staff/Dashboard"));
const StaffMyClasses = lazy(() => import("./pages/staff/MyClasses"));
const StaffRegisters = lazy(() => import("./pages/staff/Registers"));
const StaffDocuments = lazy(() => import("./pages/staff/Documents"));
const StaffProfile = lazy(() => import("./pages/staff/Profile"));

// Marketing pages
const About = lazy(() => import("./pages/marketing/About"));
const Team = lazy(() => import("./pages/marketing/Team"));
const Results = lazy(() => import("./pages/marketing/Results"));
const Gallery = lazy(() => import("./pages/marketing/Gallery"));
const Venues = lazy(() => import("./pages/marketing/Venues"));
const ParentInfo = lazy(() => import("./pages/marketing/ParentInfo"));
const Contact = lazy(() => import("./pages/marketing/Contact"));
const Shop = lazy(() => import("./pages/marketing/Shop"));
const Parties = lazy(() => import("./pages/marketing/Parties"));

const queryClient = new QueryClient();

const PageLoading = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-label="Loading" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
          <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* Auth */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/staff-onboarding/:token" element={<StaffOnboarding />} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="classes" element={<AdminClasses />} />
              <Route path="camps" element={<AdminCamps />} />
              <Route path="calendar" element={<AdminCalendar />} />
              <Route path="workshops" element={<AdminWorkshops />} />
              <Route path="parties" element={<AdminParties />} />
              <Route path="merchandise" element={<AdminMerchandise />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="coupons" element={<AdminCoupons />} />
              <Route path="registers" element={<AdminRegisters />} />
              <Route path="admins" element={<AdminAdmins />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="venues" element={<AdminVenues />} />
              <Route path="staff" element={<AdminStaff />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="settings/company" element={<SettingsCompany />} />
              <Route path="settings/term-dates" element={<SettingsTermDates />} />
              <Route path="settings/navigation" element={<SettingsNavigation />} />
            </Route>

            {/* Staff portal routes */}
            <Route path="/staff" element={<ProtectedRoute requiredRole="staff"><StaffLayout /></ProtectedRoute>}>
              <Route index element={<StaffDashboard />} />
              <Route path="classes" element={<StaffMyClasses />} />
              <Route path="registers" element={<StaffRegisters />} />
              <Route path="documents" element={<StaffDocuments />} />
              <Route path="profile" element={<StaffProfile />} />
            </Route>

            {/* Parent portal routes */}
            <Route element={<PortalLayout />}>
              <Route path="/" element={<Index />} />
              {/* Marketing */}
              <Route path="/about" element={<About />} />
              <Route path="/team" element={<Team />} />
              <Route path="/results" element={<Results />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/venues" element={<Venues />} />
              <Route path="/parties" element={<Parties />} />
              <Route path="/info" element={<ParentInfo />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/classes/:type" element={<ClassBrowser />} />
              <Route path="/timetable" element={<ProtectedRoute><Timetable /></ProtectedRoute>} />
              <Route path="/book/:classId" element={<BookClass />} />
              <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="/account/bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
              <Route path="/account/children" element={<ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/checkout/return" element={<ProtectedRoute><CheckoutReturn /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
