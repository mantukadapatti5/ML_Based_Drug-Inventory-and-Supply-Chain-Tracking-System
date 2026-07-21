import { useState, useEffect } from "react";
import { getOrderHistory } from "../../services/api";
import { formatINR } from "../../utils/currency";

const STATUS_BADGE = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  PENDING:          "bg-amber-100 text-amber-700",
  DELIVERED:        "bg-emerald-100 text-emerald-700",
  SHIPPED:          "bg-sky-100 text-sky-700",
  IN_TRANSIT:       "bg-sky-100 text-sky-700",
  CANCELLED:        "bg-slate-200 text-slate-600",
};

const statusBadge = (status) => {
  const s = String(status || "").toUpperCase();
  for (const [key, cls] of Object.entries(STATUS_BADGE)) {
    if (s.includes(key.split("_")[0])) return cls;
  }
  return "bg-amber-100 text-amber-700";
};

const formatDate = (raw) => {
  if (!raw) return "—";
  try {
    const d = new Date(raw);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return String(raw).slice(0, 10); }
};

const VendorBilling = () => {
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary]   = useState({ total: 0, revenue: 0, outstanding: 0 });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    getOrderHistory()
      .then((res) => {
        // Backend returns both "invoices" and "orders" — accept either
        const data = res.data?.invoices || res.data?.orders || [];
        setInvoices(data);
        const sum = res.data?.summary || {};
        // Calculate locally if summary missing
        const total_rev = sum.revenue ?? data.reduce((s, i) => s + (i.amount_inr || i.amount || 0), 0);
        const outstanding = sum.outstanding ?? data
          .filter((i) => !String(i.status || "").toUpperCase().includes("DELIVER"))
          .reduce((s, i) => s + (i.amount_inr || i.amount || 0), 0);
        setSummary({
          total: sum.total ?? data.length,
          revenue: total_rev,
          outstanding,
        });
      })
      .catch((err) => {
        setError("Failed to load billing data: " + (err.response?.data?.detail || err.message));
        // Demo fallback — page never blank
        const demo = [
          {
            id: "INV-0101", order_ref: "ORD-0101", drug_name: "Cold Chain Vaccine Serum",
            batch_no: "C-003", quantity: 200, amount_inr: 50000,
            status: "PENDING_APPROVAL", created_at: new Date().toISOString(),
            blockchain_order_id: "TX-MOCK-BLOCK-001",
          },
          {
            id: "INV-0102", order_ref: "ORD-0102", drug_name: "Amoxicillin 500mg",
            batch_no: "A-441", quantity: 500, amount_inr: 60000,
            status: "DELIVERED", created_at: new Date(Date.now() - 86400000).toISOString(),
            blockchain_order_id: "TX-MOCK-BLOCK-002",
          },
        ];
        setInvoices(demo);
        setSummary({ total: 2, revenue: 110000, outstanding: 50000 });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Billing & Invoicing</h1>
        <p className="mt-2 text-slate-600">Order-based invoices from live database — real-time.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-widest text-slate-500">Total Invoices</p>
          <p className="mt-4 text-4xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <p className="text-sm uppercase tracking-widest text-emerald-600">Revenue</p>
          <p className="mt-4 text-4xl font-bold text-emerald-800">{formatINR(summary.revenue)}</p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm uppercase tracking-widest text-amber-600">Outstanding</p>
          <p className="mt-4 text-4xl font-bold text-amber-800">{formatINR(summary.outstanding)}</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Invoice List</h2>
        </div>
        {loading ? (
          <p className="p-8 text-slate-400 animate-pulse">Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <p className="p-8 text-center text-slate-400">No invoices found.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Invoice / Order</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Drug</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Batch</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Qty</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoices.map((item, idx) => (
                <tr key={item.id || item.order_id || idx} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm">
                    <p className="font-semibold text-slate-800">
                      {item.invoice_ref || item.id || `INV-${String(idx + 1).padStart(4, "0")}`}
                    </p>
                    <p className="text-xs text-slate-500">{item.order_ref || "—"}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-800">
                    {item.drug_name || "Unknown Drug"}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-600">
                    {item.batch_no || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{item.quantity}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {formatINR(item.amount_inr ?? item.amount ?? 0)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge(item.status)}`}>
                      {item.status || "PENDING"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {formatDate(item.created_at || item.date)}
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

export default VendorBilling;
