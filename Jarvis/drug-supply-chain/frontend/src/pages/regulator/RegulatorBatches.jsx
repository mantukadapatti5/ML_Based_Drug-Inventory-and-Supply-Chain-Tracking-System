import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";

// Status filter options matching what the backend actually returns
const FILTERS = ["All", "Ordered", "Received", "Delivered", "Shipped"];

// Status → badge colour
const STATUS_COLOR = {
  Ordered:   "bg-amber-600 text-white",
  Received:  "bg-sky-600 text-white",
  Shipped:   "bg-purple-600 text-white",
  Delivered: "bg-emerald-600 text-white",
  Cancelled: "bg-red-600 text-white",
};

// Compliance colour based on status
const getComplianceLabel = (status) => {
  if (status === "Delivered") return { cls: "bg-emerald-600 text-white", label: "✓ Compliant" };
  if (status === "Cancelled") return { cls: "bg-red-600 text-white",     label: "⚠ Review" };
  return { cls: "bg-sky-600 text-white", label: "⏳ In Transit" };
};

const RegulatorBatches = () => {
  const [batches, setBatches]   = useState([]);
  const [filter, setFilter]     = useState("All");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // ── FIX 1: call /api/orders directly with axios (includes JWT automatically)
      // The old code called getOrders() which passes status as a filter param —
      // backend uses LIKE patterns so "Ordered","Delivered" etc work.
      const params = filter !== "All" ? { status: filter } : {};
      const res = await api.get("/api/orders", { params });

      // ── FIX 2: backend returns { orders: [...] } — unwrap correctly
      const raw = res.data?.orders || res.data || [];

      // ── FIX 3: map backend field names to what this component needs
      // Backend fields: id (number), product, batch_no, vendor, status, date
      // Old component tried: batch.drug_name, batch.vendor_name, batch.updated_at
      // All of those are WRONG field names → renders "—" or crashes
      const mapped = raw.map((o) => ({
        id:          o.id,
        // ── FIX: field is "product" not "drug_name" ──────────────────────
        drug_name:   o.drug_name || o.product || "—",
        batch_no:    o.batch_no  || o.shipment_id || `B-${String(o.id).padStart(3,"0")}`,
        // ── FIX: field is "vendor" not "vendor_name" ─────────────────────
        vendor_name: o.vendor_name || o.vendor || "—",
        status:      o.status || "Ordered",
        // ── FIX: field is "date" not "updated_at" ────────────────────────
        updated_at:  o.updated_at || o.date || o.created_at || null,
        quantity:    o.quantity || 0,
        shipment_id: o.shipment_id || `SHIP-${String(o.id).padStart(3,"0")}`,
      }));

      setBatches(mapped);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("RegulatorBatches load error:", err);

      // ── FIX 4: never show blank on error — always show demo data ─────
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Session expired. Please log in again as Regulator.");
      } else {
        setError("Could not load from backend — showing demo data.");
      }

      // Populate with realistic demo data so page is never blank
      setBatches([
        { id: 1001, drug_name: "Cold Chain Vaccine Serum",  batch_no: "C-003", vendor_name: "PharmaPrime",
          status: "Delivered", quantity: 200, updated_at: new Date().toISOString(), shipment_id: "SHIP-001" },
        { id: 1002, drug_name: "Amoxicillin 500mg",          batch_no: "A-441", vendor_name: "MediSource",
          status: "Shipped",   quantity: 500, updated_at: new Date(Date.now()-86400000).toISOString(), shipment_id: "SHIP-002" },
        { id: 1003, drug_name: "Paracetamol 500mg",          batch_no: "P-892", vendor_name: "HealthWave",
          status: "Ordered",   quantity: 1000, updated_at: new Date(Date.now()-2*86400000).toISOString(), shipment_id: "SHIP-003" },
        { id: 1004, drug_name: "Insulin Glargine",           batch_no: "I-110", vendor_name: "Apex Health",
          status: "Received",  quantity: 150, updated_at: new Date(Date.now()-3*86400000).toISOString(), shipment_id: "SHIP-004" },
        { id: 1005, drug_name: "Metformin 500mg",            batch_no: "M-220", vendor_name: "Cadila Health",
          status: "Delivered", quantity: 800, updated_at: new Date(Date.now()-4*86400000).toISOString(), shipment_id: "SHIP-005" },
      ]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
    // Auto-refresh every 30 seconds
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = filter === "All"
    ? batches
    : batches.filter(b => b.status?.toLowerCase() === filter.toLowerCase());

  const counts = {
    All:       batches.length,
    Ordered:   batches.filter(b => b.status === "Ordered").length,
    Received:  batches.filter(b => b.status === "Received").length,
    Shipped:   batches.filter(b => b.status === "Shipped").length,
    Delivered: batches.filter(b => b.status === "Delivered").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">Batch Tracking</h1>
          <p className="mt-2 text-slate-400">
            Monitor all drug batches across the supply chain.
          </p>
        </div>

        {/* Live badge */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-emerald-400">Live</span>
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              · {lastUpdated.toLocaleTimeString("en-IN")}
            </span>
          )}
          <button onClick={load}
            className="ml-2 text-xs rounded-lg border border-slate-700 px-3 py-1.5 text-slate-400 hover:bg-slate-800">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-amber-700 bg-amber-900/20 px-4 py-3 text-sm text-amber-400">
          ⚠️ {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {FILTERS.map((s) => (
          <div key={s}
            className={`rounded-xl border p-3 text-center cursor-pointer transition-all ${
              filter === s
                ? "border-sky-500 bg-sky-900/30"
                : "border-slate-700 bg-slate-900 hover:border-slate-600"
            }`}
            onClick={() => setFilter(s)}>
            <p className={`text-2xl font-bold ${filter === s ? "text-sky-400" : "text-slate-300"}`}>
              {counts[s] ?? batches.length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{s}</p>
          </div>
        ))}
      </div>

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((status) => (
          <button key={status} onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}>
            {status}
            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
              filter === status ? "bg-sky-500" : "bg-slate-700"
            }`}>
              {counts[status] ?? batches.length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800">
              <th className="px-6 py-3 text-left font-semibold text-slate-100">Batch / Shipment</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-100">Drug</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-100">Vendor</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-100">Qty</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-100">Status</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-100">Compliance</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-100">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Loading skeleton — 5 rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-700">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 bg-slate-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                  <p className="text-2xl mb-2">📦</p>
                  <p>No batches found for filter: <strong>{filter}</strong></p>
                  <button onClick={() => setFilter("All")}
                    className="mt-3 text-xs text-sky-400 hover:underline">
                    Show all batches
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map((batch) => {
                const compliance = getComplianceLabel(batch.status);
                const statusCls  = STATUS_COLOR[batch.status] || "bg-slate-600 text-white";
                return (
                  <tr key={batch.id}
                    className="border-b border-slate-700 hover:bg-slate-800/50 transition-colors">

                    {/* Batch ID — FIX: id is a number, use String() not .substring() */}
                    <td className="px-6 py-4">
                      <p className="font-mono text-sky-400 text-xs">
                        {batch.batch_no || `B-${String(batch.id).padStart(4,"0")}`}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{batch.shipment_id}</p>
                    </td>

                    {/* Drug — FIX: field is "drug_name" after mapping, not "batch.product" */}
                    <td className="px-6 py-4 text-slate-100 font-medium">{batch.drug_name}</td>

                    {/* Vendor — FIX: field is "vendor_name" after mapping */}
                    <td className="px-6 py-4 text-slate-300">{batch.vendor_name}</td>

                    {/* Quantity */}
                    <td className="px-6 py-4 text-slate-300">{batch.quantity}</td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusCls}`}>
                        {batch.status}
                      </span>
                    </td>

                    {/* Compliance */}
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${compliance.cls}`}>
                        {compliance.label}
                      </span>
                    </td>

                    {/* Date — FIX: field is "updated_at" after mapping (was "date" in raw response) */}
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {batch.updated_at
                        ? new Date(batch.updated_at).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric"
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-700 flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Showing {filtered.length} of {batches.length} batches
            </p>
            <p className="text-xs text-slate-500">
              Auto-refreshes every 30 seconds
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegulatorBatches;
