'use client';

import { useCallback } from 'react';
import { MapPin } from 'lucide-react';
import type { Map as MapLibreMap } from 'maplibre-gl';

import { MapBase } from './maps/MapBase';

/**
 * Interactive meeting-point map (client component).
 *
 * Migrated from Leaflet to MapLibre GL (mapcn approach) via the shared
 * `MapBase`. Renders an accent-colored pin at the tour's stored coordinates and
 * offers a button to open the spot in Google Maps. Props are unchanged so the
 * tour detail page keeps calling it the same way.
 */

type Props = {
  lat: number;
  lng: number;
  label?: string | null;
  /** Label for the "open in Google Maps" button (localized by the caller). */
  openInMapsLabel?: string;
};

export function TourMap({ lat, lng, label, openInMapsLabel = 'Open in Google Maps' }: Props) {
  const handleReady = useCallback(
    (map: MapLibreMap) => {
      void (async () => {
        const maplibregl = (await import('maplibre-gl')).default;

        // Accent-colored teardrop pin built as a DOM element, matching the
        // site's --terra accent (kept consistent with the old divIcon look).
        const el = document.createElement('div');
        el.className = 'tour-map-pin';
        el.innerHTML = '<span></span>';

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(map);

        if (label) {
          marker.setPopup(new maplibregl.Popup({ offset: 24 }).setText(label));
        }
      })();
    },
    [lat, lng, label],
  );

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <div style={{ marginTop: 16 }}>
      <MapBase
        center={[lng, lat]}
        zoom={15}
        onReady={handleReady}
        aria-label={label ? `Map showing ${label}` : 'Map showing the meeting point'}
        style={{ aspectRatio: '21 / 9', borderRadius: 4, overflow: 'hidden' }}
      />
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost btn-sm"
        style={{
          marginTop: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <MapPin size={16} aria-hidden />
        {openInMapsLabel}
      </a>
    </div>
  );
}

export default TourMap;
