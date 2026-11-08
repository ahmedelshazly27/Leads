import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 16, ...p }: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const ChevronRight = (p: P) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);
export const ChevronLeft = (p: P) => (
  <svg {...base(p)}><path d="m15 6-6 6 6 6" /></svg>
);
export const ChevronDown = (p: P) => (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
);
export const ChevronUp = (p: P) => (
  <svg {...base(p)}><path d="m6 15 6-6 6 6" /></svg>
);
export const ZoomIn = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M11 8v6M8 11h6" /></svg>
);
export const ZoomOut = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6" /></svg>
);
export const Expand = (p: P) => (
  <svg {...base(p)}><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" /></svg>
);
export const Download = (p: P) => (
  <svg {...base(p)}><path d="M12 4v11M7 10.5l5 5 5-5M4 19.5h16" /></svg>
);
export const Infinity = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 12c-1.8-2.3-3.3-3.5-5-3.5a3.5 3.5 0 0 0 0 7c1.7 0 3.2-1.2 5-3.5Zm0 0c1.8 2.3 3.3 3.5 5 3.5a3.5 3.5 0 0 0 0-7c-1.7 0-3.2 1.2-5 3.5Z" />
  </svg>
);
export const PanelLeft = (p: P) => (
  <svg {...base(p)}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9 4.5v15" /></svg>
);
export const LayoutGrid = (p: P) => (
  <svg {...base(p)}><rect x="4" y="4" width="7" height="9" rx="1.5" /><rect x="13" y="4" width="7" height="5" rx="1.5" /><rect x="13" y="11" width="7" height="9" rx="1.5" /><rect x="4" y="15" width="7" height="5" rx="1.5" /></svg>
);
export const Bars = (p: P) => (
  <svg {...base(p)}><path d="M6 20V11M12 20V5M18 20v-6" /></svg>
);
export const Scan = (p: P) => (
  <svg {...base(p)}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10" /></svg>
);
export const FaceScan = (p: P) => (
  <svg {...base(p)}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="11" r="3" /><path d="M7.5 17.5a5 5 0 0 1 9 0" /></svg>
);
export const Bag = (p: P) => (
  <svg {...base(p)}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>
);
export const Gear = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></svg>
);
export const ChatHeart = (p: P) => (
  <svg {...base(p)}><path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-7l-4 3v-3H5A1.5 1.5 0 0 1 3.5 16V6A1.5 1.5 0 0 1 5 4.5Z" /><path d="M12 13.5s-3-1.7-3-3.6a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.9-3 3.6-3 3.6Z" /></svg>
);
export const HeartHand = (p: P) => (
  <svg {...base(p)}><path d="M19.5 12.6 12 20l-7.5-7.4A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 7.5 5.8Z" /><path d="m12 6.8-2.6 2.6a1.6 1.6 0 0 0 2.3 2.3l1.2-1.2 2.6 2.6" /></svg>
);
export const GradCap = (p: P) => (
  <svg {...base(p)}><path d="m2.5 9.5 9.5-4.5 9.5 4.5-9.5 4.5-9.5-4.5Z" /><path d="M6.5 11.5V16c1.5 1.5 3.5 2 5.5 2s4-.5 5.5-2v-4.5M21.5 9.5v5" /></svg>
);
export const Doc = (p: P) => (
  <svg {...base(p)}><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5Z" /><path d="M14 3.5V8h4" /></svg>
);
export const Search = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></svg>
);
export const ListIcon = (p: P) => (
  <svg {...base(p)}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>
);
export const Info = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></svg>
);
export const User = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="9" r="3.5" /><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" /></svg>
);
export const Play = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M9 7v10l8-5-8-5Z" /></svg>
);
export const Verified = (p: P) => (
  <svg {...base(p)} stroke="none" fill="currentColor">
    <path d="M12 2.5 14.4 4l2.8-.2.9 2.7 2.4 1.5-.9 2.7.9 2.6-2.4 1.6-.9 2.7-2.8-.2L12 19l-2.4-1.5-2.8.2-.9-2.7-2.4-1.6.9-2.6-.9-2.7 2.4-1.5.9-2.7 2.8.2L12 2.5Z" />
    <path d="m8.8 10.8 2.2 2.2 4.2-4.2" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const Arrows = (p: P) => (
  <svg {...base(p)}><path d="m9 8-4 4 4 4M15 8l4 4-4 4" /></svg>
);
