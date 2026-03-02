import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

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
  rating_overall: number | null;
}

interface ResolvedMarker extends Accommodation {
  resolvedLat: number;
  resolvedLng: number;
}

interface Props {
  accommodations: Accommodation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const pinSvg = (size: number, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:${color};filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`;

const defaultIcon = L.divIcon({
  html: pinSvg(28, "hsl(var(--primary))"),
  className: "custom-map-marker",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

const selectedMarkerIcon = L.divIcon({
  html: pinSvg(36, "hsl(var(--destructive))"),
  className: "custom-map-marker",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

function FitBounds({ markers }: { markers: ResolvedMarker[] }) {
  const map = useMap();
  const prevCount = useRef(0);

  useEffect(() => {
    if (markers.length === 0 || markers.length === prevCount.current) return;
    prevCount.current = markers.length;
    const bounds = L.latLngBounds(markers.map((m) => [m.resolvedLat, m.resolvedLng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }, [markers, map]);

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
        <div className="w-full h-[500px] rounded-lg border bg-muted flex items-center justify-center">
          <p className="text-muted-foreground">Mapu sa momentálne nepodarilo načítať.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function MapInner({ accommodations, selectedId, onSelect }: Props) {
  const [markers, setMarkers] = useState<ResolvedMarker[]>([]);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const resolved: ResolvedMarker[] = [];

      for (const acc of accommodations) {
        if (cancelled) return;

        if (acc.lat != null && acc.lng != null && acc.lat !== 0 && acc.lng !== 0) {
          resolved.push({ ...acc, resolvedLat: acc.lat, resolvedLng: acc.lng });
        } else if (acc.address) {
          try {
            const q = encodeURIComponent(`${acc.address}${acc.city ? ", " + acc.city : ""}`);
            const res = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`,
              { headers: { "Accept-Language": "en" } }
            );
            const data = await res.json();
            if (data?.[0]) {
              resolved.push({
                ...acc,
                resolvedLat: parseFloat(data[0].lat),
                resolvedLng: parseFloat(data[0].lon),
              });
            }
            // Nominatim rate limit: 1 req/sec
            await new Promise((r) => setTimeout(r, 1100));
          } catch (e) {
            console.warn("Geocoding failed for", acc.address, e);
          }
        }
      }

      if (!cancelled) setMarkers(resolved);
    };

    resolve();
    return () => { cancelled = true; };
  }, [accommodations]);

  return (
    <MapContainer
      center={[51.1657, 10.4515]}
      zoom={6}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />
      <FitBounds markers={markers} />
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.resolvedLat, m.resolvedLng]}
          icon={m.id === selectedId ? selectedMarkerIcon : defaultIcon}
          eventHandlers={{ click: () => onSelect(m.id) }}
        >
          <Popup>
            <div className="text-sm min-w-[140px]">
              <p className="font-semibold">{m.name || m.address}</p>
              {m.city && <p className="text-xs opacity-70">{m.city}</p>}
              {m.capacity && <p className="text-xs">Kapacita: {m.capacity}</p>}
              {(m.price_per_person ?? 0) > 0 && (
                <p className="text-xs">{Number(m.price_per_person).toFixed(2)} €/os.</p>
              )}
              {(m.rating_overall ?? 0) > 0 && (
                <p className="text-xs font-medium">⭐ {m.rating_overall} / 10</p>
              )}
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
      <div className="w-full h-[500px] rounded-lg overflow-hidden border border-border relative z-0">
        <MapInner {...props} />
      </div>
    </MapErrorBoundary>
  );
}
