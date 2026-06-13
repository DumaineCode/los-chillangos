/**
 * Custom logo for the Payload admin login screen.
 *
 * Rendered by Payload's admin shell (not the Next.js frontend), so it uses a
 * plain <img> instead of next/image. Points at the bundled brand asset served
 * statically from /public/brand. This is the light-surface wordmark, matching
 * the frontend's default light logo in src/components/Logo.tsx.
 */
export default function AdminLogo() {
  return (
    <img
      src="/brand/logo-3.png"
      alt="Los Chillangos"
      style={{ height: 80, width: 'auto' }}
    />
  );
}
