"use client";

import Link from "next/link";
import { useState } from "react";
import { A, links } from "./data";
import { Chevrons } from "./motion";

export function Footer() {
  const [sent, setSent] = useState(false);
  return (
    <footer className="ic-footer">
      <div className="ic-footer__inner">
        <div className="ic-footer__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/img/footer-mark.png`} alt="Intelic logo" loading="lazy" />
          <h2>Intelic</h2>
        </div>
        <div className="ic-footer__main">
          <h3>Reach out to get the conversation started.</h3>
          <div className="ic-footer__ctas">
            <a href={links.contact} className="ic-btn ic-btn--dark ic-mono">
              Contact us <Chevrons />
            </a>
            <a href={links.careers} className="ic-btn ic-btn--grey ic-mono">
              Open roles <Chevrons />
            </a>
          </div>
          <div className="ic-footer__sub">
            <h4>Subscribe</h4>
            <p className="ic-body">Subscribe to our newsletter for updates and news</p>
            <form
              className="ic-form"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
            >
              <input name="name" placeholder="Name" aria-label="Name" required />
              <input name="email" type="email" placeholder="Email" aria-label="Email" required />
              <button type="submit" className="ic-mono">
                Submit <Chevrons />
              </button>
            </form>
            {sent && (
              <p className="ic-form__ok" role="status">
                Thanks — this clone does not send data anywhere.
              </p>
            )}
          </div>
          <div className="ic-footer__cols">
            <div>
              <span className="ic-mono ic-label">Navigation</span>
              <div className="ic-footer__links">
                <Link href="/">Home</Link>
                <a href={links.nexus}>Nexus</a>
                <a href={links.newsroom}>Newsroom</a>
                <a href={links.screen}>Screen</a>
                <a href={links.supply}>Supply</a>
                <a href={links.attack}>Attack</a>
                <a href={links.contact}>Contact us</a>
              </div>
            </div>
            <div>
              <span className="ic-mono ic-label">Company</span>
              <div className="ic-footer__links">
                <a href={links.careers}>Careers</a>
                <a href={links.about}>About us</a>
              </div>
            </div>
            <div>
              <span className="ic-mono ic-label">Social</span>
              <div className="ic-footer__links">
                <a href={links.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="ic-legal ic-mono">
        <span>Intelic is a tradename of Avalor AI BV</span>
        <span>KvK:82695806</span>
        <span>Amsterdam</span>
        <a href={links.privacy}>Privacy Policy</a>
        <button type="button">Cookie settings</button>
        <span>52° 22&apos; 12.7776&apos;&apos; N4° , 53&apos; 42.6048&apos;&apos; E</span>
      </div>
    </footer>
  );
}

export function CookieBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="ic-cookie" role="dialog" aria-label="Cookie notice">
      <span>We use cookies to personalize content, run ads, and analyze traffic.</span>
      <button type="button" onClick={() => setOpen(false)}>
        Okay
      </button>
    </div>
  );
}
