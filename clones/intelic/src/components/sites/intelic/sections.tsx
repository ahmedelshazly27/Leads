/* eslint-disable @next/next/no-img-element */
import { A, capabilityRow1, capabilityRow2, links } from "./data";
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
              <p className="ic-body">We source tomorrow’s capabilities, and deliver them today.</p>
              <h1 className="ic-hero__headline">
                Next-generation defense and energy technology, contracted and delivered across the Arab world.
              </h1>
            </div>
            <div className="ic-hero__panel">
              <div className="ic-hero__card">
                <img src={`${A}/img/card-nexus.webp`} alt="An operator holds an unmanned aircraft overhead" />
                <div className="ic-hero__card-text">
                  <h2 className="ic-h-card">Defense programs</h2>
                  <p className="ic-body">
                    We partner with leading manufacturers to bring advanced unmanned, sensing and command systems to
                    armed forces across the region.
                  </p>
                  <a href={links.defense} className="ic-link ic-mono">
                    Explore defense <Chevron />
                  </a>
                </div>
              </div>
              <div className="ic-hero__card ic-hero__card--rev">
                <img src={`${A}/img/card-base.webp`} alt="A team preparing equipment in the field" />
                <div className="ic-hero__card-text">
                  <h2 className="ic-h-card">Energy &amp; infrastructure</h2>
                  <p className="ic-body">
                    From grid-scale storage to resilient power for remote sites, we contract and integrate the energy
                    technology that keeps critical infrastructure running.
                  </p>
                  <a href={links.energy} className="ic-link ic-mono">
                    Explore energy <Chevron />
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
        alt="Two silhouetted figures stand against a dusk sky"
        loading="lazy"
      />
      <div className="ic-wrap">
        <span className="ic-mono ic-label">The challenge</span>
        <SplitText
          as="h2"
          className="ic-h2"
          text="Critical technology reaches the region slowly, through fragmented supply chains, long procurement cycles and partners who don’t stay for the long run"
          suffix={<span className="dot">.</span>}
        />
        <div className="ic-solution">
          <Reveal>
            <span className="ic-mono ic-label">Our answer</span>
            <p className="ic-lead">
              Suhail Industries is a single accountable contractor for next-generation defense and energy technology.
              We source the right systems, handle compliance and localization, and support every program from contract
              to lifecycle.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function MeetNexus() {
  return (
    <section className="ic-nexus" id="capabilities" aria-label="What we do">
      <LightRays />
      <div className="ic-nexus__blur" />
      <div className="ic-wrap">
        <div className="ic-rule" />
        <div className="ic-nexus__row">
          <div className="ic-nexus__intro">
            <span className="ic-mono ic-label">What we do</span>
            <h3 className="ic-display">End to end</h3>
            <p className="ic-lead">Turn complex procurement into mission-ready capability</p>
            <a href={links.sectors} className="ic-btn ic-btn--outline ic-mono">
              Our sectors <Chevrons />
            </a>
          </div>
          <div className="ic-bento">
            <a href={links.sectors} className="ic-bento__card ic-bento__card--features ic-bento__a">
              <img src={`${A}/img/bento-features.webp`} alt="Command software on three stacked screens" loading="lazy" />
              <h4>Explore capabilities</h4>
            </a>
            <div className="ic-bento__card ic-bento__b">
              <h4>What we do in short</h4>
              <p className="ic-body">
                Suhail Industries identifies, contracts and delivers advanced defense and energy systems from trusted
                global manufacturers, then integrates and supports them on the ground with local teams.
              </p>
            </div>
            <div className="ic-bento__card ic-bento__c">
              <h4>Built for the Arab world</h4>
              <p className="ic-body">
                We work across the Gulf, the Levant and North Africa, aligning every program with national industrial
                strategies, offset requirements and local partners.
              </p>
            </div>
            <a href={links.contact} className="ic-bento__card ic-bento__d">
              <img src={`${A}/img/bento-partner.webp`} alt="Technician assembling an unmanned aircraft" loading="lazy" />
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
    <section className="ic-platform" aria-label="One partner">
      <Reveal>
        <h2>One partner for defense and energy technology</h2>
      </Reveal>
      <SplitText as="p" className="ic-body" text="Explore the sectors we serve across the region" />
    </section>
  );
}

export function About() {
  return (
    <section className="ic-about" id="about" aria-label="Our commitment">
      <img
        className="ic-about__bg"
        src={`${A}/img/about-europe.webp`}
        alt="A vehicle drives along a rocky plain under a wide sky"
        loading="lazy"
      />
      <div className="ic-wrap">
        <span className="ic-mono ic-label">Our Commitment</span>
        <Reveal>
          <h2 className="ic-display">
            We are building
            <br />a stronger region
          </h2>
        </Reveal>
        <div className="ic-about__cols">
          <Reveal delay={0.1}>
            <p className="ic-body">
              The Arab world is investing in sovereign capability at a historic pace. Armed forces need modern,
              interoperable systems, and energy operators need technology that withstands extreme conditions and
              rising demand. Getting that technology in place quickly, and keeping it running, is what decides
              outcomes.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="ic-body">
              Suhail Industries bridges global innovators and regional programs. We shorten procurement cycles, build
              local skills and supply chains, transfer know-how to national partners, and stay accountable long after
              delivery. Together, these commitments strengthen the nations and industries we serve.
            </p>
          </Reveal>
        </div>
        <a href={links.contact} className="ic-btn ic-btn--grey ic-mono ic-about__cta">
          Talk to us <Chevrons />
        </a>
      </div>
    </section>
  );
}

function CapabilityRow({ items, dur }: { items: string[]; dur: number }) {
  const all = [...items, ...items];
  return (
    <div className="ic-marquee__track" style={{ "--dur": `${dur}ms` } as React.CSSProperties}>
      {all.map((t, i) => (
        <span key={i} className="ic-marquee__item ic-mono" aria-hidden={i >= items.length}>
          {t}
        </span>
      ))}
    </div>
  );
}

export function Partners() {
  return (
    <section className="ic-partners" id="partners" aria-label="Partners">
      <div className="ic-partners__inner">
        <div className="ic-partners__left">
          <span className="ic-mono ic-label">Partners</span>
          <h2>Open to Industry Partners</h2>
          <p className="ic-body">
            We work with defense and energy technology manufacturers worldwide who want a trusted, long-term route into
            the Arab world, and with the institutions that rely on their systems.
          </p>
          <a href={links.contact} className="ic-btn ic-btn--grey ic-mono">
            Partner with us <Chevrons />
          </a>
        </div>
        <div className="ic-marquee">
          <CapabilityRow items={capabilityRow1} dur={38675} />
          <CapabilityRow items={capabilityRow2} dur={44150} />
        </div>
      </div>
    </section>
  );
}
