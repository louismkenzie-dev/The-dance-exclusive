import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import BrandLoader from "@/components/BrandLoader";
import { type AppRole, canAccessRoute, homeRouteFor } from "@/lib/routeAccess";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, loading, role } = useAuth();

  if (loading) {
    return <BrandLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admins may open every area; everyone else is sent to their natural home.
  if (!canAccessRoute(role as AppRole, requiredRole)) {
    return <Navigate to={homeRouteFor(role as AppRole)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
