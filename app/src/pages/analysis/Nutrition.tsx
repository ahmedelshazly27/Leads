import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Citations, Empty, PageHeader } from "../../components/ui";
import { buildNutrition, type Macros } from "../../lib/nutrition";
import { PARTNERS } from "../../lib/partners";
import type { SectionProps } from "./types";
import { BookingSheet } from "./BookingSheet";
import "./Nutrition.css";

export function Nutrition(p: SectionProps) {
  const n = useMemo(() => buildNutrition(p.scan, p.profile.intake, p.plan), [p.scan, p.profile, p.plan]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [pick, setPick] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  if (!n.ok)
    return (
      <div className="page">
        <PageHeader kicker="Nutrition" muted="Your" strong="nutrition plan" />
        <Empty title={`Add your ${n.missing.join(" and ")}`}>
          Calorie and macro targets are calculated from your height and weight. <Link to="/analysis/about-you">Update About You →</Link>
        </Empty>
      </div>
    );

  const ph = n.phases[phaseIdx];
  const nutritionPartners = PARTNERS.filter((x) => x.category === "nutrition");
  const partner = nutritionPartners.find((x) => x.id === partnerId) ?? null;

  return (
    <div className="page nu">
      <PageHeader
        kicker="Nutrition"
        muted="Your"
        strong="nutrition plan"
        lead={
          <>
            Calorie and macro targets derived from your plan's <b>goal and timeline</b>, using validated energy equations and protein research.
          </>
        }
      />

      <div className="nu-stats">
        <Stat label="Weight" value={`${n.weight} kg`} />
        <Stat label="Body fat (est.)" value={n.bodyFat != null ? `${n.bodyFat.toFixed(0)}%` : "—"} />
        <Stat label="Resting energy (BMR)" value={`${Math.round(n.bmr)} kcal`} note="Mifflin–St Jeor" />
        <Stat label="Daily energy (TDEE)" value={`${Math.round(n.tdee)} kcal`} note={`× ${n.activityFactor} activity`} />
      </div>

      <section className="nu-card">
        <div className="mono-sm">12-month timeline</div>
        <div className="nu-timeline">
          {n.phases.map((x, i) => (
            <button
              key={x.id}
              className={`nu-phase ${i === phaseIdx ? "on" : ""} nu-${x.id}`}
              style={{ flex: Math.max(1, x.toMonth - x.fromMonth) }}
              onClick={() => setPhaseIdx(i)}
            >
              <span className="nu-phase-name">{x.name}</span>
              <span className="nu-phase-meta">
                Months {x.fromMonth}–{x.toMonth} · {x.startWeight.toFixed(1)} → {x.endWeight.toFixed(1)} kg
              </span>
            </button>
          ))}
        </div>
        <div className="nu-scale mono-sm">
          <span>Month 0</span>
          <span>Month 12</span>
        </div>
      </section>

      <div className="nu-grid">
        <section className="nu-card nu-kcal">
          <div className="mono-sm">{ph.name} · daily target</div>
          <div className="nu-big">
            {ph.macros.kcal}
            <span>kcal / day</span>
          </div>
          <MacroBar m={ph.macros} />
          <div className="nu-macros">
            <MacroCard name="Protein" g={ph.macros.protein} kcal={ph.macros.protein * 4} total={ph.macros.kcal} note={`${(ph.macros.protein / ph.startWeight).toFixed(1)} g/kg`} tone="p" />
            <MacroCard name="Fat" g={ph.macros.fat} kcal={ph.macros.fat * 9} total={ph.macros.kcal} tone="f" />
            <MacroCard name="Carbs" g={ph.macros.carbs} kcal={ph.macros.carbs * 4} total={ph.macros.kcal} tone="c" />
          </div>
          <div className="nu-extra">
            <span>Fibre ≥ {ph.macros.fibre} g</span>
            <span>Water ≈ {ph.macros.waterL} L</span>
            <span>
              Expected {ph.weeklyChangeKg < 0 ? "loss" : "change"}: {ph.weeklyChangeKg < 0 ? "" : "+"}
              {Math.abs(ph.weeklyChangeKg).toFixed(2)} kg/week
            </span>
          </div>
          <p className="nu-why">{ph.rationale}</p>
        </section>

        <section className="nu-card">
          <div className="mono-sm">Sample day</div>
          <div className="nu-meals">
            {ph.meals.map((m) => (
              <div key={m.name} className="nu-meal">
                <div className="nu-meal-head">
                  <b>{m.name}</b>
                  <span>{m.macros.kcal} kcal</span>
                </div>
                <div className="nu-meal-macros mono-sm">
                  P {m.macros.protein} g · F {m.macros.fat} g · C {m.macros.carbs} g
                </div>
                <div className="nu-meal-ex">{m.examples.join(" · ")}</div>
              </div>
            ))}
          </div>
          <p className="nu-note">Dates, rice and bread fit — portion them to the carb target. Prioritise protein at every meal.</p>
        </section>
      </div>

      <section className="nu-cta">
        <div>
          <div className="title-md">
            <span className="hl">Don't want to cook?</span> Send these targets to a meal service.
          </div>
          <p className="lead">Partner kitchens and dietitians receive only your calorie & macro targets, phase and allergies — never photos. Our team confirms the booking.</p>
        </div>
        <button className="btn" onClick={() => setPick(true)}>
          Choose a meal partner
        </button>
      </section>

      <section className="nu-card nu-evidence">
        <div className="mono-sm">How these numbers are set</div>
        <ul>
          {n.notes.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <Citations ids={n.refs} />
      </section>

      {pick && !partner && (
        <div className="bk-scrim" onClick={() => setPick(false)}>
          <div className="bk-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bk-head">
              <div className="title-md">Meal plans & dietitians</div>
              <button className="btn btn-ghost" onClick={() => setPick(false)}>Close</button>
            </div>
            {nutritionPartners.map((x) => (
              <button key={x.id} className="nu-pick" onClick={() => setPartnerId(x.id)}>
                <b>{x.name}</b>
                <span>
                  {x.city} · from {x.services[0].currency} {Math.min(...x.services.map((s) => s.priceFrom))}
                </span>
                <span className="demo-badge">Demo partner</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {partner && (
        <BookingSheet
          partner={partner}
          profile={p.profile}
          plan={p.plan}
          nutrition={n}
          presetMacros
          onClose={() => {
            setPartnerId(null);
            setPick(false);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="nu-stat">
      <span className="mono-sm">{label}</span>
      <b>{value}</b>
      {note && <span className="nu-stat-note">{note}</span>}
    </div>
  );
}

function MacroBar({ m }: { m: Macros }) {
  const p = (m.protein * 4) / m.kcal, f = (m.fat * 9) / m.kcal, c = (m.carbs * 4) / m.kcal;
  return (
    <div className="nu-bar">
      <i className="t-p" style={{ flex: p }} />
      <i className="t-f" style={{ flex: f }} />
      <i className="t-c" style={{ flex: c }} />
    </div>
  );
}

function MacroCard({ name, g, kcal, total, note, tone }: { name: string; g: number; kcal: number; total: number; note?: string; tone: "p" | "f" | "c" }) {
  return (
    <div className="nu-macro">
      <span className="mono-sm">
        <i className={`nu-dot t-${tone}`} /> {name}
      </span>
      <b>{g} g</b>
      <span className="nu-stat-note">
        {Math.round((kcal / total) * 100)}% of kcal{note ? ` · ${note}` : ""}
      </span>
    </div>
  );
}
