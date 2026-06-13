/**
 * Custom icon for the Payload admin nav (small mark in the top-left corner).
 *
 * Rendered by Payload's admin shell (not the Next.js frontend), so it uses a
 * plain <img> instead of next/image. Uses the compact badge mark served
 * statically from /public/brand.
 */
export default function AdminIcon() {
  return (
    <img
      src="/brand/logo-badge.png"
      alt="Los Chillangos"
      style={{ height: 28, width: 'auto' }}
    />
  );
}
