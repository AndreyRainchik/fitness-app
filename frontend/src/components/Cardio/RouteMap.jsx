import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon } from 'lucide-react';
import { Card, CardHeader } from '../ui';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

/** A theme colour from index.css ("99 102 241") as a CSS colour. */
const themeColor = (name) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`;

/**
 * The route on an OpenStreetMap map. `points` is [[lat, lng], ...]. Tiles
 * load from openstreetmap.org (and are dimmed in the dark theme by CSS).
 * On phones one finger scrolls the page; two fingers move the map.
 * The map element is `isolate` so Leaflet's own z-indexes (panes 400-700,
 * controls 1000) stay inside it instead of covering the app's fixed popups,
 * header and nav.
 */
function RouteMap({ points }) {
  const element = useRef(null);

  useEffect(() => {
    if (!element.current || !points || points.length < 2) return undefined;
    const map = L.map(element.current, {
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      tap: false,
      attributionControl: true,
    });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);

    const surface = themeColor('--surface');
    const line = L.polyline(points, { color: themeColor('--primary-500'), weight: 4, opacity: 0.95, lineJoin: 'round' }).addTo(map);
    const dot = (latlng, color, label) => L.circleMarker(latlng, {
      radius: 7, color: surface, weight: 2, fillColor: color, fillOpacity: 1,
    }).bindTooltip(label).addTo(map);

    const start = points[0];
    const end = points[points.length - 1];
    const loop = map.distance(start, end) < 50;
    if (!loop) dot(end, themeColor('--danger-500'), 'Finish');
    dot(start, themeColor('--success-500'), loop ? 'Start / finish' : 'Start');

    map.fitBounds(line.getBounds(), { padding: [24, 24] });
    return () => map.remove();
  }, [points]);

  if (!points || points.length < 2) return null;
  return (
    <Card padding="p-0" className="route-map overflow-hidden">
      <div className="px-5 pt-5">
        <CardHeader title="Route" icon={MapIcon} />
      </div>
      <div ref={element} className="isolate h-72 w-full sm:h-96" role="img" aria-label="Map of the route" />
    </Card>
  );
}

export default RouteMap;
