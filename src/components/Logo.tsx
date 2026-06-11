import Image from 'next/image';

/**
 * Brand wordmark.
 *
 * When a `src` is provided (e.g. a logo uploaded via the `Branding` global in
 * the admin panel) it takes precedence. Otherwise the component falls back to
 * the bundled PNGs: `variant: 'light'` (default) renders the navy-on-cream
 * logo for use over light surfaces; `variant: 'dark'` renders the
 * cream-on-dark logo for the navy footer.
 *
 * The bundled source files live in `/public/brand/`.
 */
type Props = {
  src?: string | null;
  alt?: string;
  variant?: 'light' | 'dark';
  height?: number;
  className?: string;
};

export function Logo({ src, alt = 'Los Chillangos', variant = 'light', height = 40, className }: Props) {
  const resolvedSrc = src ?? (variant === 'dark' ? '/brand/logo-1.png' : '/brand/logo-3.png');
  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={Math.round(height * 4)}
      height={height}
      className={['logo-img', className].filter(Boolean).join(' ')}
      style={{ height, width: 'auto' }}
      priority
    />
  );
}
