import Image from 'next/image';

/**
 * Brand wordmark.
 *
 * `variant: 'light'` (default) renders the navy-on-cream logo for use over
 * light surfaces; `variant: 'dark'` renders the cream-on-dark logo for use
 * over the navy footer or the cinematic hero.
 *
 * Both source files live in `/public/brand/` (PR 4 copied them from the
 * legacy `assets/` directory).
 */
type Props = {
  variant?: 'light' | 'dark';
  height?: number;
  className?: string;
};

export function Logo({ variant = 'light', height = 40, className }: Props) {
  const src = variant === 'dark' ? '/brand/logo-1.png' : '/brand/logo-3.png';
  return (
    <Image
      src={src}
      alt="Los Chillangos"
      width={Math.round(height * 4)}
      height={height}
      className={['logo-img', className].filter(Boolean).join(' ')}
      style={{ height, width: 'auto' }}
      priority
    />
  );
}
