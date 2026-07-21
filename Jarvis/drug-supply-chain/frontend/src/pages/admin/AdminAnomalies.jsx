import { useState, useEffect, useCallback } from "react";
import { getAnomalyLogs, complianceResolveAnomaly } from "../../services/api";
import { useRealtimeStatus } from "../../hooks/useRealtimeStatus";
import LiveStatusBadge from "../../components/LiveStatusBadge";

const mapLogToRow = (log) => ({
  id: log.id,
  batch_id: log.batch_id,
  issue: log.anomaly_type || log.issue || "Anomaly detected",
  value:
    log.anomaly_score != null
      ? String((log.anomaly_score * 100).toFixed(1)) + "% risk"
      : log.value || log.score || "—",
  timestamp: log.triggered_at || log.timestamp || new Date().toISOString(),
  resolved: log.resolved,
});

const mapLiveAlertToRow = (data) => ({
  id: data.id || "LIVE-" + Date.now(),
  batch_id: data.batch_id,
  issue: data.reason || data.title || data.issue || "Live anomaly",
  value: data.score != null ? String(data.score) : data.value || "Detected",
  timestamp: data.timestamp || data.receivedAt || new Date().toISOString(),
  resolved: false,
});

const AdminAnomalies = () => {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolvePassword, setResolvePassword] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveError, setResolveError] = useState("");
  const { status, alerts } = useRealtimeStatus({ role: "admin" });

  const loadLogs = useCallback(() => {
    getAnomalyLogs()
      .then((res) => {
        const logs = (res.data.logs || []).map(mapLogToRow);
        setAnomalies(logs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!alerts.length) return;
    const latest = alerts[0];
    setAnomalies((prev) => {
      const row = mapLiveAlertToRow(latest);
      if (prev.some((a) => a.id === row.id)) return prev;
      return [row, ...prev];
    });
  }, [alerts]);

  const handleResolve = (alert) => {
    if (String(alert.id).startsWith("LIVE")) return;
    setResolveTarget(alert);
    setResolvePassword("");
    setResolveNotes("");
    setResolveError("");
  };

  const submitGxPResolve = async () => {
    if (!resolveTarget) return;
    if (resolveNotes.trim().length < 10) {
      setResolveError("GxP requires at least 10 characters of justification.");
      return;
    }
    try {
      const res = await complianceResolveAnomaly({
        log_id: resolveTarget.id,
        reason_notes: resolveNotes.trim(),
        password: resolvePassword,
        current_data_snapshot: {
          batch_id: resolveTarget.batch_id,
          issue: resolveTarget.issue,
        },
      });
      setAnomalies((prev) =>
        prev.map((a) =>
          a.id === resolveTarget.id
            ? {
                ...a,
                resolved: true,
                issue: `${a.issue} (GxP signed: ${res.data.electronic_signature_hash?.slice(0, 8)}…)`,
              }
            : a
        )
      );
      setResolveTarget(null);
    } catch (err) {
      setResolveError(err.response?.data?.detail || "Electronic signature or compliance check failed.");
    }
  };

  const cardClass = (alertId) =>
    String(alertId).startsWith("LIVE")
      ? "border-red-200 bg-red-50"
      : "border-slate-200 bg-white";

  const iconClass = (alertId) =>
    String(alertId).startsWith("LIVE") ? "bg-red-500 text-white" : "bg-amber-500 text-white";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Live Anomaly Feed</h1>
          <p className="mt-2 text-slate-600">
            Fraud detection and cold-chain breach monitoring (REST API + live WebSocket).
          </p>
        </div>
        <LiveStatusBadge status={status} />
      </div>

      {loading ? (
        <p className="text-slate-500">Loading anomalies...</p>
      ) : (
        <div className="grid gap-4">
          {anomalies.map((alert) => (
            <div
              key={alert.id}
              className={"rounded-3xl border-2 p-6 shadow-sm transition-all " + cardClass(alert.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div
                    className={
                      "h-12 w-12 rounded-2xl flex items-center justify-center " + iconClass(alert.id)
                    }
                  >
                    !
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{alert.issue}</h3>
                    <p className="text-sm text-slate-500">
                      Batch ID:{" "}
                      <span className="font-mono font-bold text-slate-700">{alert.batch_id}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">{alert.value}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleResolve(alert)}
                  disabled={alert.resolved}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {alert.resolved ? "Resolved" : "E-Sign & Resolve (GxP)"}
                </button>
              </div>
            </div>
          ))}
          {anomalies.length === 0 && (
            <p className="text-slate-500">No anomalies in the last period.</p>
          )}
        </div>
      )}

      {resolveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Electronic signature required</h2>
            <p className="mt-2 text-sm text-slate-600">
              Part 11 compliance: re-enter your password and provide justification (min 10 characters).
            </p>
            <p className="mt-2 text-xs font-mono text-slate-500">Batch: {resolveTarget.batch_id}</p>
            <textarea
              className="mt-4 w-full rounded-xl border p-3 text-sm"
              rows={3}
              placeholder="Reason for override / resolution..."
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
            />
            <input
              type="password"
              className="mt-3 w-full rounded-xl border p-3 text-sm"
              placeholder="Password (electronic signature)"
              value={resolvePassword}
              onChange={(e) => setResolvePassword(e.target.value)}
            />
            {resolveError && <p className="mt-2 text-sm text-red-600">{resolveError}</p>}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setResolveTarget(null)}
                className="flex-1 rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitGxPResolve}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
              >
                Sign &amp; Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnomalies;
