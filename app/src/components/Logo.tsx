/** Brand mark: a disc whose right half is its faded reflection (mirror · before/after). */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Logo">
      <path d="M12 2.5a9.5 9.5 0 0 0 0 19Z" fill="currentColor" />
      <path d="M12 2.5a9.5 9.5 0 0 1 0 19Z" fill="currentColor" opacity=".32" />
    </svg>
  );
}
