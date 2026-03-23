import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Overuji prihlaseni...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
