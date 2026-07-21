// ============================================================================
// WEBSOCKET & REAL-TIME DATA STREAMING HOOKS
// ============================================================================
// Eliminates setInterval fake data generation and replaces with real Socket.IO
// streams from the backend's WebSocket broadcaster and Kafka pipelines.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';

const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:8000/ws';

// Global Socket.IO instance
let globalSocket = null;

/**
 * Initialize and get Socket.IO connection to backend
 */
function getSocket() {
  if (!globalSocket || !globalSocket.connected) {
    globalSocket = io(WEBSOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    globalSocket.on('connect', () => {
      console.log('WebSocket connected');
    });

    globalSocket.on('disconnect', () => {
      console.warn('WebSocket disconnected');
    });

    globalSocket.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  }
  return globalSocket;
}

/**
 * REAL-TIME TELEMETRY STREAMING
 * Subscapes to: /ws/telemetry/{batch_id} room
 */
export function useTelemetryStream(batchId) {
  const [telemetry, setTelemetry] = useState({
    temperature: null,
    humidity: null,
    weight: null,
    battery: null,
    timestamp: null,
  });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!batchId) return;

    try {
      const socket = getSocket();
      socketRef.current = socket;

      // Join telemetry room for this batch
      socket.emit('join_telemetry_room', { batch_id: batchId });
      setConnected(true);

      // Listen for telemetry updates
      const handleTelemetryUpdate = (data) => {
        setTelemetry({
          temperature: data.temperature_c,
          humidity: data.humidity_pct,
          weight: data.weight_g,
          battery: data.battery_pct,
          timestamp: new Date(data.timestamp).toLocaleTimeString(),
        });
      };

      socket.on(`telemetry:${batchId}`, handleTelemetryUpdate);

      return () => {
        socket.off(`telemetry:${batchId}`, handleTelemetryUpdate);
        socket.emit('leave_telemetry_room', { batch_id: batchId });
      };
    } catch (err) {
      console.error('Telemetry stream error:', err);
      setError(err.message);
      setConnected(false);
    }
  }, [batchId]);

  return { telemetry, connected, error };
}

/**
 * REAL-TIME COLD CHAIN ALERTS
 * Subscribes to: /ws/alerts/cold-chain room
 */
export function useColdChainAlertsStream() {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const alertQueueRef = useRef([]);

  useEffect(() => {
    try {
      const socket = getSocket();

      // Join cold chain alerts room
      socket.emit('join_cold_chain_alerts');
      setConnected(true);

      // Handle incoming alerts
      const handleAlertReceived = (alert) => {
        setAlerts((prev) => {
          // Keep only latest 20 alerts
          const updated = [alert, ...prev].slice(0, 20);
          return updated;
        });
      };

      // Handle batch alerts
      const handleBatchAlerts = (batchData) => {
        setAlerts(batchData.alerts || []);
      };

      socket.on('cold_chain_alert', handleAlertReceived);
      socket.on('cold_chain_batch_update', handleBatchAlerts);

      return () => {
        socket.off('cold_chain_alert', handleAlertReceived);
        socket.off('cold_chain_batch_update', handleBatchAlerts);
      };
    } catch (err) {
      console.error('Cold chain alerts stream error:', err);
      setError(err.message);
      setConnected(false);
    }
  }, []);

  return { alerts, connected, error };
}

/**
 * REAL-TIME ANOMALY DETECTION ALERTS
 * Subscribes to: /ws/alerts/anomalies room
 */
export function useAnomalyAlertsStream() {
  const [anomalies, setAnomalies] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const socket = getSocket();

      // Join anomaly alerts room
      socket.emit('join_anomaly_alerts');
      setConnected(true);

      // Handle incoming anomaly alerts
      const handleAnomalyAlert = (anomaly) => {
        setAnomalies((prev) => {
          const updated = [anomaly, ...prev].slice(0, 50);
          return updated;
        });
      };

      socket.on('anomaly_detected', handleAnomalyAlert);

      return () => {
        socket.off('anomaly_detected', handleAnomalyAlert);
      };
    } catch (err) {
      console.error('Anomaly alerts stream error:', err);
      setError(err.message);
      setConnected(false);
    }
  }, []);

  return { anomalies, connected, error };
}

/**
 * REAL-TIME GPS TRACKING STREAM
 * Subscribes to: /ws/shipments/{shipment_id} room
 */
export function useGpsTrackingStream(shipmentId) {
  const [location, setLocation] = useState({
    lat: null,
    lng: null,
    speed: null,
    battery: null,
    timestamp: null,
  });
  const [path, setPath] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!shipmentId) return;

    try {
      const socket = getSocket();

      // Join shipment tracking room
      socket.emit('join_shipment_tracking', { shipment_id: shipmentId });
      setConnected(true);

      // Handle location updates
      const handleLocationUpdate = (data) => {
        setLocation({
          lat: data.lat,
          lng: data.lng,
          speed: data.speed_kmh,
          battery: data.battery_pct,
          timestamp: new Date(data.timestamp).toLocaleTimeString(),
        });

        // Add to path history (keep last 100 points)
        setPath((prev) => [...prev, { lat: data.lat, lng: data.lng }].slice(-100));
      };

      socket.on(`gps:${shipmentId}`, handleLocationUpdate);

      return () => {
        socket.off(`gps:${shipmentId}`, handleLocationUpdate);
        socket.emit('leave_shipment_tracking', { shipment_id: shipmentId });
      };
    } catch (err) {
      console.error('GPS tracking stream error:', err);
      setError(err.message);
      setConnected(false);
    }
  }, [shipmentId]);

  return { location, path, connected, error };
}

/**
 * REAL-TIME SYSTEM STATUS & HEALTH MONITORING
 * Subscribes to: /ws/system/health room
 */
export function useSystemHealthStream() {
  const [health, setHealth] = useState({
    database: 'unknown',
    influxdb: 'unknown',
    mongodb: 'unknown',
    kafka: 'unknown',
    fabric: 'unknown',
    mqtt: 'unknown',
    uptime: '0h',
  });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const socket = getSocket();

      // Join system health room
      socket.emit('join_system_health');
      setConnected(true);

      // Handle health updates
      const handleHealthUpdate = (data) => {
        setHealth({
          database: data.database || 'unknown',
          influxdb: data.influxdb ? 'connected' : 'disconnected',
          mongodb: data.mongodb ? 'connected' : 'disconnected',
          kafka: data.kafka ? 'connected' : 'disconnected',
          fabric: data.fabric ? 'connected' : 'disconnected',
          mqtt: data.mqtt_bridge ? 'active' : 'inactive',
          uptime: data.uptime || '0h',
        });
      };

      socket.on('system_health_update', handleHealthUpdate);

      return () => {
        socket.off('system_health_update', handleHealthUpdate);
      };
    } catch (err) {
      console.error('System health stream error:', err);
      setError(err.message);
      setConnected(false);
    }
  }, []);

  return { health, connected, error };
}

/**
 * REAL-TIME ORDER UPDATES
 * Subscribes to: /ws/orders/distributor/{distributor_id} room
 */
export function useOrderUpdatesStream(distributorId) {
  const [orders, setOrders] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!distributorId) return;

    try {
      const socket = getSocket();

      // Join order updates room
      socket.emit('join_order_updates', { distributor_id: distributorId });
      setConnected(true);

      // Handle order status changes
      const handleOrderUpdate = (order) => {
        setOrders((prev) => {
          const existing = prev.find((o) => o.id === order.id);
          if (existing) {
            return prev.map((o) => (o.id === order.id ? order : o));
          }
          return [order, ...prev].slice(0, 100);
        });
      };

      socket.on(`order_update:${distributorId}`, handleOrderUpdate);

      return () => {
        socket.off(`order_update:${distributorId}`, handleOrderUpdate);
        socket.emit('leave_order_updates', { distributor_id: distributorId });
      };
    } catch (err) {
      console.error('Order updates stream error:', err);
      setError(err.message);
      setConnected(false);
    }
  }, [distributorId]);

  return { orders, connected, error };
}

/**
 * REAL-TIME SALES DATA STREAM
 * Subscribes to: /ws/sales/realtime room
 */
export function useSalesDataStream() {
  const [sales, setSales] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const socket = getSocket();

      // Join real-time sales room
      socket.emit('join_sales_realtime');
      setConnected(true);

      // Handle new sales
      const handleNewSale = (sale) => {
        setSales((prev) => [sale, ...prev].slice(0, 100));
      };

      socket.on('sale_recorded', handleNewSale);

      return () => {
        socket.off('sale_recorded', handleNewSale);
      };
    } catch (err) {
      console.error('Sales data stream error:', err);
      setError(err.message);
      setConnected(false);
    }
  }, []);

  return { sales, connected, error };
}

/**
 * REAL-TIME COMPLIANCE EVENTS
 * Subscribes to: /ws/compliance/events room
 */
export function useComplianceEventsStream() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const socket = getSocket();

      // Join compliance events room
      socket.emit('join_compliance_events');
      setConnected(true);

      // Handle compliance events
      const handleComplianceEvent = (event) => {
        setEvents((prev) => [event, ...prev].slice(0, 50));
      };

      socket.on('compliance_event', handleComplianceEvent);

      return () => {
        socket.off('compliance_event', handleComplianceEvent);
      };
    } catch (err) {
      console.error('Compliance events stream error:', err);
      setError(err.message);
      setConnected(false);
    }
  }, []);

  return { events, connected, error };
}

/**
 * GENERIC ROOM SUBSCRIPTION (for custom real-time needs)
 */
export function useSocketRoom(roomName, eventName) {
  const [data, setData] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomName || !eventName) return;

    try {
      const socket = getSocket();
      socket.emit(`join_${roomName}`);
      setConnected(true);

      const handleEvent = (payload) => {
        setData((prev) => [payload, ...prev].slice(0, 100));
      };

      socket.on(eventName, handleEvent);

      return () => {
        socket.off(eventName, handleEvent);
        socket.emit(`leave_${roomName}`);
      };
    } catch (err) {
      console.error(`Socket room error (${roomName}):`, err);
      setError(err.message);
      setConnected(false);
    }
  }, [roomName, eventName]);

  return { data, connected, error };
}

/**
 * Disconnect all WebSocket connections (call on logout)
 */
export function disconnectWebSocket() {
  if (globalSocket && globalSocket.connected) {
    globalSocket.disconnect();
    globalSocket = null;
  }
}

export default {
  useTelemetryStream,
  useColdChainAlertsStream,
  useAnomalyAlertsStream,
  useGpsTrackingStream,
  useSystemHealthStream,
  useOrderUpdatesStream,
  useSalesDataStream,
  useComplianceEventsStream,
  useSocketRoom,
  disconnectWebSocket,
};
