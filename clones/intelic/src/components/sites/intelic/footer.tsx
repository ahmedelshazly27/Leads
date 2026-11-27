"use client";

import Link from "next/link";
import { useState } from "react";
import { links } from "./data";
import { StarMark } from "./logo";
import { Chevrons } from "./motion";

export function Footer() {
  const [sent, setSent] = useState(false);
  return (
    <footer className="ic-footer" id="contact">
      <div className="ic-footer__inner">
        <div className="ic-footer__brand">
          <StarMark size={220} className="ic-footer__star" />
          <h2>Suhail</h2>
        </div>
        <div className="ic-footer__main">
          <h3>Reach out to get the conversation started.</h3>
          <div className="ic-footer__ctas">
            <a href={links.contact} className="ic-btn ic-btn--dark ic-mono">
              Contact us <Chevrons />
            </a>
            <a href={links.partners} className="ic-btn ic-btn--grey ic-mono">
              Become a partner <Chevrons />
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
                Thanks, we’ll be in touch.
              </p>
            )}
          </div>
          <div className="ic-footer__cols">
            <div>
              <span className="ic-mono ic-label">Navigation</span>
              <div className="ic-footer__links">
                <Link href="/">Home</Link>
                <a href={links.capabilities}>Capabilities</a>
                <a href={links.sectors}>Sectors</a>
                <a href={links.defense}>Defense</a>
                <a href={links.energy}>Energy</a>
                <a href={links.security}>Security</a>
              </div>
            </div>
            <div>
              <span className="ic-mono ic-label">Company</span>
              <div className="ic-footer__links">
                <a href={links.about}>About us</a>
                <a href={links.partners}>Partners</a>
              </div>
            </div>
            <div>
              <span className="ic-mono ic-label">Contact</span>
              <div className="ic-footer__links">
                <a href={links.contact}>Get in touch</a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="ic-legal ic-mono">
        <span>© {new Date().getFullYear()} Suhail Industries</span>
        <span>Next-gen defense &amp; energy technology</span>
        <span>Serving the Arab world</span>
      </div>
    </footer>
  );
}

export function CookieBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="ic-cookie" role="dialog" aria-label="Cookie notice">
      <span>We use cookies to personalize content and analyze traffic.</span>
      <button type="button" onClick={() => setOpen(false)}>
        Okay
      </button>
    </div>
  );
}
