'use client';

import { useDocumentInfo, useField } from '@payloadcms/ui';

import { focalToObjectPosition } from '../../lib/media/focal';

/**
 * In-admin live crop preview for a Media upload's focal point.
 *
 * Media is generic: ONE image feeds many cover-crop consumers across the site,
 * each with a different aspect ratio (and some clipped to a circle). This field
 * shows the representative SET of four canonical frames so an editor can choose
 * a focal point that survives every crop — updating live as they drag the focal
 * selector, with no save or refetch.
 *
 * Single source of truth: the object-position comes from the SAME
 * `focalToObjectPosition` helper the frontend resolver uses, so the preview and
 * the live site can never diverge.
 *
 * Data sources (Payload 3.84):
 *   - `focalX` / `focalY` / `alt` → `useField` (real form fields, live)
 *   - image `url` → `useDocumentInfo().savedDocumentData` — the upload `url` is
 *     NOT a registered form field, so `useField({ path: 'url' })` is unreliable.
 *     Reading the saved doc data also gives the natural "save to preview" empty
 *     state for a brand-new, not-yet-saved upload.
 */

type Frame = {
  id: string;
  label: string;
  ratio: string;
  circle: boolean;
};

// Each frame maps to a real cover-crop surface in globals.css, so the editor
// previews the actual shapes the image will be poured into on the live site.
const FRAMES: readonly Frame[] = [
  // .hero-cine-img · .seasonal-hero-img · gallery hero tile · .highlight-seasonal-media
  { id: 'wide', label: 'Panorámica 16:9', ratio: '16 / 9', circle: false },
  // .tour-card-img · .editorial-img · .event-story-media
  { id: 'portrait', label: 'Retrato 4:5', ratio: '4 / 5', circle: false },
  // .team-photo · .testimonial-avatar (border-radius: 50%)
  { id: 'round', label: 'Redondo 1:1', ratio: '1 / 1', circle: true },
  // .seasonal-gallery-item · .gallery-img (mobile)
  { id: 'square', label: 'Cuadrado 1:1', ratio: '1 / 1', circle: false },
];

export const FocalPreviewField: React.FC = () => {
  const { value: focalX } = useField<number | null>({ path: 'focalX' });
  const { value: focalY } = useField<number | null>({ path: 'focalY' });
  const { value: alt } = useField<string | null>({ path: 'alt' });
  const { savedDocumentData } = useDocumentInfo();

  const url = typeof savedDocumentData?.url === 'string' ? savedDocumentData.url : null;
  const altText = typeof alt === 'string' ? alt : '';
  // Recomputed every render from the live focal values via the shared helper.
  const objectPosition = focalToObjectPosition(focalX, focalY);

  return (
    <div className="field-type" data-testid="focal-preview">
      <label className="field-label">Vista previa del encuadre</label>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--theme-elevation-500)' }}>
        Así se recorta esta imagen en los distintos formatos del sitio según el punto focal.
      </p>

      {url ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 16,
          }}
        >
          {FRAMES.map((frame) => (
            <figure key={frame.id} style={{ margin: 0 }}>
              <div
                style={{
                  aspectRatio: frame.ratio,
                  borderRadius: frame.circle ? '50%' : 4,
                  overflow: 'hidden',
                  background: 'var(--theme-elevation-100)',
                  border: '1px solid var(--theme-elevation-150)',
                }}
              >
                {/* Admin-only live preview; the public site uses next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  data-frame={frame.id}
                  src={url}
                  alt={altText ? `${altText} — ${frame.label}` : `Vista previa: ${frame.label}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition,
                  }}
                />
              </div>
              <figcaption
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  textAlign: 'center',
                  color: 'var(--theme-elevation-600)',
                }}
              >
                {frame.label}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p
          data-testid="focal-preview-empty"
          style={{ margin: 0, fontSize: 13, color: 'var(--theme-elevation-400)' }}
        >
          Guarda la imagen para previsualizar el encuadre.
        </p>
      )}
    </div>
  );
};

export default FocalPreviewField;
