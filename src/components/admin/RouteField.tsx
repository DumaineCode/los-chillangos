'use client';

import { useForm, useFormFields } from '@payloadcms/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Custom admin field for the tour route.
 *
 * Lets an admin build an ordered list of route waypoints. Each waypoint is added
 * by typing an address in plain language and picking a suggestion from
 * OpenStreetMap's Photon geocoding API (free, no API key). Waypoints can be
 * added, removed, and reordered (move up / move down). The field stores an
 * ordered array of `{ label, lat, lng }`; the public route map then draws the
 * actual road path between consecutive waypoints via OSRM.
 *
 * IMPORTANT — Payload array persistence: a custom Field on an `array` must drive
 * Payload's ROW state, not a single value. Writing the whole array via
 * useField().setValue persists to the DB but does NOT register the per-row form
 * state, so the saved rows fail to rehydrate on reload (they only "reappear"
 * after the next edit forces a sync). The correct approach used here:
 *  - READ rows from form state via useFormFields (re-renders when rows change).
 *  - WRITE rows via useForm's addFieldRow / removeFieldRow / replaceFieldRow,
 *    which update the row state Payload actually serializes and rehydrates.
 */

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

type RouteRow = { label?: string | null; lat: number; lng: number; id?: string };

// Build the per-subfield state Payload expects for one array row.
function rowState(row: RouteRow) {
  return {
    label: { value: row.label ?? null, initialValue: row.label ?? null, valid: true },
    lat: { value: row.lat, initialValue: row.lat, valid: true },
    lng: { value: row.lng, initialValue: row.lng, valid: true },
  };
}

export const RouteField: React.FC<{ path: string }> = ({ path }) => {
  const { addFieldRow, removeFieldRow, moveFieldRow } = useForm();

  // The ROW ORDER comes from Payload's internal `rows` array (the same order
  // removeFieldRow/moveFieldRow index into). We MUST build our visible list from
  // this exact order, otherwise the index the user clicks (visual) drifts from
  // the index Payload mutates (internal) — which is why removing/reordering hit
  // the "wrong" waypoint. We read each row's data by its indexed subpath so the
  // visual index === the internal index, always.
  const rows = useFormFields(([fields]) => {
    const rowMeta = fields?.[path]?.rows ?? [];
    return rowMeta.map((row, i): RouteRow & { rowId: string } => ({
      rowId: row.id,
      label: (fields?.[`${path}.${i}.label`]?.value as string | null | undefined) ?? null,
      lat: Number(fields?.[`${path}.${i}.lat`]?.value),
      lng: Number(fields?.[`${path}.${i}.lng`]?.value),
    }));
  }) as (RouteRow & { rowId: string })[];

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    if (query.trim().length < 3) return;
    const id = setTimeout(() => void search(query), 350);
    return () => clearTimeout(id);
  }, [query, search]);

  // Append the chosen suggestion as a new waypoint row via Payload's row API so
  // it is registered in form state and persisted/rehydrated correctly.
  const choose = (feature: PhotonFeature) => {
    const [nextLng, nextLat] = feature.geometry.coordinates;
    const label = formatLabel(feature.properties);
    addFieldRow({
      path,
      schemaPath: path,
      rowIndex: rows.length,
      subFieldState: rowState({ label, lat: nextLat, lng: nextLng }),
    });
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const remove = (i: number) => {
    removeFieldRow({ path, rowIndex: i });
  };

  // Reorder using Payload's native row move (keeps row state intact).
  const move = (i: number, dir: -1 | 1) => {
    const target = i + dir;
    if (target < 0 || target >= rows.length) return;
    moveFieldRow({ path, moveFromIndex: i, moveToIndex: target });
  };

  const coordText = (r: RouteRow) =>
    Number.isFinite(r.lat) && Number.isFinite(r.lng)
      ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`
      : '—';
  const summary = rows
    .map((r, i) => `${i + 1}. ${r.label ?? coordText(r)}`)
    .join('  →  ');

  return (
    <div className="field-type" style={{ position: 'relative' }}>
      <label className="field-label" htmlFor={`${path}-search`}>
        Route waypoints
      </label>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--theme-elevation-500)' }}>
        Add stops in order. Each one is geocoded from a plain-language address.
        The route map draws the road path between them.
      </p>

      <input
        id={`${path}-search`}
        type="text"
        className="field-type__input"
        autoComplete="off"
        placeholder="e.g. Zócalo, Centro Histórico, CDMX"
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

      {rows.length > 0 ? (
        <>
          <p
            style={{
              margin: '12px 0 6px',
              fontSize: 12,
              color: 'var(--theme-elevation-600)',
            }}
          >
            {summary}
          </p>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {rows.map((row, i) => (
              <li
                key={row.rowId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  marginTop: 6,
                  borderRadius: 4,
                  border: '1px solid var(--theme-elevation-150)',
                  background: 'var(--theme-elevation-50)',
                }}
              >
                <span
                  style={{
                    flex: '0 0 auto',
                    width: 24,
                    height: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'var(--theme-elevation-150)',
                    color: 'var(--theme-elevation-800)',
                  }}
                >
                  {i + 1}
                </span>

                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--theme-elevation-800)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.label ?? 'Unnamed stop'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>
                    {coordText(row)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  title="Move up"
                  style={{
                    border: '1px solid var(--theme-elevation-150)',
                    background: 'var(--theme-input-bg)',
                    color: 'var(--theme-elevation-800)',
                    borderRadius: 4,
                    width: 28,
                    height: 28,
                    cursor: i === 0 ? 'not-allowed' : 'pointer',
                    opacity: i === 0 ? 0.4 : 1,
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  aria-label="Move down"
                  title="Move down"
                  style={{
                    border: '1px solid var(--theme-elevation-150)',
                    background: 'var(--theme-input-bg)',
                    color: 'var(--theme-elevation-800)',
                    borderRadius: 4,
                    width: 28,
                    height: 28,
                    cursor: i === rows.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: i === rows.length - 1 ? 0.4 : 1,
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--theme-error-500)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: 12,
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
};

export default RouteField;
