import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";
import PortalLayout from "@/components/layouts/PortalLayout";
import { DefaultPageMeta } from "@/components/marketing/PageMeta";

// Public discovery loads first. Account, checkout and administration load
// when needed, keeping the image-led front page light on mobile.
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PublicPages from "./pages/marketing/PublicPages";
import PublicClassPage from "./pages/marketing/PublicClassPage";
import PublicClassDirectory from "./pages/marketing/PublicClassDirectory";
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ClassBrowser = lazy(() => import("./pages/portal/ClassBrowser"));
const Timetable = lazy(() => import("./pages/portal/Timetable"));
const BookClass = lazy(() => import("./pages/marketing/LegacyClassLink"));
const Account = lazy(() => import("./pages/portal/Account"));
const MyBookings = lazy(() => import("./pages/portal/MyBookings"));
const Checkout = lazy(() => import("./pages/portal/Checkout"));
const CheckoutReturn = lazy(() => import("./pages/portal/CheckoutReturn"));
const AdminLayout = lazy(() => import("./components/layouts/AdminLayout"));
const AdminClassSession = lazy(() => import("./pages/admin/ClassSession"));
const StaffLayout = lazy(() => import("./components/layouts/StaffLayout"));

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
const PublicEditorialPages = lazy(() => import("./pages/marketing/PublicEditorialPages"));
const TermDates = lazy(() => import("./pages/portal/TermDates"));
const Shop = lazy(() => import("./pages/marketing/Shop"));
const Parties = lazy(() => import("./pages/marketing/Parties"));

const defaultQueryClient = new QueryClient();

const PageLoading = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-label="Loading" />
  </div>
);

const App = ({ queryClient = defaultQueryClient, Router = BrowserRouter }: { queryClient?: QueryClient; Router?: ComponentType<{ children: ReactNode }> }) => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <DefaultPageMeta />
        <ScrollToTop />
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
              <Route path="sessions/:sessionId" element={<AdminClassSession />} />
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
              <Route path="/classes" element={<PublicClassDirectory />} />
              <Route path="/classes/:type/:classId" element={<PublicClassPage />} />
              {/* Marketing */}
              <Route path="/about" element={<PublicEditorialPages />} />
              <Route path="/schools" element={<PublicEditorialPages />} />
              <Route path="/team" element={<PublicPages />} />
              <Route path="/team/:coachId" element={<PublicPages />} />
              <Route path="/results" element={<PublicEditorialPages />} />
              <Route path="/gallery" element={<PublicEditorialPages />} />
              <Route path="/venues" element={<PublicPages />} />
              <Route path="/venues/:venueSlug" element={<PublicPages />} />
              <Route path="/events" element={<PublicPages />} />
              <Route path="/events/:eventId" element={<PublicPages />} />
              <Route path="/parties" element={<Parties />} />
              <Route path="/info" element={<PublicEditorialPages />} />
              <Route path="/term-dates" element={<TermDates />} />
              <Route path="/contact" element={<PublicEditorialPages />} />
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
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
