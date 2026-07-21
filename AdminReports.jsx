import { useState, useEffect } from "react";
import api from "../../services/api";

const AdminReports = () => {
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [source, setSource]     = useState("—");
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      setLoading(true);

      // Try 3 sources in order — first one that works is used
      const sources = [
        // 1. Admin audit-trail (needs admin JWT)
        async () => {
          const res = await api.get("/api/admin/audit-trail");
          const rows = res.data?.reports || [];
          if (rows.length === 0) throw new Error("empty");
          return { rows, src: "Audit Trail DB" };
        },
        // 2. Order history (no special role needed)
        async () => {
          const res = await api.get("/api/orders/history");
          const orders = res.data?.orders || res.data?.invoices || [];
          if (orders.length === 0) throw new Error("empty");
          const rows = orders.map(o => ({
            id:         o.id || o.order_ref,
            action:     `ORDER_${(o.status || "PLACED").toUpperCase().replace(/ /g, "_")}`,
            status:     o.status,
            drug_name:  o.drug_name || o.drug,
            findings:   `${o.drug_name || "Drug"} · ${o.quantity} units · ₹${o.amount_inr?.toLocaleString("en-IN") || o.amount}`,
            created_at: o.created_at || o.date,
            blockchain_order_id: o.blockchain_order_id,
            entity_type: "order",
          }));
          return { rows, src: "Order History" };
        },
        // 3. Compliance audit trail (public endpoint)
        async () => {
          const res = await api.get("/api/compliance/audit-trail");
          const rows = res.data?.audit_trail || res.data?.reports || [];
          if (rows.length === 0) throw new Error("empty");
          return { rows, src: "Compliance Audit" };
        },
      ];

      for (const attempt of sources) {
        try {
          const { rows, src } = await attempt();
          setReports(rows);
          setSource(src);
          setLastUpdated(new Date());
          setLoading(false);
          return;
        } catch (_) {
          continue;
        }
      }

      // All sources failed — static demo so page is never blank
      const now = new Date().toISOString().slice(0, 19);
      setReports([
        { id: "ORD-00001", action: "ORDER_DELIVERED", status: "Delivered",
          drug_name: "Cold Chain Vaccine Serum", findings: "Cold Chain Vaccine Serum · 200 units · ₹50,000",
          created_at: now, entity_type: "order", blockchain_order_id: "TX-DEMO-001" },
        { id: "ORD-00002", action: "ORDER_PENDING_APPROVAL", status: "Ordered",
          drug_name: "Amoxicillin 500mg", findings: "Amoxicillin 500mg · 500 units · ₹60,000",
          created_at: now, entity_type: "order", blockchain_order_id: "TX-DEMO-002" },
        { id: "ANO-001", action: "ANOMALY_TEMPERATURE_BREACH", status: "Unresolved",
          drug_name: "Insulin Glargine", findings: "BATCH-A01 · Temperature 8.5°C · Cold chain violated",
          created_at: now, entity_type: "anomaly", blockchain_order_id: null },
      ]);
      setSource("Demo Data");
      setError("Backend audit trail unavailable. Showing demo records.");
      setLoading(false);
    };

    load();
  }, []);

  const actionColor = (action = "") => {
    const a = action.toUpperCase();
    if (a.includes("DELIVER") || a.includes("COMPLETE"))
      return "bg-emerald-100 text-emerald-700";
    if (a.includes("ANOMAL") || a.includes("BREACH") || a.includes("CRITICAL"))
      return "bg-red-100 text-red-700";
    if (a.includes("PENDING") || a.includes("APPROVAL"))
      return "bg-amber-100 text-amber-700";
    if (a.includes("TRANSIT") || a.includes("SHIP"))
      return "bg-sky-100 text-sky-700";
    return "bg-slate-100 text-slate-600";
  };

  const formatDate = (raw) => {
    if (!raw) return "—";
    try {
      return new Date(raw).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return String(raw).slice(0, 16);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Audit Trail & Reports</h1>
          <p className="mt-2 text-slate-300">Order history and system audit records.</p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-xs font-bold border ${
            source === "Audit Trail DB"
              ? "bg-emerald-900 text-emerald-300 border-emerald-700"
              : "bg-amber-900 text-amber-300 border-amber-700"
          }`}>
            {source}
          </span>
          {lastUpdated && (
            <p className="text-xs text-slate-500 mt-1">{lastUpdated.toLocaleTimeString()}</p>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Records</p>
          <p className="mt-2 text-3xl font-bold text-white">{reports.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-700 bg-slate-900 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Orders</p>
          <p className="mt-2 text-3xl font-bold text-emerald-400">
            {reports.filter(r => r.entity_type === "order" || (r.action || "").includes("ORDER")).length}
          </p>
        </div>
        <div className="rounded-2xl border border-red-700 bg-slate-900 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Anomalies</p>
          <p className="mt-2 text-3xl font-bold text-red-400">
            {reports.filter(r => r.entity_type === "anomaly" || (r.action || "").includes("ANOMAL")).length}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-700 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
          ⚠️ {error}
        </div>
      )}

      {/* Audit table */}
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
        {loading ? (
          <div className="p-12 text-center text-slate-400 animate-pulse">
            Loading audit trail...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No audit records found.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900">
              <tr>
                {["ID / Ref", "Action", "Drug / Details", "Blockchain TX", "Date"].map(h => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {reports.map((r, i) => (
                <tr key={r.id || i} className="hover:bg-slate-900/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-mono text-white">{r.id || r.order_ref || `#${i+1}`}</p>
                    <p className="text-xs text-slate-500">{r.entity_type || "record"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${actionColor(r.action || r.status)}`}>
                      {(r.action || r.status || "—").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-300">{r.drug_name || r.entity_type || "—"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{r.findings || r.entity_id || ""}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-mono text-slate-400 max-w-[140px] truncate" title={r.blockchain_order_id || r.blockchain_hash}>
                      {r.blockchain_order_id || r.blockchain_hash || "—"}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {formatDate(r.created_at)}
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

export default AdminReports;
