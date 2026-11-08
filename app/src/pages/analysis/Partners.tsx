import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GradeBadge, PageHeader } from "../../components/ui";
import { buildNutrition } from "../../lib/nutrition";
import { CATEGORY_LABEL, CLINICAL, PARTNERS, type City, type Partner, type PartnerCategory } from "../../lib/partners";
import { useAppState } from "../../lib/store";
import type { SectionProps } from "./types";
import { BookingSheet } from "./BookingSheet";
import "./Nutrition.css";
import "./Partners.css";

const CITIES: (City | "All")[] = ["All", "Dubai", "Abu Dhabi", "Riyadh", "Jeddah"];
const CATS = Object.keys(CATEGORY_LABEL) as PartnerCategory[];

export function Partners(p: SectionProps) {
  const [params, setParams] = useSearchParams();
  const cat = (params.get("cat") as PartnerCategory | null) ?? null;
  const [city, setCity] = useState<City | "All">("All");
  const [booking, setBooking] = useState<Partner | null>(null);
  const state = useAppState();
  const nutrition = useMemo(() => buildNutrition(p.scan, p.profile.intake, p.plan), [p.scan, p.profile, p.plan]);

  const recommended = p.plan.items.filter((i) => i.partner);
  const list = PARTNERS.filter((x) => (!cat || x.category === cat) && (city === "All" || x.city === city));
  const mine = (state.bookings ?? []).filter((b) => b.profileId === p.profile.id).slice().reverse();
  const setCat = (c: PartnerCategory | null) => {
    const next = new URLSearchParams(params);
    if (c) next.set("cat", c);
    else next.delete("cat");
    setParams(next, { replace: true });
  };

  return (
    <div className="page pt">
      <PageHeader
        kicker="Partners"
        muted="Book"
        strong="vetted partners"
        lead={
          <>
            Turn plan steps into appointments. Every request is <b>reviewed by our team</b>, who confirm with the partner. You choose exactly what's shared — never your photos.
          </>
        }
      />

      {recommended.length > 0 && (
        <section className="pt-rec">
          <div className="mono-sm">Recommended from your plan</div>
          <div className="pt-rec-row">
            {recommended.map((it) => (
              <button key={it.id} className={`pt-rec-card ${cat === it.partner ? "on" : ""}`} onClick={() => setCat(it.partner!)}>
                <span className="mono-sm">{CATEGORY_LABEL[it.partner!]}</span>
                <b>{it.title}</b>
                <span className="pt-rec-meta">
                  <GradeBadge grade={it.grade} /> {PARTNERS.filter((x) => x.category === it.partner).length} partners
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="pt-filters">
        <div className="pt-chips">
          <button className={`pt-chip ${!cat ? "on" : ""}`} onClick={() => setCat(null)}>
            All
          </button>
          {CATS.map((c) => (
            <button key={c} className={`pt-chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <select className="pt-city" value={city} onChange={(e) => setCity(e.target.value as City | "All")} aria-label="City">
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c === "All" ? "All cities" : c}
            </option>
          ))}
        </select>
      </div>

      {cat && CLINICAL.includes(cat) && (
        <p className="bk-safety pt-safety">Non-surgical treatments are assessed by the clinic's licensed practitioner. We don't prescribe injectables — you book a consultation, and the practitioner decides what's appropriate.</p>
      )}

      <div className="pt-grid">
        {list.map((x) => (
          <article key={x.id} className="pt-card">
            <div className="pt-card-top">
              <span className="mono-sm">
                {CATEGORY_LABEL[x.category]} · {x.city}
              </span>
              <span className="demo-badge">Demo</span>
            </div>
            <div className="pt-name">{x.name}</div>
            <p className="pt-blurb">{x.blurb}</p>
            {x.licence && <div className="pt-licence">{x.licence}</div>}
            <ul className="pt-services">
              {x.services.map((s) => (
                <li key={s.id}>
                  <span>{s.name}</span>
                  <span className="pt-price">
                    from {s.currency} {s.priceFrom}
                  </span>
                </li>
              ))}
            </ul>
            <button className="btn pt-cta" onClick={() => setBooking(x)}>
              Request booking
            </button>
          </article>
        ))}
        {!list.length && <p className="lead">No partners for this filter yet.</p>}
      </div>

      <section className="pt-mine">
        <div className="mono-sm">Your requests</div>
        {!mine.length && <p className="pt-empty">No requests yet.</p>}
        {mine.map((b) => {
          const partner = PARTNERS.find((x) => x.id === b.partnerId);
          const svc = partner?.services.find((s) => s.id === b.serviceId);
          return (
            <div key={b.id} className="pt-req">
              <div>
                <b>{partner?.name ?? b.partnerId}</b>
                <div className="pt-req-meta">
                  {svc?.name} · {b.preferredDate} ({b.preferredTime})
                </div>
              </div>
              <span className={`pt-status s-${b.status}`}>{b.status}</span>
            </div>
          );
        })}
      </section>

      {booking && (
        <BookingSheet partner={booking} profile={p.profile} plan={p.plan} nutrition={nutrition} presetMacros={booking.category === "nutrition"} onClose={() => setBooking(null)} />
      )}
    </div>
  );
}
