import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Toggle } from "../components/ui";
import "./Plans.css";

type Cur = "EUR" | "AED" | "SAR";

const PRICE: Record<string, Record<Cur, string>> = {
  free: { EUR: "Free", AED: "Free", SAR: "Free" },
  report: { EUR: "€49", AED: "AED 199", SAR: "SAR 199" },
  premium: { EUR: "€99", AED: "AED 399", SAR: "SAR 399" },
  monthly: { EUR: "€12", AED: "AED 49", SAR: "SAR 49" },
  yearly: { EUR: "€99", AED: "AED 399", SAR: "SAR 399" },
};

const TIERS = [
  {
    id: "free",
    name: "Free scan",
    tag: "Try it",
    sub: "",
    features: ["On-device face & body scan", "Headline scores", "Photo-quality check"],
    missing: ["Glow-up plan", "Studio before / after", "Expert review"],
  },
  {
    id: "report",
    name: "Glow-Up Report",
    tag: "One-off",
    sub: "",
    highlight: true,
    features: [
      "Full face + body analysis (40+ measurements)",
      "Evidence-graded 12-month plan",
      "Studio before & 12-month after — face and body, front and side",
      "Reviewed by our expert before delivery",
      "Downloadable protocol PDF",
      "30 days of progress tracking",
    ],
    missing: [],
  },
  {
    id: "premium",
    name: "Glow-Up Premium",
    tag: "One-off",
    sub: "",
    features: [
      "Everything in Report",
      "3 hairstyle & beard previews, 3 angles each",
      "20-minute video consult",
      "Delivered within 24 h",
      "3 months of Progress membership included",
    ],
    missing: [],
  },
];

export function Plans() {
  const [cur, setCur] = useState<Cur>("AED");
  const [yearly, setYearly] = useState(true);
  return (
    <div className="page plans">
      <PageHeader
        kicker="Plans"
        muted="Choose your"
        strong="glow-up"
        lead={<>One honest analysis, a plan backed by published research, and visuals reviewed by a human before you see them. Prices include VAT.</>}
        right={
          <Toggle
            value={cur}
            options={[
              { value: "AED", label: "AED" },
              { value: "SAR", label: "SAR" },
              { value: "EUR", label: "EUR" },
            ]}
            onChange={setCur}
          />
        }
      />

      <div className="plans-grid">
        {TIERS.map((t) => (
          <div key={t.id} className={`plan ${t.highlight ? "plan-hl" : ""}`}>
            <div className="plan-top">
              <span className="mono-sm">{t.tag}</span>
              {t.highlight && <span className="plan-badge">Most popular</span>}
            </div>
            <div className="plan-name">{t.name}</div>
            <div className="plan-price">{PRICE[t.id][cur]}</div>
            <ul className="plan-list">
              {t.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
              {t.missing.map((f) => (
                <li key={f} className="off">{f}</li>
              ))}
            </ul>
            <Link to="/new" className={`btn ${t.highlight ? "" : "btn-ghost"} plan-cta`}>
              {t.id === "free" ? "Start free scan" : "Get started"}
            </Link>
          </div>
        ))}
      </div>

      <section className="member">
        <div className="member-text">
          <span className="mono-sm">Progress membership</span>
          <h2 className="title-lg">
            <span className="hl">Track the change,</span> month by month.
          </h2>
          <ul className="plan-list">
            <li>Monthly check-in scans in the same studio set-up, with progress charts</li>
            <li>Your plan adjusted every month, reviewed by our expert</li>
            <li>A refreshed "after" visual every quarter</li>
            <li>Habit reminders for your action plan</li>
            <li>Partner discounts: InBody scans, meal plans, personal trainers</li>
          </ul>
        </div>
        <div className="member-price">
          <Toggle
            value={yearly ? "y" : "m"}
            options={[
              { value: "m", label: "Monthly" },
              { value: "y", label: "Yearly" },
            ]}
            onChange={(v) => setYearly(v === "y")}
          />
          <div className="plan-price">
            {yearly ? PRICE.yearly[cur] : PRICE.monthly[cur]}
            <span>/{yearly ? "year" : "month"}</span>
          </div>
          <div className="mono-sm">{yearly ? "≈ 3 months free" : "Cancel anytime"} · requires a Report</div>
          <Link to="/new" className="btn plan-cta">Join membership</Link>
        </div>
      </section>

      <p className="plans-note">
        Your photos are analysed on your device. Photos you send for your report are encrypted, seen only by your reviewer,
        never used for advertising or AI training, and deleted 90 days after delivery (members: while your membership is active).
        You can delete everything at any time.
      </p>
    </div>
  );
}
