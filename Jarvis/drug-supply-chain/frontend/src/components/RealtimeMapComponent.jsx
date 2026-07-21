import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icons in React Leaflet
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const RealtimeMapComponent = ({ center = [28.6139, 77.2090], markers = [], trail = [] }) => {
  return (
    <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%", borderRadius: "1.5rem" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {markers.map((marker, idx) => (
        <Marker key={idx} position={[marker.lat, marker.lng]}>
          <Popup>
            <div className="text-sm font-medium">
              <p>Shipment: {marker.id}</p>
              <p>Status: {marker.status}</p>
              <p>Speed: {marker.speed} km/h</p>
            </div>
          </Popup>
        </Marker>
      ))}
      {trail.length > 1 && (
        <Polyline positions={trail} color="#0ea5e9" weight={4} opacity={0.6} dashArray="10, 10" />
      )}
    </MapContainer>
  );
};

export default RealtimeMapComponent;
