import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Cherkasy centre — the default view before a live position arrives.
const DEFAULT_CENTER = [49.4444, 32.0598];

// Coloured dot markers via divIcon (avoids Leaflet's default marker image
// assets, which don't resolve cleanly through the bundler).
function dot(color) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// Live map of the courier's position (and, when known, the destination).
export default function TrackingMap({ courier, destination }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const courierMarker = useRef(null);
  const destMarker = useRef(null);

  // Init the map once.
  useEffect(() => {
    if (mapRef.current || !elRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true, attributionControl: false }).setView(
      courier ? [courier.lat, courier.lng] : DEFAULT_CENTER,
      14,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    // Leaflet needs a size recalc once the container has laid out.
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Destination marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (destination) {
      if (!destMarker.current) destMarker.current = L.marker([destination.lat, destination.lng], { icon: dot('#ef4444') }).addTo(map);
      else destMarker.current.setLatLng([destination.lat, destination.lng]);
    }
  }, [destination]);

  // Courier marker — follows live updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !courier) return;
    const pos = [courier.lat, courier.lng];
    if (!courierMarker.current) courierMarker.current = L.marker(pos, { icon: dot('#ff6a2b') }).addTo(map);
    else courierMarker.current.setLatLng(pos);
    map.panTo(pos, { animate: true });
  }, [courier]);

  return <div ref={elRef} className="h-full w-full" style={{ minHeight: 260 }} aria-label="map" />;
}
