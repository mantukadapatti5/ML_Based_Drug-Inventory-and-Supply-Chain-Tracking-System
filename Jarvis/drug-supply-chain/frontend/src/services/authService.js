import api from "./api";

const AUTH_PREFIX = "/api/auth";

export const registerUser = async (payload) => {
  const response = await api.post(`${AUTH_PREFIX}/register`, payload);
  return response.data;
};

/**
 * PRODUCTION-READY LOGIN ENDPOINT
 * 
 * Posts to: http://localhost:8000/api/auth/login
 * 
 * Request: { email: "admin@gmail.com", password: "admin@12" }
 * 
 * Response: {
 *   access_token: "jwt_string",
 *   token_type: "bearer",
 *   email: "admin@gmail.com",
 *   role: "admin",
 *   redirectTo: "/admin/dashboard",
 *   user_id: 1234,
 *   expires_at: "2026-06-07T..."
 * }
 */
export const loginUser = async (payload) => {
  try {
    const normalized = {
      email: String(payload?.email || "").trim(),
      password: String(payload?.password || ""),
    };

    console.log("🔐 Sending normalized login request:", normalized);
    const response = await api.post(`${AUTH_PREFIX}/login`, normalized, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log("✅ Login response:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Login error:", error.response?.status, error.response?.data);
    throw error;
  }
};

export const verifyOtp = async (payload) => {
  const response = await api.post(`${AUTH_PREFIX}/verify-otp`, payload);
  return response.data;
};

export const checkEmailRegistered = async (email) => {
  const response = await api.get(`${AUTH_PREFIX}/check-email/${encodeURIComponent(email)}`);
  return response.data;
};
