import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "../services/socket";

const STALE_SECONDS = 60;
const CHECK_INTERVAL_MS = 10000;

/**
 * Live connection health + real-time alert stream for portal dashboards.
 * @param {object} options
 * @param {string} [options.batchId] - Filter alerts to one batch (optional)
 * @param {string} [options.role] - Socket room role: admin | vendor | distributor
 */
export function useRealtimeStatus({ batchId = null, role = "admin" } = {}) {
  const [status, setStatus] = useState("SYNC");
  const [alerts, setAlerts] = useState([]);
  const lastUpdateRef = useRef(new Date());

  const touch = useCallback(() => {
    lastUpdateRef.current = new Date();
  }, []);

  const pushAlert = useCallback(
    (data) => {
      if (batchId && data.batch_id && data.batch_id !== batchId) {
        return;
      }
      setAlerts((prev) => [
        {
          id: data.telemetry_key || `LIVE-${Date.now()}`,
          ...data,
          receivedAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 100));
      touch();
      setStatus("ALERT");
    },
    [batchId, touch]
  );

  useEffect(() => {
    const socket = getSocket(role);

    const onConnect = () => {
      console.log("Live dashboard channel verified.");
      touch();
      setStatus("LIVE");
    };

    const onDisconnect = () => {
      setStatus("SYNC");
    };

    const onAnomalyAlert = (data) => pushAlert(data);
    const onLegacyAnomaly = (data) =>
      pushAlert({
        batch_id: data.batch_id,
        reason: data.issue,
        title: data.issue,
        score: data.value,
        timestamp: data.timestamp,
        telemetry_key: data.telemetry_key,
      });

    const onSensorUpdate = (data) => {
      if (batchId && data.batch_id && data.batch_id !== batchId) {
        return;
      }
      touch();
      setStatus((current) => (current === "ALERT" ? current : "LIVE"));
    };

    const onQuarantine = (data) => {
      pushAlert({
        ...data,
        reason: data.reason || "BATCH_QUARANTINED",
        title: "Blockchain quarantine lock",
        severity: "critical",
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("new_anomaly_alert", onAnomalyAlert);
    socket.on("new_anomaly", onLegacyAnomaly);
    socket.on("sensor_update", onSensorUpdate);
    socket.on("batch_quarantined", onQuarantine);

    if (socket.connected) {
      onConnect();
    }

    const safetyCheckInterval = setInterval(() => {
      const secondsSinceUpdate = (Date.now() - lastUpdateRef.current.getTime()) / 1000;
      setStatus((current) => {
        if (current === "ALERT") {
          return current;
        }
        if (secondsSinceUpdate > STALE_SECONDS) {
          return "STALE";
        }
        if (socket.connected) {
          return "LIVE";
        }
        return "SYNC";
      });
    }, CHECK_INTERVAL_MS);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("new_anomaly_alert", onAnomalyAlert);
      socket.off("new_anomaly", onLegacyAnomaly);
      socket.off("sensor_update", onSensorUpdate);
      socket.off("batch_quarantined", onQuarantine);
      clearInterval(safetyCheckInterval);
    };
  }, [role, batchId, pushAlert, touch]);

  return {
    status,
    alerts,
    lastUpdateTime: lastUpdateRef.current,
    clearAlerts: () => setAlerts([]),
  };
}
