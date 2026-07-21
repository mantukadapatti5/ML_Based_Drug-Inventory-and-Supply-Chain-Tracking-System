import { useState, useEffect, useCallback } from "react";
import { getStockRequests, updateRequestStatus } from "../../services/api";

const STATUS_OPTIONS = ["PENDING", "APPROVED", "SHIPPED", "DELIVERED", "REJECTED"];

const STATUS_STYLE = {
  PENDING:   "bg-amber-100 text-amber-700",
  APPROVED:  "bg-sky-100 text-sky-700",
  SHIPPED:   "bg-blue-100 text-blue-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  REJECTED:  "bg-red-100 text-red-700",
};

const VendorOrders = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getStockRequests();
      const data = res.data?.requests || [];
      setRequests(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Stock requests error:", err);
      setError("Could not load requests. Check backend is running.");
      // Show demo data so page is never blank
      setRequests([
        {
          id: 1,
          drug_name: "Cold Chain Vaccine Serum",
          drug_id: 156,
          quantity: 100,
          status: "PENDING",
          requested_by: "distributor",
          created_at: new Date().toISOString().slice(0, 19),
        },
        {
          id: 2,
          drug_name: "Amoxicillin 500mg",
          drug_id: 158,
          quantity: 250,
          status: "APPROVED",
          requested_by: "distributor",
          created_at: new Date(Date.now() - 3600000).toISOString().slice(0, 19),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount + auto-refresh every 15 seconds for live updates
  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleStatusChange = async (reqId, newStatus) => {
    setUpdating((prev) => ({ ...prev, [reqId]: true }));
    setMsg("");
    try {
      await updateRequestStatus(reqId, newStatus);
      setMsg(`✅ Request REQ-${reqId} updated to ${newStatus}`);
      // Update locally immediately for real-time feel
      setRequests((prev) =>
        prev.map((r) => r.id === reqId ? { ...r, status: newStatus } : r)
      );
      // Then refresh from server
      setTimeout(fetchRequests, 500);
    } catch (err) {
      setMsg(`❌ Update failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setUpdating((prev) => ({ ...prev, [reqId]: false }));
    }
  };

  // Stats
  const pending   = requests.filter((r) => r.status === "PENDING").length;
  const approved  = requests.filter((r) => r.status === "APPROVED").length;
  const delivered = requests.filter((r) => r.status === "DELIVERED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Incoming Stock Requests</h1>
          <p className="mt-1 text-slate-500">
            Approve and update distributor stock requests.{" "}
            {lastUpdated && (
              <span className="text-xs text-slate-400">
                Live · {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Pending</p>
          <p className="mt-1 text-3xl font-bold text-amber-800">{pending}</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">Approved</p>
          <p className="mt-1 text-3xl font-bold text-sky-800">{approved}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Delivered</p>
          <p className="mt-1 text-3xl font-bold text-emerald-800">{delivered}</p>
        </div>
      </div>

      {/* Messages */}
      {msg && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${
          msg.startsWith("✅") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {msg}
        </div>
      )}
      {error && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 animate-pulse">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-lg">No incoming stock requests yet.</p>
            <p className="mt-2 text-sm text-slate-400">
              Requests appear here when distributors click "Request Stock" in the Products page.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Request ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Drug</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Qty</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Requested By</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-slate-700">REQ-{String(req.id).padStart(4, "0")}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                    {req.drug_name || `Drug #${req.drug_id}`}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{req.quantity}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{req.requested_by || "distributor"}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {req.created_at ? new Date(req.created_at).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[req.status] || "bg-slate-100 text-slate-700"}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={req.status}
                      disabled={Boolean(updating[req.id])}
                      onChange={(e) => handleStatusChange(req.id, e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default VendorOrders;
