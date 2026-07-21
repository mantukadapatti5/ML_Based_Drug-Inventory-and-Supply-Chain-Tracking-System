import { useState, useEffect } from "react";
import { getSystemHealth } from "../../services/api";
import LiveStatusBadge from "../../components/LiveStatusBadge";
import { useRealtimeStatus } from "../../hooks/useRealtimeStatus";

const AdminHealth = () => {
  const [health, setHealth] = useState(null);
  const { status } = useRealtimeStatus({ role: "admin" });

  useEffect(() => {
    const load = () => getSystemHealth().then((res) => setHealth(res.data)).catch(console.error);
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const systems = health
    ? [
        { label: "API", status: health.status === "healthy" ? "Operational" : "Degraded" },
        { label: "PostgreSQL", status: health.database?.includes("postgres") ? "Operational" : "SQLite Dev" },
        { label: "InfluxDB", status: health.influxdb ? "Operational" : "Offline" },
        { label: "MongoDB", status: health.mongodb ? "Operational" : "Offline" },
        { label: "MQTT Bridge", status: health.mqtt_bridge ? "Operational" : "Offline" },
        { label: "Telemetry Consumer", status: health.telemetry_consumer ? "Operational" : "Offline" },
        { label: "ML Anomaly", status: health.ml_anomaly_consumer ? "Operational" : "Offline" },
        { label: "ML Engine", status: health.ml_security_engine ? "Calibrated" : "Pending" },
        { label: "Fabric Gate", status: health.fabric_gateway_consumer ? "Operational" : "Offline" },
        { label: "Blockchain", status: health.fabric_mode || "mock" },
        { label: "WebSocket", status: health.websocket_broadcaster ? "Streaming" : "Idle" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">System Health Dashboard</h1>
          <p className="mt-2 text-slate-300">Live status from /health endpoint (15s refresh).</p>
        </div>
        <LiveStatusBadge status={status} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {systems.map((system) => (
          <div
            key={system.label}
            className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-sm"
          >
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{system.label}</p>
            <p className="mt-4 text-3xl font-semibold text-white">{system.status}</p>
          </div>
        ))}
        {!health && <p className="text-slate-500">Loading health metrics...</p>}
      </div>
    </div>
  );
};

export default AdminHealth;
