'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Shared MapLibre GL base wrapper (client component).
 *
 * Adopts the mapcn approach: a thin layer over MapLibre GL using free CARTO
 * vector tiles (no API key) that switch between light and dark themes. MapLibre
 * touches `window`, so — like the previous Leaflet setup — it is imported
 * dynamically inside an effect and never runs during SSR.
 *
 * Consumers receive the ready `map` instance through `onReady` and draw their
 * own markers/routes on top. This keeps a single, owned map foundation that
 * both the meeting-point map and the route map build on.
 */

// CARTO basemaps — same defaults mapcn ships with. Free, no key, theme-aware.
const CARTO_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export type MapBaseProps = {
  /** Initial center as [lng, lat] (MapLibre order). */
  center: [number, number];
  zoom?: number;
  /** Disable scroll-wheel zoom (matches the old meeting-point map). */
  scrollZoom?: boolean;
  /** Show the +/- zoom (and compass) buttons. Defaults to true. */
  showNavControls?: boolean;
  /** Called once the map's style has loaded and it is safe to add layers. */
  onReady?: (map: MapLibreMap) => void;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
};

function resolveTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  // The site toggles theme via a data attribute / class on <html>. Detect dark
  // mode from either signal so the basemap matches the rest of the page.
  const root = document.documentElement;
  const attr = root.getAttribute('data-theme');
  if (attr === 'dark') return 'dark';
  if (attr === 'light') return 'light';
  if (root.classList.contains('dark')) return 'dark';
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function MapBase({
  center,
  zoom = 14,
  scrollZoom = false,
  showNavControls = true,
  onReady,
  className,
  style,
  'aria-label': ariaLabel,
}: MapBaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // Keep the latest onReady without retriggering the heavy init effect.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let map: MapLibreMap | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        if (cancelled || !containerRef.current) return;

        const styleUrl = resolveTheme() === 'dark' ? CARTO_DARK : CARTO_LIGHT;

        map = new maplibregl.Map({
          container: containerRef.current,
          style: styleUrl,
          center,
          zoom,
          attributionControl: { compact: true },
        });

        if (!scrollZoom) map.scrollZoom.disable();

        if (showNavControls) {
          map.addControl(
            new maplibregl.NavigationControl({ showZoom: true, showCompass: true }),
            'top-right',
          );
        }

        map.on('load', () => {
          if (cancelled || !map) return;
          onReadyRef.current?.(map);
        });
        map.on('error', () => setFailed(true));
      } catch {
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // center/zoom are only initial values; intentionally not re-running on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={className}
      data-map-failed={failed || undefined}
      style={style}
    />
  );
}

export default MapBase;
