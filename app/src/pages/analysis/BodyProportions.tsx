import { FacePhoto, toPhoto } from "../../components/FacePhoto";
import type { BodyResult, Gender } from "../../lib/types";
import { FeatureView } from "./FeatureView";

export function taperLabel(swr: number, gender: Gender) {
  if (gender === "female") return swr > 1.45 ? "Broad Shoulders" : swr > 1.25 ? "Balanced Frame" : "Straight Frame";
  if (swr >= 1.55) return "Strong V-Taper";
  if (swr >= 1.4) return "Moderate V-Taper";
  if (swr >= 1.25) return "Mild Taper";
  return "Straight Frame";
}

export function BodyProportions({ body, photo, gender }: { body: BodyResult; photo: string | null; gender: Gender }) {
  const m = body.metrics;
  const label = taperLabel(m.shoulderToWaist, gender);
  const target = gender === "female" ? "≈ 0.70 waist-to-hip (tape)" : "≈ 1.6 shoulder-to-waist";
  const tilt = (d: number) => (Math.abs(d) < 1.5 ? "Level" : `${Math.abs(d).toFixed(1)}° ${d > 0 ? "right low" : "left low"}`);

  return (
    <FeatureView
      title="Your body"
      highlight="proportions"
      lead={
        <>
          Frontal width ratios describe your <b>silhouette</b> — the outline people read first, before any detail.
        </>
      }
      photo={
        <FacePhoto src={photo} aspect={body.imageAspect} placeholderTone="slate">
          {body.lines && (
            <g>
              {(["shoulder", "waist", "hip"] as const).map((k) => {
                const [a, b] = body.lines![k].map((p) => toPhoto(p, body.imageAspect));
                return (
                  <g key={k}>
                    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeWidth={1.4} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                    {[a, b].map((p, i) => (
                      <circle key={i} cx={p[0]} cy={p[1]} r={6} fill="#fff" stroke="#55646a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    ))}
                    <g transform={`translate(${(a[0] + b[0]) / 2}, ${a[1] - 14})`}>
                      <rect x={-40} y={-16} width={80} height={22} rx={6} fill="rgba(70,82,88,.6)" />
                      <text x={0} y={-1} textAnchor="middle" fill="#eef3f4" fontSize={12} fontFamily="JetBrains Mono" letterSpacing=".08em">
                        {k.toUpperCase()}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}
        </FacePhoto>
      }
      diagram={<RatioBars s={m.shoulderWidth} w={m.waistWidth} h={m.hipWidth} />}
      typeLabel={`${label} · ${m.shoulderToWaist.toFixed(2)}`}
      attrs={[
        { label: "Shoulder : waist", value: m.shoulderToWaist.toFixed(2) },
        { label: m.whrTape ? "Waist : hip (tape)" : "Waist : hip (frontal)", value: (m.whrTape ?? m.waistToHip).toFixed(2) },
        { label: "Shoulder line", value: tilt(m.shoulderTilt) },
        { label: "Pelvis line", value: tilt(m.hipTilt) },
      ]}
      explanation={
        <>
          Your shoulders measure <b>{m.shoulderToWaist.toFixed(2)}×</b> your narrowest waist width (research target {target}).{" "}
          {gender !== "female" && m.shoulderToWaist < 1.55
            ? "Widening the shoulders (lateral and rear delts, upper back) and reducing waist fat are the two levers that move this ratio. "
            : ""}
          {!m.feetVisible && "Feet were out of frame, so leg-to-height proportions were skipped. "}
          {!m.whrTape && "Add tape-measured waist and hip circumferences for WHO-comparable ratios."}
        </>
      }
      method="body"
    />
  );
}

function RatioBars({ s, w, h }: { s: number; w: number; h: number }) {
  const max = Math.max(s, w, h);
  const rows = [
    ["Shoulder", s],
    ["Waist", w],
    ["Hip", h],
  ] as const;
  return (
    <svg viewBox="0 0 320 120" width="100%" height="100%">
      {rows.map(([name, v], i) => {
        const wpx = (v / max) * 220;
        const y = 22 + i * 34;
        return (
          <g key={name}>
            <text x={18} y={y + 4} fontSize={9} fontFamily="JetBrains Mono" fill="#7d898d" letterSpacing=".08em">
              {name.toUpperCase()}
            </text>
            <line x1={190 - wpx / 2} y1={y} x2={190 + wpx / 2} y2={y} stroke="#8a9a9f" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={190 - wpx / 2} cy={y} r={3} fill="#fff" stroke="#8a9a9f" />
            <circle cx={190 + wpx / 2} cy={y} r={3} fill="#fff" stroke="#8a9a9f" />
          </g>
        );
      })}
    </svg>
  );
}
