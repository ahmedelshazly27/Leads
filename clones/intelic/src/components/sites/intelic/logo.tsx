/** Suhail star mark: an eight-point star (Suhail is the Arabic name for the star Canopus). */
export function StarMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M50 0 56.5 38.5 82 18 61.5 43.5 100 50 61.5 56.5 82 82 56.5 61.5 50 100 43.5 61.5 18 82 38.5 56.5 0 50 38.5 43.5 18 18 43.5 38.5Z" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="ic-wordmark">
      <StarMark size={24} />
      <span className="ic-wordmark__text">Suhail</span>
    </span>
  );
}
