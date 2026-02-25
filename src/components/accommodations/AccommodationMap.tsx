import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
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

// This component MUST be inside MapContainer
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

// Error boundary to prevent map crashes from taking down the app
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
        <div className="h-[400px] md:h-[500px] rounded-lg border bg-muted flex items-center justify-center">
          <p className="text-muted-foreground">Mapu sa momentálne nepodarilo načítať.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function MapInner({ accommodations, selectedId, onSelect }: Props) {
  const validAccommodations = accommodations.filter((a) => a.lat && a.lng);

  const selectedIcon = new L.Icon({
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [30, 45],
    iconAnchor: [15, 45],
    popupAnchor: [0, -45],
    shadowSize: [41, 41],
  });

  return (
    <MapContainer
      center={[50.5, 12.0]}
      zoom={6}
      className="h-full w-full"
      style={{ zIndex: 0 }}
      scrollWheelZoom
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
      <div className="h-[400px] md:h-[500px] rounded-lg overflow-hidden border">
        <MapInner {...props} />
      </div>
    </MapErrorBoundary>
  );
}
