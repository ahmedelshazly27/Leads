# intelic.ai — page brief

Source: https://intelic.ai/ (Framer site, inspected 2026-11-26 at 1440×900 and 390×844).

## Route map

| Source | Local | Files |
|---|---|---|
| `https://intelic.ai/` | `/` | `src/app/page.tsx`, `src/components/sites/intelic/*` |

All other links (Nexus, Newsroom, Careers, About us, Screen/Supply/Attack, Contact, Privacy, Intelic BASE, LinkedIn) point to the live source site; those pages are not cloned.

## Global

- Background `rgb(32,34,37)`, footer `rgb(44,45,47)`, accent `rgb(30,102,130)`, CTA icon `rgb(244,204,122)`.
- Fonts: Magnetik Light 300 / Regular 400 / Medium 500 (Framer-hosted woff2), DM Mono 500 (Google). Self-hosted under `public/sites/intelic/fonts`.
- Content column 1200px max with 40px gutters (text from x=160 at 1440); topbar row 1160px.
- Topbar: fixed, 64px, `rgba(17,17,17,.5)` + `blur(10px)`. "Applications" opens a mission-types panel (238px) on hover/click.
- No Lenis (no `html.lenis`, no `window.lenis`), so native scroll.

## Sections (desktop y / height)

1. Hero 0 / 900: looping cloud video (`hero-clouds.mp4`, poster webp). A hairline rule slides in from the left (translateX −100%→0, opacity .2→1, ≈3s ease-out). Glass panel 570×432 (`rgba(0,0,0,.4)`, blur 5px) with two cards.
2. Challenge/Solution 1060 / 810: 40px headline split into per-letter spans (letter reveal); silhouette photo below; solution copy at x=760.
3. Meet Nexus 2030 / 715: full-bleed WebGL canvas (teal light shafts) under a 16px backdrop blur; 80px Light heading; 2×2 bento.
4. One Platform 2745 / 1004: centered 60px heading; grey sub-copy revealed letter by letter.
5. Mission profiles 3749 / 810: three tabs (SCREEN/SUPPLY/ATTACK). The active bar fills in accent over ≈10.5s, then advances; the terrain render crossfades. Feature grid F.01–F.04; F.01 copy changes per tab.
6. Commitment 4719 / 864: sky + vehicle photo, 80px heading, two justified columns, "About us" button.
7. Partners 5743 / 605: 3-line heading; two logo marquee rows, linear and infinite, at 38.675s and 44.15s (read from `document.getAnimations()`).
8. Footer 6308 / 561, revealed by a sticky footer behind the page. CTA, newsletter form, link columns, legal row.
9. Cookie toast fixed at bottom right.

## Known differences

- The Meet Nexus canvas is a hand-written shader matching colour, direction and pace. The source shader was not extracted.
- Letter reveals are triggered on entering view with a 12ms stagger. On the source, the One Platform sub-copy is tied to scroll position (opacity 0→1 across ≈300px of scroll).
- Newsletter form does not submit anywhere.
- Below 1200px a simplified responsive layout is used. Mobile was compared at 390px; tablet widths were not checked against the source.
