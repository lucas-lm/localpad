/**
 * App logo drawn with theme tokens, so it inverts with the light/dark theme (including the manual toggle).
 * Same geometry as public/icons/icon.svg.
 */
export function Logo({ size }: { size: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="22" fill="var(--text)" />
      <rect x="26" y="20" width="48" height="60" rx="5" fill="var(--bg)" />
      <rect x="34" y="36" width="32" height="4.5" rx="2" fill="var(--text)" />
      <rect x="34" y="48" width="32" height="4.5" rx="2" fill="var(--text)" />
      <rect x="34" y="60" width="21" height="4.5" rx="2" fill="var(--text)" />
    </svg>
  );
}
