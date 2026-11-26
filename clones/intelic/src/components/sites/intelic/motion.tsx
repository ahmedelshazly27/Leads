"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function useInView<T extends Element>(threshold = 0.2, once = true) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, once]);
  return [ref, inView] as const;
}

/** Fade + rise when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  return (
    <div
      ref={ref}
      className={`ic-reveal ${className}`}
      data-in={inView}
      style={{ "--d": `${delay}s` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Per-character reveal, mirroring the source's split-into-<span> text effect.
 * `trigger` overrides the in-view trigger (used when content swaps on tab change).
 */
export function SplitText({
  text,
  as: Tag = "span",
  className = "",
  trigger,
  suffix,
}: {
  text: string;
  as?: "span" | "h2" | "p" | "h3";
  className?: string;
  trigger?: boolean;
  suffix?: ReactNode;
}) {
  const [ref, inView] = useInView<HTMLElement>(0.3);
  const shown = trigger ?? inView;
  let i = 0;
  const words = text.split(" ");
  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={`ic-split ${className}`}
      data-in={shown}
      aria-label={text}
    >
      {words.map((w, wi) => (
        <span key={wi} aria-hidden="true">
          <span className="ic-word">
            {[...w].map((c) => (
              <span key={i} className="ic-char" style={{ "--i": i++ } as React.CSSProperties}>
                {c}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? " " : null}
        </span>
      ))}
      {suffix}
    </Tag>
  );
}

export function Chevrons({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 2.5 6.5 7 2 11.5M7.5 2.5 12 7l-4.5 4.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function Chevron({ size = 10, dir = "right" }: { size?: number; dir?: "right" | "down" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      style={dir === "down" ? { transform: "rotate(90deg)" } : undefined}
    >
      <path d="M3.5 1.5 7 5l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
