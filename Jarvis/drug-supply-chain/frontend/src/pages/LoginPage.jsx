import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser, verifyOtp, checkEmailRegistered } from "../services/authService";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [otpMode, setOtpMode] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [registrationHint, setRegistrationHint] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleEmailBlur = async () => {
    if (!form.email.includes("@")) return;
    try {
      const result = await checkEmailRegistered(form.email);
      if (!result.registered) {
        setRegistrationHint("This email is not registered. Please sign up first.");
      } else if (!result.verified) {
        setRegistrationHint("Account found but pending admin verification.");
      } else {
        setRegistrationHint("");
      }
    } catch {
      setRegistrationHint("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setRegistrationHint("");

    console.log("📋 Form before submit:", JSON.stringify(form));
    console.log("📋 Email type:", typeof form.email, "Password type:", typeof form.password);
    console.log("📋 Email length:", form.email.length, "Password length:", form.password.length);

    try {
      const safeForm = {
        email: String(form.email || "").trim(),
        password: String(form.password || ""),
      };
      const result = await loginUser(safeForm);
      
      // ═══════════════════════════════════════════════════════════════════════
      // PRODUCTION-READY RBAC LOGIN FLOW
      // ═══════════════════════════════════════════════════════════════════════
      
      // 1. Validate response contains required fields
      if (!result.access_token || !result.redirectTo || !result.role) {
        setError("Invalid response from server. Missing required fields.");
        return;
      }

      // 2. Store auth data in context (which updates localStorage)
      login(result);
      
      // 3. Log for debugging
      console.log(`✅ Login successful for ${result.email} (${result.role})`);
      console.log(`📍 Redirecting to: ${result.redirectTo}`);

      // 4. Navigate to the EXACT path returned by backend (production-ready)
      // This ensures the backend controls all redirect logic
      navigate(result.redirectTo, { replace: true });
      
    } catch (err) {
      if (!err.response) {
        setError("Cannot reach the backend. Start it with: python -m uvicorn backend.main:app --reload --port 8000");
        return;
      }
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : err.message || "Login failed.");
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");

    if (!tempToken) {
      setError("Session expired. Please log in again.");
      setOtpMode(false);
      return;
    }

    try {
      const result = await verifyOtp({
        temp_token: tempToken,
        otp: otp.trim(),
      });
      login(result);
      navigate(`/${result.role}/dashboard`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "OTP verification failed.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900 mb-4">Sign in</h1>
        {error && <div className="mb-4 rounded-xl bg-red-50 text-red-700 p-3">{error}</div>}
        {registrationHint && (
          <div className="mb-4 rounded-xl bg-amber-50 text-amber-800 p-3 text-sm">{registrationHint}</div>
        )}
        {!otpMode ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handleEmailBlur}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <button type="submit" className="w-full rounded-2xl bg-sky-600 text-white py-3 font-semibold hover:bg-sky-700">
              Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">
                Admin MFA required. Use OTP <strong>123456</strong> to continue.
              </p>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">OTP Code</span>
              <input
                name="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <button type="submit" className="w-full rounded-2xl bg-sky-600 text-white py-3 font-semibold hover:bg-sky-700">
              Verify OTP
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-slate-500">
          New user? <Link className="text-sky-600 hover:underline" to="/register">Register here</Link>
        </p>
        <p className="mt-3 text-center text-xs text-slate-400">
          Demo: vendor@gmail.com / vendor@12 · dis@gmail.com / dis@12 · admin@gmail.com / admin@12
        </p>
      </div>
    </div>
  );
};

export default LoginPage;



