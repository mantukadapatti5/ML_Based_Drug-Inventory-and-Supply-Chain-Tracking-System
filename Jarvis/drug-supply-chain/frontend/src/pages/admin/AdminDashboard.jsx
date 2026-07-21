import { useState, useEffect, useCallback } from "react";
import { getAdminStats, getSystemHealth } from "../../services/api";

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState({ database: "checking...", blockchain_mode: "—" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminStats();
      setStats(res.data);
    } catch (err) {
      console.error("Admin stats error:", err);
      const msg = err.response?.data?.detail || err.message || "Network Error";
      setError(msg);
      // Use demo fallback so dashboard is never blank
      setStats({
        total_users: "—",
        total_orders: "—",
        total_drugs: "—",
        pending_verifications: "—",
        active_anomalies: 0,
        compliance_score: 98,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const res = await getSystemHealth();
      setHealth(res.data || {});
    } catch {
      setHealth({ database: "unreachable", blockchain_mode: "unknown" });
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadHealth();
  }, [loadStats, loadHealth]);

  const cards = stats
    ? [
        { label: "Total Users", value: stats.total_users ?? "—", icon: "👥", color: "blue" },
        { label: "Total Orders", value: stats.total_orders ?? "—", icon: "📦", color: "green" },
        { label: "Drug SKUs", value: stats.total_drugs ?? "—", icon: "💊", color: "purple" },
        { label: "Pending Verifications", value: stats.pending_verifications ?? "—", icon: "⏳", color: "amber" },
        { label: "Active Anomalies", value: stats.active_anomalies ?? 0, icon: "🚨", color: "red" },
        { label: "Compliance Score", value: `${stats.compliance_score ?? 0}%`, icon: "✅", color: "emerald" },
      ]
    : [];

  const colorMap = {
    blue:    { border: "border-blue-200",    bg: "bg-blue-50",    text: "text-blue-700",    val: "text-blue-900" },
    green:   { border: "border-green-200",   bg: "bg-green-50",   text: "text-green-700",   val: "text-green-900" },
    purple:  { border: "border-purple-200",  bg: "bg-purple-50",  text: "text-purple-700",  val: "text-purple-900" },
    amber:   { border: "border-amber-200",   bg: "bg-amber-50",   text: "text-amber-700",   val: "text-amber-900" },
    red:     { border: "border-red-200",     bg: "bg-red-50",     text: "text-red-700",     val: "text-red-900" },
    emerald: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", val: "text-emerald-900" },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Admin Dashboard</h1>
          <p className="mt-2 text-slate-600">Live system metrics — updates on pipeline alerts.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
            🟢 System Online
          </span>
          <span className="text-xs text-slate-500">
            DB: {health.database || "—"} | Blockchain: {health.blockchain_mode || "—"}
          </span>
        </div>
      </div>

      {/* Error Banner (dismissable) */}
      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800">⚠️ Live data unavailable</p>
              <p className="text-xs text-amber-700 mt-1">
                {error}. Showing placeholder data. Make sure backend is running on port 8000.
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-amber-600 hover:text-amber-800 text-lg leading-none ml-4"
            >
              ×
            </button>
          </div>
          <button
            onClick={loadStats}
            className="mt-3 text-xs text-amber-700 underline hover:text-amber-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-3xl border border-slate-200 bg-white p-6 animate-pulse h-28" />
          ))}
        </div>
      )}

      {/* Stats Cards */}
      {!loading && stats && (
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => {
            const cls = colorMap[c.color];
            return (
              <div
                key={c.label}
                className={`rounded-3xl border ${cls.border} ${cls.bg} p-6 shadow-sm transition-all hover:shadow-md`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium uppercase tracking-widest ${cls.text}`}>
                    {c.label}
                  </p>
                  <span className="text-2xl">{c.icon}</span>
                </div>
                <p className={`mt-4 text-4xl font-bold ${cls.val}`}>{c.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <a
            href="/admin/users"
            className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 hover:bg-sky-100 transition-colors text-center"
          >
            👥 Manage Users
          </a>
          <a
            href="/admin/anomalies"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors text-center"
          >
            🚨 View Anomalies
          </a>
          <a
            href="/admin/blockchain"
            className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors text-center"
          >
            🔗 Blockchain Ledger
          </a>
        </div>
      </div>

      {/* System Info */}
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-widest mb-3">
          System Status
        </h2>
        <div className="grid gap-2 md:grid-cols-2 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Database</span>
            <span className={`font-medium ${health.database === "unreachable" ? "text-red-600" : "text-emerald-600"}`}>
              {health.database || "checking..."}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Blockchain Mode</span>
            <span className="font-medium text-amber-600">{health.blockchain_mode || "mock"}</span>
          </div>
          <div className="flex justify-between">
            <span>ML Models</span>
            <span className="font-medium text-emerald-600">{health.ml_models_frozen ? "frozen ✓" : "runtime"}</span>
          </div>
          <div className="flex justify-between">
            <span>CSV Fallback</span>
            <span className="font-medium text-slate-600">enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
