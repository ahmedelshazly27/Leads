import type { CaptureQuality } from "../lib/types";
import { Info } from "./icons";

export function CaptureWarning({ capture, metrics }: { capture: CaptureQuality | undefined; metrics?: string[] }) {
  if (!capture?.warnings.length) return null;
  const hit = metrics ? metrics.filter((m) => capture.affected.includes(m)) : capture.affected;
  if (metrics && !hit.length) return null;
  return (
    <div className="capwarn">
      <Info size={16} />
      <div>
        <div className="capwarn-title">Photo conditions affect {metrics ? "this result" : "some results"}</div>
        {capture.warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
      </div>
      <style>{`
        .capwarn { display: flex; gap: 12px; padding: 12px 16px; margin-bottom: 12px; border-radius: 14px;
          background: #f4f1ea; border: 1px solid #e9e2d3; color: #6b5d43; font-size: 12.5px; line-height: 1.5; }
        .capwarn svg { flex: none; margin-top: 2px; }
        .capwarn-title { color: #4a3f2b; font-weight: 500; margin-bottom: 2px; }
        .capwarn p { margin: 0; }
      `}</style>
    </div>
  );
}
