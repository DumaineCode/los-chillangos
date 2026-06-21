'use client';

import { useCallback } from 'react';
import { Bike } from 'lucide-react';
import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl';

import { MapBase } from './MapBase';

/**
 * Public route map (client component).
 *
 * Draws the tour route on a MapLibre GL basemap (mapcn approach via MapBase).
 * Given the ordered waypoints stored in the admin, it requests the real road
 * geometry from our `/api/route` proxy (OpenRouteService, bike profile) and
 * renders it as a line with numbered stop markers. A floating card (top-left)
 * shows a bike icon, the route name, the distance and the duration — reusing
 * the tour's existing `distance` and `duration` fields (no calories, by design).
 *
 * If routing is unreachable it falls back to straight lines between waypoints so
 * the route is always visible. The caller only renders this when there are at
 * least two waypoints.
 */

export type Waypoint = { lat: number; lng: number; label?: string | null };

type Props = {
  waypoints: Waypoint[];
  /** Route/tour name shown in the card. */
  name: string;
  /** Human distance string from the tour, e.g. "12 km". */
  distance?: string | null;
  /** Human duration string from the tour, e.g. "3 h". */
  duration?: string | null;
};

const ROUTE_SOURCE = 'tour-route';
const ROUTE_LAYER = 'tour-route-line';

async function fetchRouteGeometry(
  waypoints: Waypoint[],
): Promise<[number, number][] | null> {
  // Ask our server-side proxy (which calls OpenRouteService with a bike profile
  // using a key that never reaches the browser). Returns GeoJSON [lng, lat].
  try {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates: waypoints.map((w) => [w.lng, w.lat] as [number, number]),
      }),
    });
    if (!res.ok) return null;
    const data: { coordinates?: [number, number][] } = await res.json();
    const line = data.coordinates;
    return Array.isArray(line) && line.length > 1 ? line : null;
  } catch {
    return null;
  }
}

function boundsOf(coords: [number, number][]): LngLatBoundsLike {
  let minLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLng = coords[0][0];
  let maxLat = coords[0][1];
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export function RouteMap({ waypoints, name, distance, duration }: Props) {
  const handleReady = useCallback(
    (map: MapLibreMap) => {
      void (async () => {
        const maplibregl = (await import('maplibre-gl')).default;

        // Prefer the real road path; fall back to straight lines.
        const straight = waypoints.map((w) => [w.lng, w.lat] as [number, number]);
        const line = (await fetchRouteGeometry(waypoints)) ?? straight;

        if (map.getLayer(ROUTE_LAYER)) map.removeLayer(ROUTE_LAYER);
        if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);

        map.addSource(ROUTE_SOURCE, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: line },
          },
        });
        map.addLayer({
          id: ROUTE_LAYER,
          type: 'line',
          source: ROUTE_SOURCE,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#c2603e',
            'line-width': 4,
            'line-opacity': 0.9,
          },
        });

        // Numbered stop markers at each waypoint.
        waypoints.forEach((w, i) => {
          const el = document.createElement('div');
          el.className = 'route-stop-marker';
          el.textContent = String(i + 1);
          const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([w.lng, w.lat])
            .addTo(map);
          if (w.label) {
            marker.setPopup(new maplibregl.Popup({ offset: 16 }).setText(w.label));
          }
        });

        // Frame the whole route.
        map.fitBounds(boundsOf(line), { padding: 56, duration: 0 });
      })();
    },
    [waypoints],
  );

  const center: [number, number] = [waypoints[0].lng, waypoints[0].lat];

  return (
    <div style={{ position: 'relative', marginTop: 16 }}>
      <MapBase
        center={center}
        zoom={13}
        onReady={handleReady}
        aria-label={`Map showing the route for ${name}`}
        style={{ aspectRatio: '16 / 10', borderRadius: 4, overflow: 'hidden' }}
      />
      <div className="route-card">
        <span className="route-card-icon" aria-hidden>
          <Bike size={20} />
        </span>
        <div className="route-card-body">
          <strong className="route-card-name">{name}</strong>
          <div className="route-card-stats">
            {distance ? <span>{distance}</span> : null}
            {distance && duration ? <span aria-hidden>·</span> : null}
            {duration ? <span>{duration}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RouteMap;
