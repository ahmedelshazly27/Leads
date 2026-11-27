export const A = "/sites/intelic";

export const BRAND = "Suhail Industries";

// In-page anchors until real pages exist.
export const links = {
  capabilities: "#capabilities",
  sectors: "#sectors",
  about: "#about",
  partners: "#partners",
  contact: "#contact",
  careers: "#contact",
  defense: "#sectors",
  energy: "#sectors",
  security: "#sectors",
};

export const sectors = [
  {
    key: "defense",
    label: "DEFENSE",
    title: "Defense",
    tagline: "Unmanned, sensing and command systems for modern forces",
    f01: "Defense program management",
    img: `${A}/img/mission-screen.webp`,
    alt: "A counter-drone radar truck in the desert launches an interceptor that destroys an incoming drone",
    nav: `${A}/img/nav-screen.webp`,
    href: links.defense,
  },
  {
    key: "energy",
    label: "ENERGY",
    title: "Energy",
    tagline: "Resilient power and storage for critical and remote sites",
    f01: "Energy systems integration",
    img: `${A}/img/mission-supply.webp`,
    alt: "A desert solar and gas site under a protective sensor dome with patrol drones",
    nav: `${A}/img/nav-supply.webp`,
    href: links.energy,
  },
  {
    key: "security",
    label: "SECURITY",
    title: "Security",
    tagline: "Protection for borders, ports and critical infrastructure",
    f01: "Site security integration",
    img: `${A}/img/mission-attack.webp`,
    alt: "A coastal port at night with sensors tracking approaching vessels",
    nav: `${A}/img/nav-attack.webp`,
    href: links.security,
  },
] as const;

export const features = ["Global supplier network", "Localization & offset", "Lifecycle support"] as const;

export const featureDesc =
  "One accountable team from requirement to delivery: sourcing, contracting, compliance, integration and operator training.";

// Capability areas shown in the scrolling rows (no third-party logos are implied as partners).
export const capabilityRow1 = [
  "Unmanned systems",
  "Command & control",
  "Counter-UAS",
  "ISR & sensing",
  "Secure communications",
  "Training & simulation",
];
export const capabilityRow2 = [
  "Energy storage",
  "Solar & hybrid power",
  "Microgrids",
  "Hydrogen",
  "Grid resilience",
  "Critical site protection",
];
