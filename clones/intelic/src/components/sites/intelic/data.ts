const SRC = "https://intelic.ai";
export const A = "/sites/intelic";

export const links = {
  nexus: `${SRC}/nexus`,
  newsroom: `${SRC}/newsroom`,
  careers: `${SRC}/careers`,
  about: `${SRC}/about-us`,
  contact: `${SRC}/contact-us`,
  base: "https://base.intelic.ai/",
  screen: `${SRC}/screen`,
  supply: `${SRC}/supply`,
  attack: `${SRC}/attack`,
  privacy: `${SRC}/privacy-policy`,
  linkedin: "https://www.linkedin.com/company/intelic-ai",
};

export const missions = [
  {
    key: "screen",
    label: "SCREEN",
    title: "Screen",
    tagline: "From fast planning to a common picture with a wide range of systems",
    f01: "Many-to-many mission control",
    img: `${A}/img/mission-screen.webp`,
    alt: "A digital rendering illustrates drone surveillance zones over mountainous terrain",
    nav: `${A}/img/nav-screen.webp`,
    href: links.screen,
  },
  {
    key: "supply",
    label: "SUPPLY",
    title: "Supply",
    tagline: "Plan and execute autonomous resupply",
    f01: "Flexible mission control",
    img: `${A}/img/mission-supply.webp`,
    alt: "A futuristic, digital rendering shows autonomous resupply routes across terrain",
    nav: `${A}/img/nav-supply.webp`,
    href: links.supply,
  },
  {
    key: "attack",
    label: "ATTACK",
    title: "Attack",
    tagline: "Synchronize target detection with fire support and strike systems",
    f01: "Flexible mission control",
    img: `${A}/img/mission-attack.webp`,
    alt: "A dark, futuristic landscape with grid overlays marking targets",
    nav: `${A}/img/nav-attack.webp`,
    href: links.attack,
  },
] as const;

export const featureDesc =
  "Supports flexible control setups where one user can operate multiple, different unmanned systems, and multiple users with specific roles can access a single system.";

type Logo = { file: string; alt: string; h: number };
const L = (file: string, alt: string, h: number): Logo => ({ file: `${A}/logos/${file}`, alt, h });

// Rendered heights measured on the source at 1440px.
export const logosRow1: Logo[] = [
  L("3qDoboZxb0mGdCeH8peS20gyPx0.png", "Roboneers", 48),
  L("J6FW6R0i7ddhbjR3Bf1rLZwc4.png", "Ministerie van Defensie", 47),
  L("QEcRudZRYekOJvfo5yE4mhuMo.png", "Destinus", 30),
  L("ZynAgTcEG5H97sejUHpKoJTsoc.png", "TNO", 31),
  L("mkHb3qGXdWkHPhSjkAmnAQDd1tc.webp", "Auterion", 27),
  L("KKVoteuxNWbUBIkpqS2kIjco.png", "NLR", 53),
  L("cPakTMdQGIQiJrkQYiY8SQNRS8.png", "Partner", 24),
  L("iRkgvHY3980c5C7jiDywEAvdBk.png", "Partner", 26),
  L("x4M5hXkxgUjhHuD7Pt7Njx72Sw.png", "Partner", 42),
];
export const logosRow2: Logo[] = [
  L("v7ZnquYDZKRM0IqmC1Pu6XyFY.png", "ARX Robotics", 39),
  L("f6uKRK9oD6s5P5dn2SQHuUM3y7w.png", "Milrem Robotics", 36),
  L("zlz2jqfjfdBk1ruOAcCbDqWhc.png", "Skyeton", 30),
  L("CpxM9hCcp0TtRbkGVaJQ9HB2kI.webp", "DeltaQuad", 29),
  L("rZsONIThIQbTnfkfOpn7pP0o.png", "Gurzuf Defence", 41),
  L("WjUUjla1X7ELFpIhiOdoAENu4e4.png", "Gurzuf Defence", 28),
  L("FEXCGmPakY3wxSmoptC4zxAkw4.png", "EFRO Oost", 36),
  L("aBX7I0rbzydj0YS9HIdceiIy0.png", "Airvolute", 34),
  L("m2obxf8xTpsp1G4jFnEF7Kfgv5Q.png", "Partner", 22),
];
