import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons for bundlers
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface Accommodation {
  id: string;
  name: string;
  address: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  price_per_person: number | null;
  rating: number | null;
}

interface Props {
  accommodations: Accommodation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function FitBounds({ accommodations }: { accommodations: Accommodation[] }) {
  const map = useMap();
  const prevLen = useRef(0);

  useEffect(() => {
    const valid = accommodations.filter((a) => a.lat && a.lng);
    if (valid.length === 0) return;
    if (valid.length === prevLen.current) return;
    prevLen.current = valid.length;
    const bounds = L.latLngBounds(valid.map((a) => [a.lat!, a.lng!]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [accommodations, map]);

  return null;
}

class MapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    console.error("Map rendering error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: "500px", width: "100%", minHeight: "500px" }} className="rounded-lg border bg-muted flex items-center justify-center">
          <p className="text-muted-foreground">Mapu sa momentálne nepodarilo načítať.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function MapInner({ accommodations, selectedId, onSelect }: Props) {
  const validAccommodations = accommodations.filter((a) => a.lat && a.lng);

  const selectedIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [30, 45],
    iconAnchor: [15, 45],
    popupAnchor: [0, -45],
    shadowSize: [41, 41],
  });

  return (
    <MapContainer
      center={[51.1657, 10.4515]}
      zoom={6}
      scrollWheelZoom
      style={{ height: "500px", width: "100%", minHeight: "500px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds accommodations={validAccommodations} />
      {validAccommodations.map((acc) => (
        <Marker
          key={acc.id}
          position={[acc.lat!, acc.lng!]}
          icon={acc.id === selectedId ? selectedIcon : new L.Icon.Default()}
          eventHandlers={{ click: () => onSelect(acc.id) }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{acc.name || acc.address}</p>
              <p className="text-xs">{acc.city}</p>
              {acc.capacity && <p className="text-xs">Kapacita: {acc.capacity}</p>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default function AccommodationMap(props: Props) {
  return (
    <MapErrorBoundary>
      <div className="rounded-lg overflow-hidden border" style={{ height: "500px", width: "100%", minHeight: "500px" }}>
        <MapInner {...props} />
      </div>
    </MapErrorBoundary>
  );
}
