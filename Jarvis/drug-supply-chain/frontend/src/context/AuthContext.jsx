import { createContext, useContext, useEffect, useState } from "react";
import { setAuthToken } from "../services/api";
import api from "../services/api";

const normalizeRole = (role) => {
  if (!role) return "";
  return String(role).toLowerCase();
};

const AuthContext = createContext(null);

const decodeJwtPayload = (token) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded;
  } catch (err) {
    console.warn("Failed to decode JWT payload:", err);
    return null;
  }
};

const restoreUserFromToken = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return {
    email: payload.email || payload.sub || "",
    role: String(payload.role || "").toLowerCase().trim(),
    user_id: payload.sub || payload.user_id || null,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("auth_token") || null);
  const [backendHealthy, setBackendHealthy] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      if (token) {
        setAuthToken(token);

        const storedUser = localStorage.getItem("auth_user");
        let resolvedUser = null;

        if (storedUser) {
          try {
            resolvedUser = JSON.parse(storedUser);
          } catch (err) {
            console.warn("Failed to parse stored auth_user:", err);
            localStorage.removeItem("auth_user");
          }
        }

        // Only fall back to the JWT if there was no valid stored user —
        // never overwrite good data with a re-derived guess.
        if (!resolvedUser) {
          resolvedUser = restoreUserFromToken(token);
          if (resolvedUser) {
            localStorage.setItem("auth_user", JSON.stringify(resolvedUser));
          }
        }

        if (resolvedUser) setUser(resolvedUser);
      }

      setAuthLoaded(true);

      try {
        const response = await api.get("/health");
        setBackendHealthy(true);
        console.log("Backend health check passed:", response.data);
      } catch (error) {
        setBackendHealthy(false);
        console.error("Backend health check failed:", error.message);
      }
    };

    initializeAuth();
  }, [token]);

  const login = (authData) => {
    if (authData?.access_token) {
      const normalizedRole = normalizeRole(authData.role);
      const safeUser = {
        email: authData.email,
        role: normalizedRole,
        user_id: authData.user_id,
      };

      localStorage.setItem("auth_token", authData.access_token);
      localStorage.setItem("auth_user", JSON.stringify(safeUser));
      setAuthToken(authData.access_token);
      setToken(authData.access_token);
      setUser(safeUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
    setAuthToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, authLoaded, backendHealthy }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;