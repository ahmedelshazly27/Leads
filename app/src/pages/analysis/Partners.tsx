import { useState } from "react";
import { GradeBadge, PageHeader } from "../../components/ui";
import { CATEGORY_LABEL, type PartnerCategory } from "../../lib/partners";
import type { SectionProps } from "./types";
import "./Partners.css";

/** What each partner type would receive from the plan — always with the client's consent, never photos. */
const SHARES: Record<PartnerCategory, string> = {
  nutrition: "Calorie and macro targets, plan phase, allergies",
  dermatology: "Skin findings (regions and coverage), current routine, your questions",
  trainer: "Training split, priority muscles, limitations",
  bodycomp: "Nothing — results come back to update your body-fat baseline",
  barber: "Chosen cut and beard, barber instructions, after image (if you opt in)",
  aesthetic: "Your consult questions only; treatment decisions stay with the clinician",
};

const STEPS = [
  { t: "Request from your plan", d: "Each partner step in your plan gets a request button. You choose exactly what's shared." },
  { t: "Checked by our team", d: "A specialist confirms the request fits your plan, then books with the partner." },
  { t: "Results flow back", d: "InBody scans, dermatologist notes and coach check-ins update your progress and plan." },
];

const NOTIFY_KEY = "partners-notify";

export function Partners(p: SectionProps) {
  const [notify, setNotify] = useState(() => {
    try {
      return localStorage.getItem(NOTIFY_KEY) === "1";
    } catch {
      return false;
    }
  });
  const recommended = p.plan.items.filter((i) => i.partner);
  const toggle = () => {
    const next = !notify;
    setNotify(next);
    try {
      localStorage.setItem(NOTIFY_KEY, next ? "1" : "0");
    } catch {
      /* storage blocked */
    }
  };

  return (
    <div className="page pt">
      <PageHeader
        kicker="Care network · coming soon"
        muted="Partners"
        strong="coming soon"
        lead="We're onboarding vetted dermatologists, dietitians and meal services, InBody centres, coaches and barbers in Dubai, Abu Dhabi, Riyadh and Jeddah. Until then, every step in your plan works on its own."
      />

      {recommended.length > 0 && (
        <section className="pt-rec">
          <div className="mono-sm">Where your plan will connect</div>
          <div className="pt-soon-grid">
            {recommended.map((it) => (
              <div key={it.id} className="pt-soon-card">
                <div className="pt-soon-top">
                  <span className="mono-sm">{CATEGORY_LABEL[it.partner!]}</span>
                  <span className="pt-soon-badge">Coming soon</span>
                </div>
                <b>{it.title}</b>
                <span className="pt-soon-share">
                  <i>Would receive:</i> {SHARES[it.partner!] ?? "Only what you choose to share"}
                </span>
                <GradeBadge grade={it.grade} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="pt-how">
        <div className="mono-sm">How it will work</div>
        <ol className="pt-steps">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <span className="pt-step-n">{i + 1}</span>
              <div>
                <b>{s.t}</b>
                <p>{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="pt-privacy">Photos are never shared with partners. Clinical treatments (e.g. injectables) are consult-only: the clinician decides, not the plan.</p>
      </section>

      <section className="pt-notify">
        <div>
          <b>Get notified when partners launch in your city</b>
          <p>{p.profile.intake.location ? `We'll prioritise ${p.profile.intake.location}.` : "Add your city in About You so we can prioritise it."}</p>
        </div>
        <button className={`btn ${notify ? "btn-ghost" : ""}`} onClick={toggle} aria-pressed={notify}>
          {notify ? "✓ You'll be notified" : "Notify me"}
        </button>
      </section>
    </div>
  );
}
