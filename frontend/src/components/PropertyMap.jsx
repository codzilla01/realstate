import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const icon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function PropertyMap({ lat, lng, title }) {
  if (lat == null || lng == null) {
    return (
      <div className="h-72 rounded-lg border border-white/10 bg-ink-800 flex items-center justify-center text-white/40 text-sm">
        الموقع غير متوفر
      </div>
    );
  }

  return (
    <div className="h-72 rounded-lg overflow-hidden border border-white/10">
      <MapContainer center={[lat, lng]} zoom={14} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={icon}>
          <Popup>{title}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
