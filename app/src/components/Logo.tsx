/** Brand mark "Bright brow": a ring of light, thickest at the top, with a point above (after al-ghurra, the bright brow). */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="5 1.5 54 54" role="img" aria-label="Waddah">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 13a19 19 0 1 1 0 38a19 19 0 1 1 0-38Zm0 6a16 16 0 1 0 0 32a16 16 0 1 0 0-32Z"
      />
      <circle cx="32" cy="7.6" r="2.8" fill="currentColor" />
    </svg>
  );
}
