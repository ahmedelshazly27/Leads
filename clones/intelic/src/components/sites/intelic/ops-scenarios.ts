// Fictional, illustrative scenarios for the sector console. Map space is 1000 x 560 units.
// Times are fractions (0-1) of one tab cycle.

export type Kind = "friendly" | "unknown" | "hostile" | "neutral";
export type Pt = [number, number];

export type Track = {
  id: string;
  type: string;
  path: Pt[];
  loop?: boolean;
  t0: number;
  t1: number;
  alt: string;
  source: string;
  // status changes over the cycle: [time, status label, kind]
  states: [number, string, Kind][];
  fadeAfter?: number;
};

export type Sensor = { id: string; label: string; at: Pt; r: number };
export type Zone = { id: string; label: string; poly: Pt[] };
export type Event = { t: number; text: string; level: "info" | "warn" | "alert" | "ok" };

export type Scenario = {
  title: string;
  area: string;
  sea?: Pt[];
  coast?: Pt[];
  sensors: Sensor[];
  zones: Zone[];
  structures: { label: string; poly: Pt[] }[];
  tracks: Track[];
  events: Event[];
  metric?: { label: string; unit: string; base: number; swing: number };
};

const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 36): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt;
  });

const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

export const scenarios: Record<"defense" | "energy" | "security", Scenario> = {
  defense: {
    title: "Airspace picture",
    area: "Sector North · Training area",
    sensors: [
      { id: "S1", label: "S1 · 3D RADAR", at: [520, 330], r: 230 },
      { id: "S2", label: "S2 · EO/IR", at: [300, 390], r: 140 },
      { id: "S3", label: "S3 · RF DETECT", at: [700, 420], r: 160 },
    ],
    zones: [{ id: "Z1", label: "PROTECTED SITE", poly: ellipse(520, 360, 70, 42, 24) }],
    structures: [
      { label: "", poly: rect(498, 346, 44, 26) },
      { label: "", poly: rect(470, 372, 22, 14) },
    ],
    tracks: [
      {
        id: "F-01",
        type: "Friendly UAS · ISR",
        path: ellipse(520, 300, 170, 70),
        loop: true,
        t0: 0,
        t1: 1,
        alt: "1,200 m",
        source: "S1 · Link-16",
        states: [[0, "ON STATION", "friendly"]],
      },
      {
        id: "F-02",
        type: "Friendly UAS · Patrol",
        path: ellipse(300, 390, 90, 45),
        loop: true,
        t0: 0,
        t1: 1,
        alt: "600 m",
        source: "S2 · Datalink",
        states: [[0, "PATROL", "friendly"]],
      },
      {
        id: "C-220",
        type: "Civil aircraft",
        path: [
          [-20, 70],
          [1020, 150],
        ],
        t0: 0,
        t1: 1,
        alt: "9,800 m",
        source: "ADS-B",
        states: [[0, "CIVIL · ADS-B", "neutral"]],
      },
      {
        id: "U-17",
        type: "Small UAS",
        path: [
          [990, 70],
          [820, 160],
          [700, 220],
          [620, 270],
        ],
        t0: 0.1,
        t1: 0.74,
        alt: "150 m",
        source: "S3 → S1 → S2",
        states: [
          [0.1, "UNKNOWN", "unknown"],
          [0.28, "TRACKED", "unknown"],
          [0.44, "CLASSIFIED · UAS", "unknown"],
          [0.58, "HOSTILE INTENT", "hostile"],
          [0.74, "MITIGATED", "neutral"],
        ],
        fadeAfter: 0.92,
      },
    ],
    events: [
      { t: 0.1, text: "S3 RF detection · bearing 062°", level: "info" },
      { t: 0.28, text: "S1 radar track established · U-17", level: "warn" },
      { t: 0.44, text: "EO/IR confirms small fixed-wing UAS", level: "warn" },
      { t: 0.58, text: "U-17 inbound to protected site · 2.1 km", level: "alert" },
      { t: 0.66, text: "Countermeasure authorised by duty officer", level: "warn" },
      { t: 0.74, text: "U-17 mitigated · link lost, descending", level: "ok" },
    ],
  },
  energy: {
    title: "Site protection",
    area: "Solar & gas complex · Desert site",
    sensors: [
      { id: "S1", label: "S1 · RADAR", at: [500, 320], r: 220 },
      { id: "S2", label: "S2 · RF DETECT", at: [330, 300], r: 150 },
    ],
    zones: [{ id: "Z1", label: "SITE PERIMETER", poly: ellipse(500, 320, 200, 120, 40) }],
    structures: [
      ...Array.from({ length: 6 }, (_, i) => ({ label: "", poly: rect(400 + (i % 3) * 46, 280 + Math.floor(i / 3) * 40, 38, 28) })),
      { label: "BESS", poly: rect(560, 280, 40, 26) },
      { label: "GAS", poly: rect(560, 330, 52, 34) },
    ],
    metric: { label: "Site output", unit: "MW", base: 184, swing: 6 },
    tracks: [
      {
        id: "F-11",
        type: "Friendly UAS · Perimeter",
        path: ellipse(500, 320, 230, 140),
        loop: true,
        t0: 0,
        t1: 1,
        alt: "300 m",
        source: "Datalink",
        states: [[0, "PERIMETER PATROL", "friendly"]],
      },
      {
        id: "F-12",
        type: "Friendly UAS · Perimeter",
        path: ellipse(500, 320, 230, 140).reverse(),
        loop: true,
        t0: 0,
        t1: 1,
        alt: "300 m",
        source: "Datalink",
        states: [[0, "PERIMETER PATROL", "friendly"]],
      },
      {
        id: "U-04",
        type: "Quadcopter",
        path: [
          [20, 90],
          [140, 160],
          [230, 220],
          [290, 260],
          [200, 180],
          [40, 60],
        ],
        t0: 0.12,
        t1: 0.95,
        alt: "90 m",
        source: "S2 → S1",
        states: [
          [0.12, "UNKNOWN", "unknown"],
          [0.3, "TRACKED", "unknown"],
          [0.48, "PERIMETER BREACH RISK", "hostile"],
          [0.62, "RF LINK DISRUPTED", "unknown"],
          [0.72, "RETURNING TO LAUNCH", "neutral"],
        ],
        fadeAfter: 0.95,
      },
    ],
    events: [
      { t: 0.12, text: "S2 RF signature · consumer quadcopter", level: "info" },
      { t: 0.3, text: "S1 radar track · U-04 heading 120°", level: "warn" },
      { t: 0.48, text: "U-04 within 400 m of perimeter", level: "alert" },
      { t: 0.62, text: "RF link disrupted · site output unaffected", level: "warn" },
      { t: 0.72, text: "U-04 returning to launch point", level: "ok" },
      { t: 0.84, text: "Launch point logged for security team", level: "info" },
    ],
  },
  security: {
    title: "Maritime picture",
    area: "Coastal sector · Port approaches",
    sea: [
      [560, 0],
      [1000, 0],
      [1000, 560],
      [430, 560],
      [470, 470],
      [520, 400],
      [500, 330],
      [560, 250],
      [540, 160],
      [600, 80],
    ],
    coast: [
      [600, 80],
      [540, 160],
      [560, 250],
      [500, 330],
      [520, 400],
      [470, 470],
      [430, 560],
    ],
    sensors: [
      { id: "S1", label: "S1 · COASTAL RADAR", at: [520, 290], r: 270 },
      { id: "S2", label: "S2 · EO/IR MAST", at: [500, 450], r: 150 },
    ],
    zones: [{ id: "Z1", label: "PORT APPROACH", poly: [[540, 300], [700, 270], [720, 360], [520, 380]] }],
    structures: [
      { label: "PORT", poly: rect(430, 300, 70, 60) },
      { label: "", poly: rect(500, 330, 40, 10) },
    ],
    tracks: [
      {
        id: "M-301",
        type: "Cargo vessel · AIS",
        path: [
          [1000, 420],
          [760, 360],
          [600, 330],
        ],
        t0: 0,
        t1: 1,
        alt: "—",
        source: "AIS · S1",
        states: [[0, "AIS · INBOUND", "neutral"]],
      },
      {
        id: "M-118",
        type: "Fishing vessel · AIS",
        path: ellipse(820, 470, 60, 30),
        loop: true,
        t0: 0,
        t1: 1,
        alt: "—",
        source: "AIS",
        states: [[0, "AIS · FISHING", "neutral"]],
      },
      {
        id: "V-09",
        type: "Unidentified vessel",
        path: [
          [1000, 150],
          [860, 190],
          [740, 230],
          [690, 250],
        ],
        t0: 0.08,
        t1: 0.62,
        alt: "—",
        source: "S1 radar only",
        states: [
          [0.08, "RADAR CONTACT", "unknown"],
          [0.24, "NO AIS · ANOMALY", "hostile"],
          [0.62, "INTERCEPTED", "unknown"],
          [0.82, "ESCORTED", "neutral"],
        ],
      },
      {
        id: "F-03",
        type: "Patrol boat",
        path: [
          [510, 320],
          [580, 300],
          [640, 285],
          [672, 278],
        ],
        t0: 0.36,
        t1: 0.62,
        alt: "—",
        source: "Datalink",
        states: [
          [0.36, "TASKED", "friendly"],
          [0.62, "ON SCENE", "friendly"],
        ],
      },
    ],
    events: [
      { t: 0.08, text: "S1 radar contact · 14 nm east", level: "info" },
      { t: 0.24, text: "V-09 not broadcasting AIS · flagged", level: "alert" },
      { t: 0.36, text: "Patrol boat F-03 tasked to intercept", level: "warn" },
      { t: 0.5, text: "EO/IR identifies small fast craft", level: "warn" },
      { t: 0.62, text: "F-03 on scene · V-09 stopped", level: "ok" },
      { t: 0.82, text: "V-09 escorted to port for inspection", level: "info" },
    ],
  },
};
