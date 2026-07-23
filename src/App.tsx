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

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import StaffOnboarding from "./pages/StaffOnboarding";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminClasses from "./pages/admin/Classes";
import AdminCamps from "./pages/admin/Camps";
import AdminBookings from "./pages/admin/Bookings";
import AdminRegisters from "./pages/admin/Registers";
import AdminAdmins from "./pages/admin/Admins";
import AdminCustomers from "./pages/admin/Customers";
import AdminStudents from "./pages/admin/Students";
import AdminVenues from "./pages/admin/Venues";
import AdminStaff from "./pages/admin/Staff";
import AdminWorkshops from "./pages/admin/Workshops";
import AdminCalendar from "./pages/admin/Calendar";
import AdminParties from "./pages/admin/Parties";
import AdminMerchandise from "./pages/admin/Merchandise";
import AdminCoupons from "./pages/admin/Coupons";
import AdminSettings from "./pages/admin/Settings";
import SettingsCompany from "./pages/admin/SettingsCompany";
import SettingsTermDates from "./pages/admin/SettingsTermDates";
import SettingsNavigation from "./pages/admin/SettingsNavigation";

// Staff pages
import StaffDashboard from "./pages/staff/Dashboard";
import StaffMyClasses from "./pages/staff/MyClasses";
import StaffRegisters from "./pages/staff/Registers";
import StaffDocuments from "./pages/staff/Documents";
import StaffProfile from "./pages/staff/Profile";

// Marketing pages
import About from "./pages/marketing/About";
import Team from "./pages/marketing/Team";
import Results from "./pages/marketing/Results";
import Gallery from "./pages/marketing/Gallery";
import Venues from "./pages/marketing/Venues";
import ParentInfo from "./pages/marketing/ParentInfo";
import Contact from "./pages/marketing/Contact";
import Shop from "./pages/marketing/Shop";
import Parties from "./pages/marketing/Parties";

// Portal pages
import ClassBrowser from "./pages/portal/ClassBrowser";
import Timetable from "./pages/portal/Timetable";
import BookClass from "./pages/portal/BookClass";
import Account from "./pages/portal/Account";
import MyBookings from "./pages/portal/MyBookings";
import Checkout from "./pages/portal/Checkout";
import CheckoutReturn from "./pages/portal/CheckoutReturn";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
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
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
