import { useState, useEffect, useMemo } from "react";
import { getOrderHistory } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatINR, apiErrorMessage } from "../../utils/currency";

const statusClass = (status) => {
  const s = String(status || "").toUpperCase();
  if (s.includes("DELIVER")) return "bg-emerald-100 text-emerald-800";
  if (s.includes("TRANSIT") || s.includes("SHIP")) return "bg-sky-100 text-sky-800";
  if (s.includes("CANCEL")) return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-800";
};

const formatDateTime = (raw) => {
  if (!raw) return "—";
  try {
    const d = new Date(raw);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return String(raw).slice(0, 16);
  }
};

const OrderHistory = ({ title, roleFilter }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = {};
        if (roleFilter === "distributor" && user?.user_id) params.distributor_id = user.user_id;
        if (roleFilter === "vendor" && user?.user_id) params.vendor_id = user.user_id;
        const res = await getOrderHistory(params);
        setOrders(res.data.orders || res.data.invoices || []);
        setSummary(res.data.summary || {});
      } catch (err) {
        setError(apiErrorMessage(err, "Could not load order history."));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.user_id, roleFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        String(o.order_ref || "").toLowerCase().includes(q) ||
        String(o.drug_name || "").toLowerCase().includes(q) ||
        String(o.batch_no || "").toLowerCase().includes(q) ||
        String(o.blockchain_order_id || "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  return (
    
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">{title || "Order History"}</h1>
        <p className="mt-2 text-slate-600">Searchable transaction log with blockchain verification hashes.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Total Orders</p>
          <p className="mt-2 text-3xl font-bold">{summary.total ?? orders.length}</p>
        </div>
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Revenue</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{formatINR(summary.revenue)}</p>
        </div>
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Outstanding</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{formatINR(summary.outstanding)}</p>
        
        </div>
      </div>

      <input
        type="search"
        placeholder="Search by order ID, drug, batch, or blockchain hash..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
      />

      {error && <div className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-slate-500">Loading order history...</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Order / Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Drug / Batch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Blockchain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.order_id || o.order_ref}>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-semibold text-slate-900">{o.order_ref}</p>
                      <p className="text-slate-500">{formatDateTime(o.created_at)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium">{o.drug_name}</p>
                      <p className="text-slate-500">{o.batch_no}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{o.quantity}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{formatINR(o.amount_inr ?? o.amount)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600 max-w-[140px] truncate" title={o.blockchain_order_id}>
                      {o.blockchain_order_id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
