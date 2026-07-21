import { useState, useEffect, useCallback } from "react";
import { getAnomalyLogs } from "../../services/api";

const SEVERITY_STYLE = {
  critical: { badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", border: "border-red-200" },
  warning:  { badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", border: "border-amber-200" },
  normal:   { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", border: "border-emerald-200" },
};

const TYPE_ICON = {
  TEMPERATURE_BREACH: "🌡️",
  TEMPERATURE_ANOMALY: "🌡️",
  DEMAND_SPIKE: "📈",
  DEMAND_ANOMALY: "📈",
  EXPIRY_RISK: "⏰",
  EXPIRY_ANOMALY: "⏰",
  SUPPLY_CHAIN_ANOMALY: "🚚",
  COMPLIANCE_ANOMALY: "📋",
};

const RegulatorAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [source, setSource] = useState("—");

  const loadAlerts = useCallback(async () => {
    try {
      const res = await getAnomalyLogs();
      const logs = res.data?.logs || [];
      setAlerts(logs);
      setSource(res.data?.source || "database");
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Anomaly load error:", err);
      setError("Could not reach backend. Showing cached data.");
      // Static fallback so page is never blank
      setAlerts([
        {
          id: 1, batch_id: "BATCH-A01", drug_id: 1,
          anomaly_type: "TEMPERATURE_BREACH", anomaly_score: 0.92,
          resolved: false, severity: "critical",
          triggered_at: new Date(Date.now() - 2 * 3600000).toISOString().slice(0, 19),
          notes: "Temperature rose to 8.5°C (threshold: 2-8°C)",
        },
        {
          id: 2, batch_id: "PAR-2024", drug_id: 2,
          anomaly_type: "DEMAND_SPIKE", anomaly_score: 0.78,
          resolved: false, severity: "warning",
          triggered_at: new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 19),
          notes: "Sales spike 350% above forecast",
        },
        {
          id: 3, batch_id: "INS-2024", drug_id: 3,
          anomaly_type: "EXPIRY_RISK", anomaly_score: 0.88,
          resolved: false, severity: "critical",
          triggered_at: new Date(Date.now() - 8 * 3600000).toISOString().slice(0, 19),
          notes: "37 days to expiry, 180 units remaining",
        },
      ]);
      setSource("fallback");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount + auto-refresh every 30 seconds for live feel
  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const filtered = filter === "all"
    ? alerts
    : filter === "active"
    ? alerts.filter((a) => !a.resolved)
    : alerts.filter((a) => a.severity === filter);

  const stats = {
    critical: alerts.filter((a) => a.severity === "critical" && !a.resolved).length,
    warning:  alerts.filter((a) => a.severity === "warning"  && !a.resolved).length,
    resolved: alerts.filter((a) => a.resolved).length,
    total:    alerts.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Live Anomaly Feed</h1>
          <p className="mt-1 text-slate-500">
            Fraud detection and cold-chain breach monitoring.{" "}
            {lastUpdated && (
              <span className="text-xs text-slate-400">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-3 py-1 rounded-full font-medium border ${
            source === "database" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
            "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            {source === "database" ? "🟢 Live DB" : source === "csv" ? "📄 CSV" : "⚠️ Fallback"}
          </span>
          <button
            onClick={loadAlerts}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Critical", value: stats.critical, color: "red" },
          { label: "Warning",  value: stats.warning,  color: "amber" },
          { label: "Resolved", value: stats.resolved, color: "emerald" },
          { label: "Total",    value: stats.total,    color: "slate" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border border-${s.color}-200 bg-${s.color}-50 p-4`}>
            <p className={`text-xs font-semibold uppercase tracking-widest text-${s.color}-600`}>{s.label}</p>
            <p className={`mt-2 text-3xl font-bold text-${s.color}-800`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        {["all", "active", "critical", "warning"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              filter === f
                ? "bg-sky-600 text-white border-sky-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Anomaly List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-400 text-lg">✅ No anomalies found for selected filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const sty = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.warning;
            const icon = TYPE_ICON[alert.anomaly_type] || "⚠️";
            return (
              <div
                key={alert.id}
                className={`rounded-2xl border ${sty.border} bg-white p-4 shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  {/* Severity dot + icon */}
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${sty.dot} ${!alert.resolved ? "animate-pulse" : ""}`} />
                    <span className="text-lg">{icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold border ${sty.badge}`}>
                          {alert.severity?.toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">
                          {alert.anomaly_type?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(alert.triggered_at).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-4 flex-wrap text-xs text-slate-600">
                      <span>Batch: <strong className="font-mono">{alert.batch_id}</strong></span>
                      <span>Risk Score: <strong>{(alert.anomaly_score * 100).toFixed(1)}%</strong></span>
                      {alert.drug_id && <span>Drug ID: {alert.drug_id}</span>}
                    </div>

                    {alert.notes && (
                      <p className="mt-1 text-xs text-slate-500">{alert.notes}</p>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    alert.resolved
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {alert.resolved ? "Resolved" : "Active"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RegulatorAlerts;
