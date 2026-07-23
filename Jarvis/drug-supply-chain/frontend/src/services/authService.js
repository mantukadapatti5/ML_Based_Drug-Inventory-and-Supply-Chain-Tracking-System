import api from "./api";

const LOGIN_PATHS = ["/api/auth/login", "/auth/login", "/api/auth/email-password/login"];

export const registerUser = async (payload) => {
  const response = await api.post("/api/auth/register", payload);
  return response.data;
};

export const loginUser = async (payload) => {
  const normalized = {
    email: String(payload?.email || "").trim().toLowerCase(),
    password: String(payload?.password || ""),
  };

  let lastError = null;

  for (const path of LOGIN_PATHS) {
    try {
      const response = await api.post(path, normalized, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      if (status && status !== 404) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Login endpoint not found. Is the backend running on port 8000?");
};

export const verifyOtp = async (payload) => {
  const response = await api.post("/api/auth/verify-otp", payload);
  return response.data;
};

export const checkEmailRegistered = async (email) => {
  const response = await api.get(`/api/auth/check-email/${encodeURIComponent(email)}`);
  return response.data;
};
