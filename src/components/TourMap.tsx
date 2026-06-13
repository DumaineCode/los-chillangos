'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

/**
 * Interactive meeting-point map (client component).
 *
 * Renders an OpenStreetMap map via Leaflet at the tour's stored coordinates.
 * Leaflet is imported dynamically inside an effect so it never runs during SSR
 * (it touches `window`). A lightweight `divIcon` marker avoids Leaflet's
 * bundler-unfriendly default icon assets and matches the site's accent color.
 */

type Props = {
  lat: number;
  lng: number;
  label?: string | null;
};

export function TourMap({ lat, lng, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import('leaflet').Map | undefined;
    let cancelled = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        scrollWheelZoom: false,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: 'tour-map-pin',
        html: '<span></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);
      if (label) marker.bindPopup(label);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, label]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label ? `Map showing ${label}` : 'Map showing the meeting point'}
      style={{ aspectRatio: '21 / 9', borderRadius: 4, marginTop: 16, overflow: 'hidden' }}
    />
  );
}

export default TourMap;
