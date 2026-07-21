import { useState, useEffect, useCallback } from "react";
import { getFefoSorted } from "../../services/api";

// ── FIXED: Near-expiry threshold (days) ───────────────────────────────────
const CRITICAL_DAYS = 20;
const WARNING_DAYS  = 60;

const VendorExpiry = () => {
  const [batches, setBatches]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [lastUpdated, setLastUpdated]   = useState(null);
  // ── FIXED: Near-expiry push notification state ────────────────────────
  const [notifications, setNotifications] = useState([]);  // alert banners
  const [dismissed, setDismissed]         = useState(new Set());

  const loadBatches = useCallback(async () => {
    try {
      const res = await getFefoSorted({ limit: 20 });
      const data = res.data?.batches || [];
      setBatches(data);
      setLastUpdated(new Date());
      setError(null);

      // ── FIXED: Auto-detect near-expiry and push notification banners ──
      const criticalBatches = data.filter(
        b => (b.days_until_expiry ?? 0) < CRITICAL_DAYS && (b.quantity_units ?? 0) > 0
      );
      const newNotifs = criticalBatches
        .filter(b => !dismissed.has(b.batch_id))
        .map(b => ({
          id:       b.batch_id,
          drug:     b.drug_name,
          days:     b.days_until_expiry,
          quantity: b.quantity_units,
          zone:     b.storage_zone,
        }));

      setNotifications(newNotifs);
    } catch (err) {
      setError("Could not load expiry batches.");
      setBatches([
        { fefo_rank: 1, batch_id: "BATCH-A01", drug_name: "Amoxicillin 250mg",
          expiry_date: new Date(Date.now() + 10*86400000).toISOString().slice(0,10),
          quantity_units: 220, days_until_expiry: 10, storage_zone: "Cold-A" },
        { fefo_rank: 2, batch_id: "PAR-2024", drug_name: "Paracetamol 500mg",
          expiry_date: new Date(Date.now() + 16*86400000).toISOString().slice(0,10),
          quantity_units: 95, days_until_expiry: 16, storage_zone: "Dry-B" },
        { fefo_rank: 3, batch_id: "C-003", drug_name: "Cold Chain Vaccine",
          expiry_date: new Date(Date.now() + 55*86400000).toISOString().slice(0,10),
          quantity_units: 500, days_until_expiry: 55, storage_zone: "Cold-A" },
      ]);
    } finally {
      setLoading(false);
    }
  }, [dismissed]);

  useEffect(() => {
    loadBatches();
    // Check every 5 minutes for new expiry alerts
    const interval = setInterval(loadBatches, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadBatches]);

  const dismissNotif = (id) => {
    setDismissed(prev => new Set([...prev, id]));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getBadge = (days) => {
    if (days < CRITICAL_DAYS)
      return { label: "🚨 Critical — Dispatch Immediately", cls: "bg-red-100 text-red-700 border-red-200" };
    if (days < WARNING_DAYS)
      return { label: "⚠️ Near Expiry", cls: "bg-amber-100 text-amber-700 border-amber-200" };
    return { label: "✅ Safe",         cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  };

  const stats = {
    critical: batches.filter(b => (b.days_until_expiry ?? 999) < CRITICAL_DAYS).length,
    warning:  batches.filter(b => {
      const d = b.days_until_expiry ?? 999;
      return d >= CRITICAL_DAYS && d < WARNING_DAYS;
    }).length,
    safe:     batches.filter(b => (b.days_until_expiry ?? 999) >= WARNING_DAYS).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Expiry Management — FEFO</h1>
          <p className="mt-1 text-slate-500">
            FEFO-sorted batches — nearest expiry dispatched first.{" "}
            {lastUpdated && (
              <span className="text-xs text-slate-400">Live · {lastUpdated.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <button onClick={loadBatches}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
          ↻ Refresh
        </button>
      </div>

      {/* ── FIXED: Near Expiry Push Alert Banners ── */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id}
              className="rounded-2xl border border-red-300 bg-red-50 p-4 flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-red-800">
                  🚨 NEAR EXPIRY ALERT — {n.drug}
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Batch <strong className="font-mono">{n.id}</strong> expires in{" "}
                  <strong>{n.days} days</strong> · {n.quantity} units remaining ·
                  Zone: {n.zone}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  ⚡ Action needed: Dispatch this batch before newer stock.
                  FEFO enforcement will prioritize this automatically on next order.
                </p>
              </div>
              <button
                onClick={() => dismissNotif(n.id)}
                className="ml-4 text-red-400 hover:text-red-700 text-lg font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Critical (&lt;{CRITICAL_DAYS} days)</p>
          <p className="mt-2 text-3xl font-bold text-red-800">{stats.critical}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Warning (&lt;{WARNING_DAYS} days)</p>
          <p className="mt-2 text-3xl font-bold text-amber-800">{stats.warning}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Safe</p>
          <p className="mt-2 text-3xl font-bold text-emerald-800">{stats.safe}</p>
        </div>
      </div>

      {/* FEFO batch table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            FEFO-Sorted Batches
            <span className="ml-2 text-xs text-slate-400 font-normal">
              Rank 1 = dispatch first
            </span>
          </h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 animate-pulse">Loading expiry batches...</div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No expiry batches found.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["FEFO Rank", "Batch ID", "Drug", "Expiry Date", "Days Left", "Qty", "Zone", "Alert"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((item) => {
                const days  = item.days_until_expiry ?? 0;
                const badge = getBadge(days);
                return (
                  <tr key={item.batch_id || item.id}
                    className={`hover:bg-slate-50 transition-colors ${days < CRITICAL_DAYS ? "bg-red-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                        item.fefo_rank === 1 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {item.fefo_rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 font-semibold">{item.batch_id}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">{item.drug_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.expiry_date}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${
                        days < CRITICAL_DAYS ? "text-red-700" :
                        days < WARNING_DAYS  ? "text-amber-700" : "text-emerald-700"
                      }`}>
                        {days} days
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.quantity_units ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{item.storage_zone}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default VendorExpiry;
