/** Placeholder brand mark — swap for your own logo. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Facet">
      <path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12 7.5a4.5 4.5 0 1 0 4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}
