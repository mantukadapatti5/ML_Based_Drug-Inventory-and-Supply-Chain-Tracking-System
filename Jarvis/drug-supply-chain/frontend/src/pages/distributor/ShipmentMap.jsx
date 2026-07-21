import { useState, useEffect } from "react";
import RealtimeMapComponent from "../../components/RealtimeMapComponent";
import { getActiveShipments, getShipmentLocation, getShipmentHistory } from "../../services/api";

const ShipmentMap = () => {
  const [activeShipments, setActiveShipments] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [currentLoc, setCurrentLoc] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const res = await getActiveShipments();
        const ships = res.data?.shipments || (Array.isArray(res.data) ? res.data : []);
        setActiveShipments(ships);
        if (ships.length > 0) {
          setSelectedId(ships[0].shipment_id);
        }
      } catch (err) {
        console.error("Failed to fetch active shipments");
      }
    };
    fetchActive();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const [locRes, histRes] = await Promise.all([
          getShipmentLocation(selectedId),
          getShipmentHistory(selectedId)
        ]);
        setCurrentLoc(locRes.data);
        setHistory(histRes.data.history.readings.map(r => [r.lat, r.lng]));
      } catch (err) {
        console.error("Failed to fetch shipment data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [selectedId]);

  return (
    <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-6 lg:grid-cols-4">
      {/* Sidebar */}
      <div className="flex flex-col gap-6 lg:col-span-1">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm overflow-y-auto">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Active Shipments</h2>
          <div className="space-y-3">
            {activeShipments.map(s => (
              <button
                key={s.shipment_id}
                onClick={() => setSelectedId(s.shipment_id)}
                className={`w-full rounded-2xl p-4 text-left transition ${
                  selectedId === s.shipment_id 
                  ? "bg-sky-50 border-sky-200 border-2" 
                  : "bg-slate-50 border-transparent border-2 hover:bg-slate-100"
                }`}
              >
                <p className="font-semibold text-slate-900">{s.shipment_id}</p>
                <p className="text-sm text-slate-500">{s.transit_status}</p>
              </button>
            ))}
          </div>
        </div>

        {currentLoc && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">Status Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Speed</span>
                <span className="font-medium text-slate-900">{currentLoc.speed_kmh} km/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Battery</span>
                <span className="font-medium text-slate-900">{currentLoc.battery_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Signal</span>
                <span className="font-medium text-slate-900">{currentLoc.signal_strength_dbm} dBm</span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
                Last updated: {new Date(currentLoc.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map View */}
      <div className="relative rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
        {currentLoc ? (
          <RealtimeMapComponent 
            center={[currentLoc.lat, currentLoc.lng]} 
            markers={[{ id: selectedId, lat: currentLoc.lat, lng: currentLoc.lng, status: currentLoc.transit_status, speed: currentLoc.speed_kmh }]}
            trail={history}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            {loading ? "Loading location..." : "Select a shipment to track"}
          </div>
        )}
        
        <div className="absolute top-4 right-4 z-[1000] rounded-full bg-white/80 backdrop-blur px-4 py-2 text-xs font-semibold text-sky-700 shadow-sm border border-sky-100">
          Live GPS Tracking
        </div>
      </div>
    </div>
  );
};

export default ShipmentMap;


