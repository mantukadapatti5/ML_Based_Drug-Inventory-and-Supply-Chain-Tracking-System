import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, role }) => {
  const { user, token } = useAuth();
  const storedToken = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const isAuthenticated = Boolean(user || token || storedToken);

  // ═══════════════════════════════════════════════════════════════════════════════════
  // If no user/token, redirect to login
  // ═══════════════════════════════════════════════════════════════════════════════════
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRODUCTION-READY ROLE VALIDATION
  // - Backend returns lowercase roles (admin, vendor, distributor)
  // - Route specifies role requirement (admin, vendor, distributor)
  // - Must match exactly
  // ═══════════════════════════════════════════════════════════════════════
  if (role && user?.role) {
    const userRole = String(user.role).toLowerCase().trim();
    const requiredRole = String(role).toLowerCase().trim();
    
    if (userRole !== requiredRole) {
      console.warn(`Access denied. User role '${userRole}' does not match required role '${requiredRole}'`);
      return <Navigate to="/login" replace />;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // User is authenticated and authorized
  // ═══════════════════════════════════════════════════════════════════════
  return children;
};

export default ProtectedRoute;
