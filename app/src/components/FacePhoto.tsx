import type { ReactNode } from "react";

/**
 * A photo with an SVG overlay sharing the image's coordinate space.
 * Image space is 1000 wide × 1000/aspect tall, so a normalized landmark
 * (x, y) maps to (x*1000, y*1000/aspect). `crop` (normalized x, y, w, h)
 * zooms into part of the photo; the SVG always covers its box.
 */
export function FacePhoto({
  src,
  aspect,
  children,
  crop,
  className = "",
  placeholderTone = "light",
}: {
  src: string | null;
  aspect: number;
  children?: ReactNode;
  crop?: [number, number, number, number];
  className?: string;
  placeholderTone?: "light" | "slate";
}) {
  if (!src)
    return (
      <div className={`face-photo ${className}`} style={{ width: "100%", height: "100%" }}>
        <Placeholder tone={placeholderTone} />
      </div>
    );
  const H = 1000 / aspect;
  const vb = crop ? [crop[0] * 1000, crop[1] * H, crop[2] * 1000, crop[3] * H] : [0, 0, 1000, H];
  return (
    <svg
      className={`face-photo ${className}`}
      viewBox={vb.join(" ")}
      preserveAspectRatio="xMidYMid slice"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <image href={src} x={0} y={0} width={1000} height={H} preserveAspectRatio="none" />
      {children}
    </svg>
  );
}

/** Convert a normalized point to FacePhoto coordinates. */
export const toPhoto = (p: [number, number], aspect: number): [number, number] => [p[0] * 1000, (p[1] * 1000) / aspect];

/** Neutral stand-in used for the sample profile (no photo). */
export function Placeholder({ tone = "light" }: { tone?: "light" | "slate" }) {
  const bg = tone === "slate" ? "#a9bdc4" : "#f3f4f4";
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <radialGradient id="ph-skin" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#e6d2c4" />
          <stop offset="1" stopColor="#cdb3a3" />
        </radialGradient>
        <linearGradient id="ph-shirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone === "slate" ? "#2b3136" : "#e9ecee"} />
          <stop offset="1" stopColor={tone === "slate" ? "#1f2428" : "#dfe3e5"} />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill={bg} />
      <path d="M40 500c10-70 70-105 160-110 90 5 150 40 160 110Z" fill="url(#ph-shirt)" />
      <rect x="168" y="300" width="64" height="80" rx="24" fill="#d5bcad" />
      <path d="M110 190c0-80 40-125 90-125s90 45 90 125c0 20-6 30-10 34 0-40-8-90-80-96-72 6-80 56-80 96-4-4-10-14-10-34Z" fill="#3a3330" />
      <ellipse cx="200" cy="215" rx="78" ry="102" fill="url(#ph-skin)" />
      <g fill="none" stroke="#9c8476" strokeWidth="3" strokeLinecap="round" opacity=".55">
        <path d="M150 190q18-9 36-3M214 187q18-6 36 3" />
        <path d="M200 215v32q-6 6 0 8" />
        <path d="M178 280q22 9 44 0" />
      </g>
      <g fill="#6d5c55" opacity=".6">
        <ellipse cx="170" cy="207" rx="9" ry="5" />
        <ellipse cx="230" cy="207" rx="9" ry="5" />
      </g>
    </svg>
  );
}
