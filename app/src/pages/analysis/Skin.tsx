import { useEffect, useMemo, useRef, useState } from "react";
import { FacePhoto, toPhoto } from "../../components/FacePhoto";
import { ChevronRight } from "../../components/icons";
import { MethodNote } from "../../components/MethodNote";
import { ScoreCard } from "../../components/ui";
import { IDX, analyseRegion } from "../../lib/faceAnalysis";
import { imageData, loadImage } from "../../lib/image";
import type { FaceResult, SkinRegion, SkinRegionKey } from "../../lib/types";
import { faceCrop } from "./crop";
import type { SectionProps } from "./types";
import "./analysis.css";

const LABEL: Record<SkinRegionKey, string> = {
  forehead: "Forehead",
  leftCheek: "Left Cheek",
  rightCheek: "Right Cheek",
  nose: "Nose",
  underEye: "Under-eye",
  chin: "Chin",
};
const ORDER: SkinRegionKey[] = ["leftCheek", "rightCheek", "forehead", "nose", "underEye", "chin"];

/** Paint flagged pixels of a region into a transparent PNG the size of the photo. */
function useHeatmap(photo: string | null, face: FaceResult, region: SkinRegion | undefined) {
  const [img, setImg] = useState<ImageData | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!photo) return;
    loadImage(photo).then((el) => live && setImg(imageData(el)));
    return () => {
      live = false;
    };
  }, [photo]);
  useEffect(() => {
    if (!img || !region || !region.polygons.length || !face.landmarks) {
      setUrl(null);
      return;
    }
    const lm = face.landmarks;
    const fw = Math.abs(lm[IDX.zygR][0] - lm[IDX.zygL][0]) * img.width;
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    const out = ctx.createImageData(img.width, img.height);
    for (const polyN of region.polygons) {
      const r = analyseRegion(img, polyN, fw);
      const [x0, y0, x1] = r.bbox;
      const bw = x1 - x0;
      for (let i = 0; i < r.inside.length; i++) {
        if (!r.inside[i]) continue;
        const x = x0 + (i % bw);
        const y = y0 + Math.floor(i / bw);
        const o = (y * img.width + x) * 4;
        const flagged = r.flagged[i];
        out.data[o] = flagged ? 92 : 112;
        out.data[o + 1] = flagged ? 30 : 60;
        out.data[o + 2] = flagged ? 214 : 210;
        out.data[o + 3] = flagged ? 245 : 120;
      }
    }
    ctx.putImageData(out, 0, 0);
    // soften
    const c2 = document.createElement("canvas");
    c2.width = img.width;
    c2.height = img.height;
    const ctx2 = c2.getContext("2d")!;
    ctx2.filter = `blur(${Math.max(1.5, img.width / 600)}px)`;
    ctx2.drawImage(c, 0, 0);
    setUrl(c2.toDataURL("image/png"));
  }, [img, region, face.landmarks]);
  return url;
}

export function Skin({ scan, facePhoto, plan }: SectionProps) {
  const face = scan.face!;
  const regions = ORDER.map((k) => face.skin.find((s) => s.key === k)).filter(Boolean) as SkinRegion[];
  const [key, setKey] = useState<SkinRegionKey>(regions[0]?.key ?? "leftCheek");
  const region = regions.find((r) => r.key === key);
  const heat = useHeatmap(facePhoto, face, region);
  const scroller = useRef<HTMLDivElement>(null);
  const lm = face.landmarks;
  const a = face.imageAspect;
  const crop = lm ? faceCrop(lm, a, 1.45, 0.62) : undefined;

  const cov = region?.coverage ?? 0;
  const pct = cov * 100;
  const ranked = useMemo(() => [...regions].sort((x, y) => y.coverage - x.coverage), [regions]);
  const rank = ranked.findIndex((r) => r.key === key) + 1;
  const ordinal = ["highest", "2nd highest", "3rd highest", "3rd lowest", "2nd lowest", "lowest"][Math.min(5, rank - 1 + (6 - regions.length))] ?? "";
  const level = pct < 3 ? "minimal" : pct < 7 ? "mild" : pct < 14 ? "moderate" : "marked";
  const skinItems = plan.items.filter((i) => i.category === "Skin").slice(0, 2);

  // two-circle chart: areas proportional
  const R = 92;
  const rSmall = Math.max(4, R * Math.sqrt(Math.max(cov, 0.001) / Math.max(1 - cov, 0.01)));

  return (
    <div className="page">
      <header className="skn-head">
        <h1 className="title-xl">
          Assessment of your <span className="hl">skin</span>
        </h1>
        <p className="lead">
          Skin quality covers <b>pigmentation</b>, <b>redness</b> and <b>texture</b>. Even colour distribution is one of the strongest cues to perceived age and health.
        </p>
      </header>
      <div className="skn-grid">
        <div className="skn-photo">
          <FacePhoto src={facePhoto} aspect={a} crop={crop}>
            {heat && <image href={heat} x={0} y={0} width={1000} height={1000 / a} preserveAspectRatio="none" opacity={0.9} />}
            {lm &&
              region?.polygons.map((p, i) => (
                <polygon
                  key={i}
                  points={p.map((q) => toPhoto(q, a).join(",")).join(" ")}
                  fill="none"
                  stroke="rgba(255,255,255,.55)"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </FacePhoto>
          <ScoreCard label="Skin Score" value={face.metrics.skinScore} className="skn-score" />
        </div>

        <div className="skn-side">
          <div className="skn-tabs">
            <span className="skn-tabs-k">Regions</span>
            <div className="skn-tabs-scroll" ref={scroller}>
              {regions.map((r) => (
                <button key={r.key} className={`skn-tab ${r.key === key ? "on" : ""}`} onClick={() => setKey(r.key)}>
                  {LABEL[r.key]}
                </button>
              ))}
            </div>
            <button className="skn-tabs-next" aria-label="More regions" onClick={() => scroller.current?.scrollBy({ left: 220 })}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="skn-cov">
            <div className="mono">Flagged skin coverage</div>
            <div className="skn-cov-num">{pct < 10 ? pct.toFixed(1) : Math.round(pct)}%</div>
            <div className="skn-cov-line">
              <span className="skn-cov-you" style={{ left: `${Math.min(88, Math.max(12, (pct / 20) * 100))}%` }}>
                You <span style={{ color: "var(--muted)" }}>({pct.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="skn-cov-bar">
              <i style={{ height: `${Math.min(100, (pct / 20) * 100)}%` }} />
            </div>
            <span className="skn-cov-tick" style={{ bottom: `calc(14px + ${(5 / 20) * 100}% * 0.86)` }}>
              5%
            </span>
          </div>

          <div className="skn-chart">
            <svg viewBox="0 0 640 250" width="100%">
              <defs>
                <pattern id="skn-grid" width="53.3" height="40" patternUnits="userSpaceOnUse">
                  <path d="M53.3 0H0V40" fill="none" stroke="#e9e8e8" strokeWidth="1" />
                </pattern>
                <pattern id="skn-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#e3d8da" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="640" height="220" fill="url(#skn-grid)" />
              {[200 - R, 200 + R, 470 - rSmall, 470 + rSmall].map((x, i) => (
                <line key={i} x1={x} x2={x} y1={0} y2={220} stroke="#9d6070" strokeDasharray="3 3" />
              ))}
              <circle cx={200} cy={110} r={R} fill="url(#skn-hatch)" stroke="#84515e" strokeDasharray="3 3" />
              <circle cx={200} cy={110} r={R} fill="rgba(235, 232, 233,.55)" />
              <circle cx={470} cy={110} r={rSmall} fill="rgba(235, 232, 233,.9)" stroke="#84515e" strokeDasharray="3 3" />
              <text x={200} y={242} textAnchor="middle" className="radar-axis">
                REGULAR SKIN AREA
              </text>
              <text x={470} y={242} textAnchor="middle" className="radar-axis">
                FLAGGED AREA
              </text>
            </svg>
            <div className="skn-sentence">
              Your <b>{LABEL[key].toLowerCase()}</b> has the <b>{ordinal}</b> flagged coverage of your {regions.length} measured regions.
            </div>
          </div>

          <div className="skn-expl">
            <div className="mono">Explanation</div>
            <p>
              {region ? (
                <>
                  The {LABEL[key].toLowerCase()} shows <b>{level}</b> uneven pigmentation or redness ({pct.toFixed(1)}% of pixels flagged), with evenness{" "}
                  {Math.round(region.evenness)}/100, redness {Math.round(region.redness)}/100 and texture {Math.round(region.texture)}/100.{" "}
                  {skinItems.length > 0 && <>Your plan addresses this with {skinItems.map((i) => i.title.toLowerCase()).join(" and ")}.</>}
                </>
              ) : (
                "No skin regions were measured for this scan."
              )}
            </p>
          </div>
        </div>
      </div>
      <MethodNote method="skin" />
    </div>
  );
}
