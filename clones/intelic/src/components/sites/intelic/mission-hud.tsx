/**
 * Animated command-and-control overlay drawn over each sector render.
 * Coordinates use a 1440x810 viewBox that is cropped like the background (cover), and every loop
 * lasts one tab cycle (10.5s) so it restarts when the tab changes.
 */
const CYCLE = "10.5s";

function Tag({ x, y, children, color = "#9fe3ff" }: { x: number; y: number; children: string; color?: string }) {
  return (
    <text x={x} y={y} fill={color} className="ic-hud__tag">
      {children}
    </text>
  );
}

function Pulse({ cx, cy, r, color, begin = "0s" }: { cx: number; cy: number; r: number; color: string; begin?: string }) {
  return (
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="1.2">
      <animate attributeName="r" values={`${r};${r * 3}`} dur="2.4s" begin={begin} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.9;0" dur="2.4s" begin={begin} repeatCount="indefinite" />
    </circle>
  );
}

function Defense() {
  // Radar on the ridge, hostile inbound from the upper right, interceptor launched mid-cycle.
  const radar = { x: 1120, y: 420 };
  const hit = { x: 1040, y: 230 };
  return (
    <>
      <g>
        <circle cx={radar.x} cy={radar.y} r="7" fill="#5fd4ff" />
        <circle cx={radar.x} cy={radar.y} r="150" fill="none" stroke="rgba(95,212,255,.25)" strokeDasharray="3 6" />
        <circle cx={radar.x} cy={radar.y} r="260" fill="none" stroke="rgba(95,212,255,.15)" strokeDasharray="3 6" />
        <path d={`M${radar.x} ${radar.y} L${radar.x} ${radar.y - 260} A260 260 0 0 1 ${radar.x + 150} ${radar.y - 212} Z`} fill="url(#ic-sweep)">
          <animateTransform attributeName="transform" type="rotate" from={`0 ${radar.x} ${radar.y}`} to={`360 ${radar.x} ${radar.y}`} dur="3.5s" repeatCount="indefinite" />
        </path>
        <Pulse cx={radar.x} cy={radar.y} r={10} color="#5fd4ff" />
        <Tag x={radar.x + 16} y={radar.y + 26}>C-UAS RADAR</Tag>
      </g>

      {/* hostile track */}
      <g>
        <path id="ic-hostile-path" d={`M1500 90 C1330 120 1180 170 ${hit.x} ${hit.y}`} fill="none" stroke="rgba(255,90,90,.35)" strokeDasharray="4 6" />
        <g>
          <circle r="14" fill="none" stroke="#ff5a5a" strokeWidth="1.5" />
          <circle r="3.5" fill="#ff5a5a" />
          <animateMotion dur={CYCLE} repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.6;1" calcMode="linear">
            <mpath href="#ic-hostile-path" />
          </animateMotion>
          <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.6;0.62;1" dur={CYCLE} repeatCount="indefinite" />
        </g>
        <Tag x={1250} y={108} color="#ff8a8a">HOSTILE UAS · TRACK 04</Tag>
      </g>

      {/* track line radar -> target */}
      <line x1={radar.x} y1={radar.y} x2={hit.x} y2={hit.y} stroke="rgba(95,212,255,.5)" strokeDasharray="2 5">
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.25;0.3;0.6;0.65;1" dur={CYCLE} repeatCount="indefinite" />
      </line>

      {/* interceptor */}
      <g>
        <path id="ic-intercept-path" d={`M${radar.x} ${radar.y} Q${radar.x - 10} ${hit.y + 60} ${hit.x} ${hit.y}`} fill="none" />
        <g>
          <circle r="4" fill="#9fe3ff" />
          <circle r="10" fill="none" stroke="#9fe3ff" />
          <animateMotion dur={CYCLE} repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="0;0.38;0.6;1" calcMode="linear">
            <mpath href="#ic-intercept-path" />
          </animateMotion>
          <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.37;0.38;0.6;0.61;1" dur={CYCLE} repeatCount="indefinite" />
        </g>
      </g>

      {/* impact */}
      <circle cx={hit.x} cy={hit.y} r="6" fill="none" stroke="#fff" strokeWidth="2">
        <animate attributeName="r" values="6;6;70;70" keyTimes="0;0.6;0.75;1" dur={CYCLE} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.6;0.61;0.75;1" dur={CYCLE} repeatCount="indefinite" />
      </circle>
      <g opacity="0">
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.62;0.65;0.95;1" dur={CYCLE} repeatCount="indefinite" />
        <Tag x={hit.x + 22} y={hit.y - 14}>THREAT NEUTRALIZED</Tag>
      </g>
    </>
  );
}

function Energy() {
  // Aligned to the dome and patrol ring already in the render: drones orbit the ring and a hostile
  // drone is jammed when it reaches the dome edge.
  const c = { x: 720, y: 545 };
  const dome = `M${c.x - 505} ${c.y} A505 400 0 0 1 ${c.x + 505} ${c.y}`;
  return (
    <>
      <ellipse id="ic-orbit" cx={c.x} cy="302" rx="592" ry="68" fill="none" stroke="rgba(95,212,255,.35)" strokeDasharray="3 7" />
      <path d={dome} fill="none" stroke="#5fd4ff" strokeWidth="1.2" strokeDasharray="6 8" opacity=".55">
        <animate attributeName="stroke-dashoffset" from="0" to="-140" dur="3s" repeatCount="indefinite" />
      </path>
      <path d={dome} fill="url(#ic-dome)" stroke="#9fe3ff" strokeWidth="3" opacity="0">
        <animate attributeName="opacity" values="0;0;0.95;0;0" keyTimes="0;0.55;0.58;0.78;1" dur={CYCLE} repeatCount="indefinite" />
      </path>
      <Tag x={c.x + 120} y={c.y + 40}>PROTECTED ENERGY SITE</Tag>

      {[0, 0.33, 0.66].map((offset) => (
        <g key={offset}>
          <circle r="11" fill="none" stroke="#5fd4ff" strokeWidth="1.4" />
          <circle r="3" fill="#5fd4ff" />
          <animateMotion dur="12s" repeatCount="indefinite" begin={`-${offset * 12}s`}>
            <mpath href="#ic-orbit" />
          </animateMotion>
        </g>
      ))}

      <path id="ic-energy-hostile" d="M1520 90 C1400 120 1300 160 1180 245" fill="none" stroke="rgba(255,90,90,.35)" strokeDasharray="4 6" />
      <g>
        <circle r="13" fill="none" stroke="#ff5a5a" strokeWidth="1.5" />
        <circle r="3.5" fill="#ff5a5a" />
        <animateMotion dur={CYCLE} repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.56;1" calcMode="linear">
          <mpath href="#ic-energy-hostile" />
        </animateMotion>
        <animate attributeName="opacity" values="1;1;0.2;0;0" keyTimes="0;0.56;0.62;0.66;1" dur={CYCLE} repeatCount="indefinite" />
      </g>
      <circle cx="1180" cy="245" r="6" fill="none" stroke="#ff8a8a" strokeWidth="2">
        <animate attributeName="r" values="6;6;50;50" keyTimes="0;0.56;0.7;1" dur={CYCLE} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.56;0.57;0.7;1" dur={CYCLE} repeatCount="indefinite" />
      </circle>
      <g opacity="0">
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.58;0.6;0.95;1" dur={CYCLE} repeatCount="indefinite" />
        <Tag x={1200} y={228} color="#ff8a8a">UAS JAMMED · LINK LOST</Tag>
      </g>
    </>
  );
}

function Security() {
  // Coastal sensor sweeping a sector; two vessels approach and get tracked.
  const s = { x: 900, y: 560 };
  return (
    <>
      <path d={`M${s.x} ${s.y} L${s.x + 520} ${s.y - 300} A600 600 0 0 1 ${s.x + 590} ${s.y - 60} Z`} fill="rgba(95,212,255,.06)" stroke="rgba(95,212,255,.3)" strokeDasharray="3 6" />
      <line x1={s.x} y1={s.y} x2={s.x + 560} y2={s.y - 250} stroke="#5fd4ff" strokeWidth="1.5" opacity=".8">
        <animateTransform attributeName="transform" type="rotate" values={`0 ${s.x} ${s.y};24 ${s.x} ${s.y};0 ${s.x} ${s.y}`} dur="4s" repeatCount="indefinite" />
      </line>
      <circle cx={s.x} cy={s.y} r="6" fill="#5fd4ff" />
      <Pulse cx={s.x} cy={s.y} r={10} color="#5fd4ff" />
      <Tag x={s.x - 150} y={s.y + 28}>COASTAL SENSOR 2</Tag>

      {[
        { id: "ic-boat-a", d: "M1500 320 C1420 340 1360 360 1290 390", tag: "VESSEL 11", tx: 1130, ty: 372 },
        { id: "ic-boat-b", d: "M1500 470 C1430 470 1380 480 1320 500", tag: "VESSEL 12", tx: 1160, ty: 530 },
      ].map((b, i) => (
        <g key={b.id}>
          <path id={b.id} d={b.d} fill="none" stroke="rgba(255,90,90,.3)" strokeDasharray="4 6" />
          <g>
            <circle r="14" fill="none" stroke="#ff5a5a" strokeWidth="1.5" />
            <circle r="3.5" fill="#ff5a5a" />
            <animateMotion dur={CYCLE} begin={`${i * 0.6}s`} repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.8;1" calcMode="linear">
              <mpath href={`#${b.id}`} />
            </animateMotion>
          </g>
          <line x1={s.x} y1={s.y} x2={b.tx + 150} y2={b.ty + (i ? -30 : 18)} stroke="rgba(95,212,255,.45)" strokeDasharray="2 5">
            <animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.3;0.35;1" dur={CYCLE} repeatCount="indefinite" />
          </line>
          <g opacity="0">
            <animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.35;0.4;1" dur={CYCLE} repeatCount="indefinite" />
            <Tag x={b.tx} y={b.ty} color="#ff8a8a">{`${b.tag} · TRACKED`}</Tag>
          </g>
        </g>
      ))}
    </>
  );
}

export function MissionHud({ kind }: { kind: "defense" | "energy" | "security" }) {
  return (
    <svg className="ic-hud" viewBox="0 0 1440 810" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="ic-sweep" cx="0" cy="1" r="1">
          <stop offset="0" stopColor="rgba(95,212,255,.0)" />
          <stop offset="1" stopColor="rgba(95,212,255,.28)" />
        </radialGradient>
        <linearGradient id="ic-dome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(95,212,255,.16)" />
          <stop offset="1" stopColor="rgba(95,212,255,.02)" />
        </linearGradient>
      </defs>
      {kind === "defense" && <Defense />}
      {kind === "energy" && <Energy />}
      {kind === "security" && <Security />}
    </svg>
  );
}
