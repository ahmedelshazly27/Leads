/* eslint-disable @next/next/no-img-element */
import { A, links, logosRow1, logosRow2 } from "./data";
import { LightRays } from "./light-rays";
import { Chevron, Chevrons, Reveal, SplitText } from "./motion";

export function Hero() {
  return (
    <section className="ic-hero" aria-label="Intro">
      <video
        className="ic-hero__media"
        poster={`${A}/img/hero-poster-desktop.webp`}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src={`${A}/video/hero-clouds.mp4`} type="video/mp4" />
        <source src={`${A}/video/hero-clouds.webm`} type="video/webm" />
      </video>
      <div className="ic-hero__content">
        <div className="ic-wrap">
          <div className="ic-hero__line" />
          <div className="ic-hero__grid">
            <div className="ic-hero__left">
              <p className="ic-body">We deliver for today’s battlefield, and build for tomorrow’s resilience.</p>
              <h1 className="ic-hero__headline">
                A solution built for military operators, strengthened by Purposeful Intelligence in every mission.
              </h1>
            </div>
            <div className="ic-hero__panel">
              <div className="ic-hero__card">
                <img
                  src={`${A}/img/card-nexus.webp`}
                  alt="A soldier in camouflage gear holds a military drone overhead"
                />
                <div className="ic-hero__card-text">
                  <h2 className="ic-h-card">Unified through Nexus</h2>
                  <p className="ic-body">
                    With Nexus - our platform-agnostic C2 software - we unify the fragmented landscape of unmanned
                    defense systems, so that industry leaders unlock new capabilities.
                  </p>
                  <a href={links.nexus} className="ic-link ic-mono">
                    Discover Nexus <Chevron />
                  </a>
                </div>
              </div>
              <div className="ic-hero__card ic-hero__card--rev">
                <img
                  src={`${A}/img/card-base.webp`}
                  alt="Soldiers in camouflage uniforms are preparing unmanned systems"
                />
                <div className="ic-hero__card-text">
                  <h2 className="ic-h-card">Join Intelic BASE</h2>
                  <p className="ic-body">
                    We power the European procurement hub for interoperable defense systems. Source, compare and
                    procure mission-ready unmanned systems, ready to deploy.
                  </p>
                  <a href={links.base} className="ic-link ic-mono">
                    Gain access now <Chevron />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Challenge() {
  return (
    <section className="ic-challenge" aria-label="The challenge and solution">
      <img
        className="ic-challenge__bg"
        src={`${A}/img/challenge-silhouettes.webp`}
        alt="Two silhouetted soldiers stand against a dusk sky"
        loading="lazy"
      />
      <div className="ic-wrap">
        <span className="ic-mono ic-label">The challenge</span>
        <SplitText
          as="h2"
          className="ic-h2"
          text="A fragmented landscape of unmanned systems undermines operational speed, coordination and control, leaving military forces vulnerable in contested environments"
          suffix={<span className="dot">.</span>}
        />
        <div className="ic-solution">
          <Reveal>
            <span className="ic-mono ic-label">The solution</span>
            <p className="ic-lead">
              Nexus is the advanced military Command-and-Control software for unmanned systems. Platform-agnostic by
              design, Nexus ensures interoperability between multiple unmanned systems, operators and commanders, and
              Battlefield Management Systems.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function MeetNexus() {
  return (
    <section className="ic-nexus" aria-label="Meet Nexus">
      <LightRays />
      <div className="ic-nexus__blur" />
      <div className="ic-wrap">
        <div className="ic-rule" />
        <div className="ic-nexus__row">
          <div className="ic-nexus__intro">
            <span className="ic-mono ic-label">Product</span>
            <h3 className="ic-display">Meet Nexus</h3>
            <p className="ic-lead">Turn your unmanned system into the most capable asset on the battlefield</p>
            <a href={links.nexus} className="ic-btn ic-btn--outline ic-mono">
              Discover nexus <Chevrons />
            </a>
          </div>
          <div className="ic-bento">
            <a href={links.nexus} className="ic-bento__card ic-bento__card--features ic-bento__a">
              <img src={`${A}/img/bento-features.webp`} alt="Nexus software UI on three stacked screens" loading="lazy" />
              <h4>Explore features</h4>
            </a>
            <div className="ic-bento__card ic-bento__b">
              <h4>Our product in short</h4>
              <p className="ic-body">
                Nexus bridges the gap between ground control stations and Battle Management Systems, providing full
                control up to the command of multiple unmanned systems. With built-in onboard intelligent functions,
                the software is designed for military use in contested environments.
              </p>
            </div>
            <div className="ic-bento__card ic-bento__c">
              <h4>Used by industry leaders in Europe</h4>
              <p className="ic-body">
                Across Europe, defense systems often struggle to work together. Nexus changes that by bridging gaps
                between manufacturers and nations, transforming fragmentation into collaboration.
              </p>
            </div>
            <a href={links.contact} className="ic-bento__card ic-bento__d">
              <img src={`${A}/img/bento-partner.webp`} alt="Soldier holding a drone" loading="lazy" />
              <h4>Partner with us</h4>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Platform() {
  return (
    <section className="ic-platform" aria-label="One platform">
      <Reveal>
        <h2>One Platform to command all unmanned systems</h2>
      </Reveal>
      <SplitText as="p" className="ic-body" text="Explore how Nexus enables different high-stakes missions" />
    </section>
  );
}

export function About() {
  return (
    <section className="ic-about" aria-label="Our commitment">
      <img
        className="ic-about__bg"
        src={`${A}/img/about-europe.webp`}
        alt="A military vehicle drives along a rocky plain under a wide sky"
        loading="lazy"
      />
      <div className="ic-wrap">
        <span className="ic-mono ic-label">Our Commitment</span>
        <Reveal>
          <h2 className="ic-display">
            We are building
            <br />a stronger Europe
          </h2>
        </Reveal>
        <div className="ic-about__cols">
          <Reveal delay={0.1}>
            <p className="ic-body">
              Europe is facing increasing threats. While we do not seek conflict, we must be prepared to respond when
              necessary. With military forces experiencing personnel shortages and limited readiness for prolonged
              operations, unmanned systems are essential in bridging gaps and maintaining the upper hand.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="ic-body">
              True strategic advantage is realized through the seamless and effective operation of these unmanned
              systems. We reduce integration and deployment times, compress operator training thanks to intuitive
              tools, leverage smart functions that empower immediate action, and lay the foundation for coalition
              readiness. Together, these capabilities serve to strengthen the forces protecting Europe.
            </p>
          </Reveal>
        </div>
        <a href={links.about} className="ic-btn ic-btn--grey ic-mono ic-about__cta">
          About us <Chevrons />
        </a>
      </div>
    </section>
  );
}

function MarqueeRow({ logos, dur }: { logos: typeof logosRow1; dur: number }) {
  const all = [...logos, ...logos];
  return (
    <div className="ic-marquee__track" style={{ "--dur": `${dur}ms` } as React.CSSProperties}>
      {all.map((l, i) => (
        <img
          key={i}
          src={l.file}
          alt={i < logos.length ? l.alt : ""}
          aria-hidden={i >= logos.length}
          style={{ "--h": `${l.h}px` } as React.CSSProperties}
          loading="lazy"
        />
      ))}
    </div>
  );
}

export function Partners() {
  return (
    <section className="ic-partners" aria-label="Partners">
      <div className="ic-partners__inner">
        <div className="ic-partners__left">
          <span className="ic-mono ic-label">Partners</span>
          <h2>Trusted by Industry Leaders</h2>
          <p className="ic-body">
            We work with unmanned system companies around the world to enhance their platforms, and provide a simple
            solution for a unified landscape of systems to the armed forces.
          </p>
          <a href={links.contact} className="ic-btn ic-btn--grey ic-mono">
            Partner with us <Chevrons />
          </a>
        </div>
        <div className="ic-marquee">
          {/* Durations read from document.getAnimations() on the source. */}
          <MarqueeRow logos={logosRow1} dur={38675} />
          <MarqueeRow logos={logosRow2} dur={44150} />
        </div>
      </div>
    </section>
  );
}
