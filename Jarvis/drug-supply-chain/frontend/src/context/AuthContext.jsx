import { createContext, useContext, useEffect, useState } from "react";
import { setAuthToken } from "../services/api";
import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("auth_token") || null);
  const [backendHealthy, setBackendHealthy] = useState(null);

  useEffect(() => {
    // Check backend health on app load
    const checkBackend = async () => {
      try {
        const response = await api.get("/health");
        setBackendHealthy(true);
        console.log("Backend health check passed:", response.data);
      } catch (error) {
        setBackendHealthy(false);
        console.error("Backend health check failed:", error.message);
      }
    };
    checkBackend();

    if (token) {
      setAuthToken(token);
      const storedUser = localStorage.getItem("auth_user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    }
  }, [token]);

  const login = (authData) => {
    if (authData.access_token) {
      localStorage.setItem("auth_token", authData.access_token);
      localStorage.setItem("auth_user", JSON.stringify({ 
        email: authData.email, 
        role: authData.role, 
        user_id: authData.user_id 
      }));
      setToken(authData.access_token);
      setUser({ 
        email: authData.email, 
        role: authData.role, 
        user_id: authData.user_id 
      });
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
    setAuthToken(null);
  };

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
