import { useState, useEffect, useCallback } from "react";
import { getColdChainMonitor, getColdChainMonitorFallback } from "../../services/api";
import { useRealtimeStatus } from "../../hooks/useRealtimeStatus";
import { useDataWithFallback, normalizeRecords } from "../../hooks/useDataWithFallback";
import LiveStatusBadge from "../../components/LiveStatusBadge";
import ErrorBoundary from "../../components/ErrorBoundary";
import { getSocket } from "../../services/socket";

const VendorColdChain = () => {
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [breaches, setBreaches] = useState(0);
  const { status } = useRealtimeStatus({ role: "vendor" });

  // Intelligent fallback for telemetry data
  const { data: rawAlerts, loading, error, source, refresh } = useDataWithFallback(
    () => getColdChainMonitor(),
    () => getColdChainMonitorFallback(50)
  );

  // Normalize telemetry records from CSV with optional chaining
  const baseAlerts = (normalizeRecords(rawAlerts) || []).map((a, idx) => ({
    id: a?.id ?? `alert-${idx}`,
    product: a?.product ?? a?.productName ?? `Batch ${a?.batchId || idx}`,
    batchId: a?.batchId ?? a?.batch_id ?? "UNKNOWN",
    location: a?.location ?? a?.device_id ?? a?.deviceid ?? "In transit",
    temperature: parseFloat(a?.temperature ?? a?.temperature_c ?? a?.temperaturec ?? 20),
    humidity: parseFloat(a?.humidity ?? a?.humidity_pct ?? a?.humiditypct ?? 45),
    thresholdMaxC: parseFloat(a?.thresholdMaxC ?? a?.threshold_max_c ?? 8),
    status: (a?.status ?? "normal").toLowerCase(),
    timestamp: a?.timestamp ?? a?.updated_at ?? new Date().toISOString(),
  }));

  // Combine base alerts with live updates
  const alerts = [
    ...liveAlerts.filter((la) => !baseAlerts.some((ba) => ba?.batchId === la?.batchId)),
    ...baseAlerts,
  ].slice(0, 20);

  const onSensor = useCallback((data) => {
    const temp = data?.temperature_c ?? data?.temperature;
    const batchId = data?.batch_id || "UNKNOWN";
    const critical = temp != null && Number(temp) > 8;

    setLiveAlerts((prev) => {
      const next = [
        {
          id: data?.idempotency_key || `live-${Date.now()}`,
          product: `Batch ${batchId}`,
          batchId: batchId,
          location: data?.device_id || "In transit",
          temperature: Number(temp ?? 0).toFixed(1),
          humidity: data?.humidity_pct ?? data?.humidity ?? "—",
          thresholdMaxC: 8,
          status: critical ? "critical" : "normal",
          timestamp: new Date().toISOString(),
        },
        ...prev.filter((a) => a?.batchId !== batchId),
      ];
      return next.slice(0, 10);
    });

    setBreaches((n) => (critical ? n + 1 : Math.max(0, n - 1)));
  }, []);

  useEffect(() => {
    const socket = getSocket("vendor");

    const onAlert = () => refresh?.();

    socket.on("sensor_update", onSensor);
    socket.on("new_anomaly_alert", onAlert);
    socket.on("batch_quarantined", onAlert);

    return () => {
      socket.off("sensor_update", onSensor);
      socket.off("new_anomaly_alert", onAlert);
      socket.off("batch_quarantined", onAlert);
    };
  }, [onSensor, refresh]);

  const statusColor = (s) =>
    s === "critical"
      ? "bg-red-100 text-red-700"
      : s === "warning"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";

  return (
    <ErrorBoundary fallbackMessage="Cold chain monitoring failed. Check database and sensor connections.">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Cold Chain Monitoring</h1>
            <p className="mt-2 text-slate-600">
              {loading ? "Loading sensor data..." : `Live temperature/humidity (${source === "primary" ? "Live" : "CSV Fallback"})`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <LiveStatusBadge status={status} />
            <div className="rounded-2xl bg-white border px-6 py-3 shadow-sm">
              <p className="text-sm text-slate-500">Active breaches</p>
              <p className="text-2xl font-bold text-rose-600">{breaches}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
            <p className="font-semibold">⚠️ Sensor Data Issue</p>
            <p className="text-sm">Using fallback telemetry data. {error?.message || "Check connections"}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-500 animate-pulse">⏳ Syncing with sensors...</p>
            <div className="mt-4 flex justify-center">
              <div className="animate-spin h-6 w-6 border-4 border-slate-300 border-t-slate-600 rounded-full"></div>
            </div>
          </div>
        ) : alerts?.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-slate-500">No cold-chain readings available.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {alerts?.map((a) => (
              <div
                key={a?.id || Math.random()}
                className="rounded-3xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-slate-900 text-lg">{a?.product}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${statusColor(a?.status)}`}>
                    {a?.status?.toUpperCase() || "NORMAL"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">📍 {a?.location}</p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{a?.temperature}°C</p>
                    <p className="text-xs text-slate-500">Temperature</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{a?.humidity}%</p>
                    <p className="text-xs text-slate-500">Humidity</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">Max: {a?.thresholdMaxC}°C · Batch: {a?.batchId}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default VendorColdChain;
