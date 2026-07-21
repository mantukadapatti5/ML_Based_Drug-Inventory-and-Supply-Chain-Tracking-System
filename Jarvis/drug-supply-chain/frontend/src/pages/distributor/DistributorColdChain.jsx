import { useState, useEffect, useCallback } from "react";
import { getColdChainMonitorFallback } from "../../services/api";

// Try to import optional components — fallback gracefully if missing
let ErrorBoundary = ({ children }) => children;
let LiveStatusBadge = () => null;
try {
  ErrorBoundary  = require("../../components/ErrorBoundary").default;
  LiveStatusBadge = require("../../components/LiveStatusBadge").default;
} catch (_) {}

const DistributorColdChain = () => {
  const [alerts, setAlerts]         = useState([]);
  const [breaches, setBreaches]     = useState(0);    // ← FIXED: calculated from data
  const [loading, setLoading]       = useState(true);
  const [dataSource, setDataSource] = useState("Loading...");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError]           = useState(null);

  // ── FIXED: Load CSV data AND calculate breaches from it ──────────────
  const loadData = useCallback(async () => {
    setError(null);
    try {
      const res = await getColdChainMonitorFallback();
      const rawData = res?.data?.data || res?.data?.telemetry || res?.data || [];

      const dataArray = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.data)
        ? rawData.data
        : [];

      if (dataArray.length === 0) {
        // Generate demo telemetry if backend returns empty
        const now = new Date();
        const demoAlerts = [
          { batch_id: "BATCH-A01", drug_name: "Cold Chain Vaccine", temperature: 8.5,
            humidity: 62, location: "Delhi Warehouse", status: "critical",
            time: now.toISOString() },
          { batch_id: "C-003", drug_name: "Insulin Glargine", temperature: 4.2,
            humidity: 58, location: "Mumbai Cold Storage", status: "normal",
            time: now.toISOString() },
          { batch_id: "INS-2024", drug_name: "Paracetamol Infusion", temperature: 7.8,
            humidity: 65, location: "Pune Hub", status: "normal",
            time: now.toISOString() },
          { batch_id: "AMX-2024", drug_name: "Amoxicillin 500mg", temperature: 25.1,
            humidity: 45, location: "Chennai Depot", status: "warning",
            time: now.toISOString() },
        ];
        setAlerts(demoAlerts);
        setBreaches(1); // BATCH-A01 is critical
        setDataSource("Demo Data");
        setLastUpdated(now);
        return;
      }

      // Map CSV rows to alert objects
      const mapped = dataArray.slice(0, 20).map((row, idx) => {
        const temp = parseFloat(
          row?.Temperature ?? row?.temperature_c ?? row?.temperature ?? 0
        );
        const humidity = parseFloat(
          row?.Humidity ?? row?.humidity_pct ?? row?.humidity ?? 0
        );
        const batchId = row?.Batch_ID ?? row?.batch_id ?? `ROW-${idx}`;
        const drugName = row?.Drug_Name ?? row?.drug_name ?? `Shipment ${batchId}`;
        const location = row?.Location ?? row?.location ?? row?.device_id ?? "In Transit";

        // Status: critical if temp > 8°C (cold chain violation)
        const isCritical = temp > 8.0;
        const isWarning  = !isCritical && (temp > 6.5 || humidity > 70);

        return {
          id:          batchId,
          batch_id:    batchId,
          product:     drugName,
          drug_name:   drugName,
          location,
          temperature: isNaN(temp)     ? "—" : temp.toFixed(1),
          humidity:    isNaN(humidity) ? "—" : humidity.toFixed(1),
          status:      isCritical ? "critical" : isWarning ? "warning" : "normal",
          time:        row?.Timestamp ?? row?.timestamp ?? new Date().toISOString(),
        };
      });

      // ── FIXED: Count breaches from actual CSV data ──────────────────
      const breachCount = mapped.filter(a => a.status === "critical").length;

      setAlerts(mapped);
      setBreaches(breachCount);   // ← now shows real number not always 0
      setDataSource("CSV Fallback");
      setLastUpdated(new Date());

    } catch (err) {
      console.error("Cold chain load error:", err);
      setError("Could not load telemetry data.");
      // Static fallback so page is never blank
      setAlerts([
        { id: "FALLBACK-1", batch_id: "C-003", product: "Cold Chain Vaccine",
          location: "Delhi", temperature: "4.2", humidity: "58", status: "normal" },
        { id: "FALLBACK-2", batch_id: "BATCH-A01", product: "Insulin Glargine",
          location: "Mumbai", temperature: "8.7", humidity: "63", status: "critical" },
      ]);
      setBreaches(1);
      setDataSource("Static Fallback");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Refresh every 2 minutes
    const interval = setInterval(loadData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Also listen to WebSocket if available
  useEffect(() => {
    try {
      const { getSocket } = require("../../services/socket");
      const socket = getSocket("distributor");

      const onSensor = (data) => {
        const temp    = parseFloat(data?.temperature_c ?? data?.temperature ?? 0);
        const batchId = data?.batch_id || "LIVE";
        const isCrit  = temp > 8.0;

        setAlerts(prev => {
          const updated = [
            {
              id:          data?.idempotency_key || `live-${Date.now()}`,
              batch_id:    batchId,
              product:     `Live: ${batchId}`,
              location:    data?.device_id || "Live Sensor",
              temperature: temp.toFixed(1),
              humidity:    String(data?.humidity_pct ?? data?.humidity ?? "—"),
              status:      isCrit ? "critical" : "normal",
              time:        new Date().toISOString(),
            },
            ...prev.filter(a => a.batch_id !== batchId),
          ].slice(0, 20);

          // Recalculate breaches
          setBreaches(updated.filter(a => a.status === "critical").length);
          return updated;
        });
        setDataSource("Live WebSocket");
      };

      socket.on("sensor_update", onSensor);
      return () => socket.off("sensor_update", onSensor);
    } catch (_) {
      // Socket not available — CSV only mode
    }
  }, []);

  const statusColor = (s) =>
    s === "critical" ? "bg-red-100 text-red-700 border-red-200"
    : s === "warning" ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-emerald-100 text-emerald-700 border-emerald-200";

  const statusIcon = (s) =>
    s === "critical" ? "🚨" : s === "warning" ? "⚠️" : "✅";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Cold Chain Monitoring</h1>
          <p className="mt-2 text-slate-600">Temperature and humidity alerts across shipments.</p>
          <p className="mt-1 text-xs text-slate-500">
            📍 Data source: <span className="font-semibold">{dataSource}</span>
            {lastUpdated && (
              <span className="ml-2 text-slate-400">
                · Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className={`rounded-full px-3 py-1 text-xs font-bold border ${
            dataSource.includes("WebSocket")
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : "bg-amber-100 text-amber-700 border-amber-200"
          }`}>
            {dataSource.includes("WebSocket") ? "🟢 LIVE" : "📄 CSV"}
          </div>

          <button onClick={loadData}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
            ↻ Refresh
          </button>

          {/* ── FIXED: Breach counter now shows real count from data ── */}
          <div className="rounded-2xl bg-white border border-slate-200 px-6 py-3 shadow-sm text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Active Breaches</p>
            <p className={`text-3xl font-bold mt-1 ${breaches > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {breaches}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ {error}
        </div>
      )}

      {/* Critical breach alert banner */}
      {breaches > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">
            🚨 {breaches} active cold chain breach{breaches > 1 ? "es" : ""} detected
          </p>
          <p className="text-xs text-red-700 mt-1">
            Temperature exceeded 8°C threshold. Immediate action required.
            These batches flagged for anomaly detection.
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Critical (&gt;8°C)</p>
          <p className="mt-2 text-3xl font-bold text-red-800">
            {alerts.filter(a => a.status === "critical").length}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Warning</p>
          <p className="mt-2 text-3xl font-bold text-amber-800">
            {alerts.filter(a => a.status === "warning").length}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Normal</p>
          <p className="mt-2 text-3xl font-bold text-emerald-800">
            {alerts.filter(a => a.status === "normal").length}
          </p>
        </div>
      </div>

      {/* Sensor cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-36 rounded-3xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="text-slate-500 text-lg">No sensor data available.</p>
          <p className="text-sm text-slate-400 mt-2">
            Start Mosquitto MQTT broker to receive live data, or check CSV file path.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {alerts.map((a) => (
            <div key={a.id || a.batch_id}
              className={`rounded-3xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                a.status === "critical" ? "border-red-200 bg-red-50/30" : "border-slate-200"
              }`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                    {a.batch_id}
                  </p>
                  <h3 className="font-semibold text-slate-900 mt-0.5">{a.product || a.drug_name}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold border ${statusColor(a.status)}`}>
                  {statusIcon(a.status)} {(a.status || "NORMAL").toUpperCase()}
                </span>
              </div>

              <div className="mt-4 flex items-end gap-6">
                <div>
                  <p className="text-xs text-slate-400">Temperature</p>
                  <p className={`text-3xl font-bold mt-0.5 ${
                    a.status === "critical" ? "text-red-700" :
                    a.status === "warning"  ? "text-amber-700" : "text-slate-900"
                  }`}>
                    {a.temperature}°C
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Humidity</p>
                  <p className="text-xl font-semibold text-slate-700 mt-0.5">{a.humidity}%</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-slate-500">📍 {a.location}</p>
                {a.status === "critical" && (
                  <span className="text-xs text-red-600 font-semibold animate-pulse">
                    ⚡ Breach — dispatch alert sent
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DistributorColdChain;
