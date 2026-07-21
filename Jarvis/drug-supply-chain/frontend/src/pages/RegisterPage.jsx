import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../services/authService";

const RegisterPage = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "vendor", license_no: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      await registerUser(form);
      setSuccess("Registration submitted. An administrator must verify your license before you can log in.");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : err.message || "Registration failed.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900 mb-4">Register</h1>
        {error && <div className="mb-4 rounded-xl bg-red-50 text-red-700 p-3">{error}</div>}
        {success && <div className="mb-4 rounded-xl bg-emerald-50 text-emerald-700 p-3">{success}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Full Name</span>
            <input name="name" value={form.name} onChange={handleChange} required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input name="email" type="email" value={form.email} onChange={handleChange} required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input name="password" type="password" value={form.password} onChange={handleChange} required minLength={8} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Role</span>
            <select name="role" value={form.role} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500">
              <option value="vendor">Vendor</option>
              <option value="distributor">Distributor</option>
              <option value="regulator">Regulator (Government Authority)</option>
            </select>
          </label>
          {form.role !== "regulator" && (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">License No. (min 8 chars)</span>
              <input name="license_no" value={form.license_no} onChange={handleChange} required minLength={8} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </label>
          )}
          <button type="submit" className="w-full rounded-2xl bg-sky-600 text-white py-3 font-semibold hover:bg-sky-700">Register</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account? <Link className="text-sky-600 hover:underline" to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;



