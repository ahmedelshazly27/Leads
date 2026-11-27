"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { links, sectors } from "./data";
import { StarMark, Wordmark } from "./logo";
import { Chevron, Chevrons } from "./motion";

export function Topbar() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const show = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeMenu = () => setMenu(false);

  return (
    <>
      <header className="ic-topbar">
        <div className="ic-topbar__inner">
          <Link href="/" className="ic-topbar__logo" aria-label="Suhail Industries home">
            <span className="ic-topbar__full">
              <Wordmark />
            </span>
            <span className="ic-topbar__mark">
              <StarMark size={28} />
            </span>
          </Link>
          <nav className="ic-nav" aria-label="Main">
            <a href={links.capabilities}>Capabilities</a>
            <button
              type="button"
              className="ic-nav__apps"
              aria-expanded={open}
              aria-controls="ic-apps"
              onMouseEnter={show}
              onMouseLeave={hide}
              onFocus={show}
              onClick={() => setOpen((v) => !v)}
            >
              Sectors <Chevron dir="down" size={10} />
            </button>
            <a href={links.about}>About us</a>
            <a href={links.partners}>Partners</a>
            <a href={links.careers}>Careers</a>
          </nav>
          <a href={links.contact} className="ic-contact ic-mono">
            <span className="ic-contact__icon">
              <Chevrons size={13} />
            </span>
            Contact us
          </a>
          <button
            type="button"
            className="ic-burger"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
              {menu ? (
                <path d="M3 0l10 10M13 0 3 10" stroke="currentColor" strokeWidth="1.4" />
              ) : (
                <path d="M0 2h16M0 8h16" stroke="currentColor" strokeWidth="1.4" />
              )}
            </svg>
          </button>
        </div>
      </header>

      <div
        id="ic-apps"
        className="ic-dropdown"
        data-open={open}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        <div className="ic-dropdown__inner">
          <div className="ic-dropdown__intro">
            <span className="ic-mono ic-label">Sectors</span>
            <p>Explore the defense and energy sectors we contract for</p>
          </div>
          <div className="ic-dropdown__cards">
            {sectors.map((m) => (
              <a
                key={m.key}
                href={m.href}
                className="ic-dropdown__card"
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.nav} alt="" loading="lazy" />
                <span>{m.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <nav className="ic-mobile-menu" data-open={menu} aria-label="Mobile">
        <a href={links.capabilities} onClick={closeMenu}>
          Capabilities
        </a>
        <a href={links.sectors} onClick={closeMenu}>
          Sectors
        </a>
        <a href={links.about} onClick={closeMenu}>
          About us
        </a>
        <a href={links.partners} onClick={closeMenu}>
          Partners
        </a>
        <a href={links.contact} onClick={closeMenu}>
          Contact us
        </a>
      </nav>
    </>
  );
}
