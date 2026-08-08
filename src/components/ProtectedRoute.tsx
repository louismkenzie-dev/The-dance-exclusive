import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import BrandLoader from "@/components/BrandLoader";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "parent" | "staff";
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, loading, role } = useAuth();

  if (loading) {
    return <BrandLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    // Send users to their natural home
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "staff") return <Navigate to="/staff" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
