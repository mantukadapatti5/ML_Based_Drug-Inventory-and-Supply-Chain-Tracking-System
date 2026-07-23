import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, role }) => {
  const { user, token, authLoaded } = useAuth();
  const location = useLocation();
  const storedToken = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const authToken = token || storedToken;
  const isAuthenticated = Boolean(user || authToken);

  if (!authLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        Loading authorization...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role) {
    const userRole = String(user?.role || "").toLowerCase().trim();
    const requiredRole = String(role).toLowerCase().trim();

    // No bypass: a missing or mismatched role is always denied, not waved through.
    if (userRole !== requiredRole) {
      console.warn(`Access denied. User role '${userRole || "none"}' does not match required role '${requiredRole}'`);
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;