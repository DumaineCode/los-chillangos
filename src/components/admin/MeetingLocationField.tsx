'use client';

import { useField } from '@payloadcms/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Custom admin field for the tour meeting point.
 *
 * Replaces the default `meetingLocation` group UI with a plain-language address
 * search that autocompletes against OpenStreetMap's Photon API (free, no API
 * key). Picking a suggestion stores `{ address, lat, lng }` on the group value;
 * the public tour page renders an interactive Leaflet map from those coords,
 * and Live Preview reflects the change as soon as it's selected.
 */

type MeetingLocationValue = {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] }; // [lng, lat]
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

const PHOTON_URL = 'https://photon.komoot.io/api/';

function formatLabel(props: PhotonFeature['properties']): string {
  const street = [props.street, props.housenumber].filter(Boolean).join(' ');
  const parts = [
    props.name,
    street || undefined,
    props.district,
    props.city,
    props.state,
    props.country,
  ].filter((p): p is string => Boolean(p && p.trim()));
  // De-duplicate consecutive repeats (e.g. name === city).
  return parts.filter((p, i) => p !== parts[i - 1]).join(', ');
}

export const MeetingLocationField: React.FC<{ path: string }> = ({ path }) => {
  const { value, setValue } = useField<MeetingLocationValue>({ path });

  const [query, setQuery] = useState(value?.address ?? '');
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the visible query in sync if the stored value changes externally
  // (e.g. switching documents or locale).
  useEffect(() => {
    setQuery(value?.address ?? '');
  }, [value?.address]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=5`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Photon ${res.status}`);
      const data: { features?: PhotonFeature[] } = await res.json();
      setResults(data.features ?? []);
      setOpen(true);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Could not reach the address service. Try again.');
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce the search as the user types.
  useEffect(() => {
    if (query === (value?.address ?? '')) return;
    const id = setTimeout(() => void search(query), 350);
    return () => clearTimeout(id);
  }, [query, search, value?.address]);

  const choose = (feature: PhotonFeature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const address = formatLabel(feature.properties);
    setValue({ address, lat, lng });
    setQuery(address);
    setResults([]);
    setOpen(false);
  };

  const clear = () => {
    setValue({ address: null, lat: null, lng: null });
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const hasCoords = typeof value?.lat === 'number' && typeof value?.lng === 'number';

  return (
    <div className="field-type" style={{ position: 'relative' }}>
      <label className="field-label" htmlFor={`${path}-search`}>
        Meeting point location
      </label>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--theme-elevation-500)' }}>
        Type the address in plain language and pick a suggestion. The tour page
        shows an interactive map at this exact spot.
      </p>

      <input
        id={`${path}-search`}
        type="text"
        className="field-type__input"
        autoComplete="off"
        placeholder="e.g. Café Avellaneda, Coyoacán, CDMX"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-150)',
          background: 'var(--theme-input-bg)',
          color: 'var(--theme-elevation-800)',
        }}
      />

      {loading ? (
        <span style={{ fontSize: 12, color: 'var(--theme-elevation-400)' }}>Searching…</span>
      ) : null}
      {error ? (
        <span style={{ fontSize: 12, color: 'var(--theme-error-500)' }}>{error}</span>
      ) : null}

      {open && results.length > 0 ? (
        <ul
          style={{
            listStyle: 'none',
            margin: '4px 0 0',
            padding: 4,
            position: 'absolute',
            zIndex: 10,
            width: '100%',
            maxHeight: 240,
            overflowY: 'auto',
            background: 'var(--theme-elevation-50)',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: 4,
            boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
          }}
        >
          {results.map((feature, i) => {
            const label = formatLabel(feature.properties);
            return (
              <li key={`${label}-${i}`}>
                <button
                  type="button"
                  onClick={() => choose(feature)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: 4,
                    background: 'transparent',
                    color: 'var(--theme-elevation-800)',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {hasCoords ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: 'var(--theme-elevation-600)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>
            📍 {value?.address} ({value?.lat?.toFixed(5)}, {value?.lng?.toFixed(5)})
          </span>
          <button
            type="button"
            onClick={clear}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--theme-error-500)',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: 12,
            }}
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default MeetingLocationField;
