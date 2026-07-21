import { useState, useEffect } from "react";
import { getOrders, getSales } from "../../services/api";
import { formatINR } from "../../utils/currency";
import api from "../../services/api";

const DistributorDashboard = () => {
  const [stats, setStats]     = useState(null);
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadAll = async () => {
    setError(null);
    try {
      // Use distributor-specific stats — NO admin role needed
      const [statsRes, ordersRes] = await Promise.all([
        api.get("/api/analytics/distributor-stats", { params: { distributor_id: 3 } }),
        getOrders(),
      ]);
      setStats(statsRes.data);
      setOrders((ordersRes.data?.orders || []).slice(0, 5));
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Could not reach backend. Showing fallback data.");
      // Fallback so dashboard is never blank
      setStats({
        total_orders: "—",
        pending_orders: "—",
        delivered_orders: "—",
        total_revenue: 0,
        active_anomalies: 0,
        expiry_alerts: 0,
        compliance_score: 98,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // Auto-refresh every 30s for live feel
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const cards = stats ? [
    { label: "Total Orders",      value: stats.total_orders,      icon: "📦", color: "sky" },
    { label: "Pending",           value: stats.pending_orders,    icon: "⏳", color: "amber" },
    { label: "Delivered",         value: stats.delivered_orders,  icon: "✅", color: "emerald" },
    { label: "Revenue",           value: stats.total_revenue !== "—" ? formatINR(stats.total_revenue) : "—", icon: "₹", color: "purple" },
    { label: "Active Anomalies",  value: stats.active_anomalies,  icon: "🚨", color: "red" },
    { label: "Expiry Alerts",     value: stats.expiry_alerts,     icon: "⏰", color: "orange" },
  ] : [];

  const colorBg = {
    sky:     "bg-sky-50 border-sky-200 text-sky-700",
    amber:   "bg-amber-50 border-amber-200 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    purple:  "bg-purple-50 border-purple-200 text-purple-700",
    red:     "bg-red-50 border-red-200 text-red-700",
    orange:  "bg-orange-50 border-orange-200 text-orange-700",
  };

  const STATUS_BADGE = {
    Ordered:   "bg-sky-100 text-sky-700",
    Shipped:   "bg-blue-100 text-blue-700",
    Delivered: "bg-emerald-100 text-emerald-700",
    Cancelled: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Distributor Dashboard</h1>
          <p className="mt-1 text-slate-500">
            AI features, report and analytics.{" "}
            {lastUpdated && (
              <span className="text-xs text-slate-400">
                Live · {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadAll}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ {error}
        </div>
      )}

      {/* Stats Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-2xl border p-5 ${colorBg[c.color]}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest opacity-70">{c.label}</p>
                <span className="text-xl">{c.icon}</span>
              </div>
              <p className="mt-3 text-3xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Compliance Score */}
      {stats && stats.compliance_score !== undefined && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Compliance Score</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  stats.compliance_score >= 90 ? "bg-emerald-500" :
                  stats.compliance_score >= 70 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${stats.compliance_score}%` }}
              />
            </div>
            <span className="text-lg font-bold text-slate-800">{stats.compliance_score}%</span>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Recent Orders</h2>
          <a href="/distributor/orders" className="text-sm text-sky-600 hover:text-sky-800">
            View all →
          </a>
        </div>
        {orders.length === 0 ? (
          <p className="p-8 text-center text-slate-400">No recent orders.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Order</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Product</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Qty</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm font-mono text-slate-700">ORD-{o.id}</td>
                  <td className="px-6 py-3 text-sm text-slate-800">{o.product || "—"}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{o.quantity}</td>
                  <td className="px-6 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[o.status] || "bg-slate-100 text-slate-700"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-500">{o.date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "📦 Orders",          href: "/distributor/orders" },
          { label: "🛍️ Products",        href: "/distributor/products" },
          { label: "🗺️ Shipment Map",    href: "/distributor/tracking" },
          { label: "❄️ Cold Chain",      href: "/distributor/cold-chain" },
        ].map((l) => (
          <a key={l.href} href={l.href}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 text-center transition-colors">
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
};

export default DistributorDashboard;
