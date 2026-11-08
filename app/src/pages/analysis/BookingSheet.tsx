import { useMemo, useState } from "react";
import { CATEGORY_LABEL, CLINICAL, SHAREABLE, type Partner } from "../../lib/partners";
import { addBooking } from "../../lib/store";
import type { Plan } from "../../lib/plan";
import type { Profile } from "../../lib/types";
import type { NutritionResult } from "../../lib/nutrition";

/** Booking request sheet. Nothing is sent to the partner directly — the team confirms first. */
export function BookingSheet({
  partner,
  profile,
  plan,
  nutrition,
  presetMacros,
  onClose,
}: {
  partner: Partner;
  profile: Profile;
  plan: Plan;
  nutrition: NutritionResult | null;
  presetMacros?: boolean;
  onClose: () => void;
}) {
  const can = SHAREABLE[partner.category];
  const clinicalItems = plan.items.filter((i) => i.category === "Skin" || i.clinical || i.category === "Body composition");
  const [serviceId, setServiceId] = useState(partner.services[0].id);
  const [date, setDate] = useState(() => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  const [time, setTime] = useState<"morning" | "afternoon" | "evening">("afternoon");
  const [notes, setNotes] = useState("");
  const [contact, setContact] = useState(true);
  const [macros, setMacros] = useState(!!presetMacros && !!can.macros);
  const [training, setTraining] = useState(false);
  const [allergies, setAllergies] = useState(false);
  const [sections, setSections] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const phase = nutrition && nutrition.ok ? nutrition.phases[0] : null;
  const lifting = plan.items.find((i) => i.id === "lifting");
  const summary = useMemo(() => {
    const out: string[] = [];
    if (contact) out.push(`Your name (${profile.intake.name}) and contact details`);
    if (macros && phase) out.push(`Daily targets: ${phase.macros.kcal} kcal · P ${phase.macros.protein} g · F ${phase.macros.fat} g · C ${phase.macros.carbs} g (${phase.name}, months ${phase.fromMonth}–${phase.toMonth})`);
    if (allergies) out.push(`Allergies: ${profile.intake.allergies || "none reported"}`);
    if (training && lifting) out.push(`Training plan: ${lifting.title}`);
    for (const id of sections) {
      const it = plan.items.find((i) => i.id === id);
      if (it) out.push(`Plan section: ${it.title}`);
    }
    out.push("Never shared: your photos, scores or the rest of your report");
    return out;
  }, [contact, macros, allergies, training, sections, phase, lifting, profile, plan]);

  const submit = () => {
    addBooking({
      profileId: profile.id,
      partnerId: partner.id,
      serviceId,
      preferredDate: date,
      preferredTime: time,
      notes,
      shared: { contact, macros, training, allergies, planSection: sections, photos: false },
      payload: {
        ...(macros && phase ? { nutrition: { phase: phase.name, months: [phase.fromMonth, phase.toMonth], macros: phase.macros } } : {}),
        ...(allergies ? { allergies: profile.intake.allergies } : {}),
        ...(training && lifting ? { training: { title: lifting.title, how: lifting.how } } : {}),
        ...(sections.length ? { planSections: sections.map((id) => plan.items.find((i) => i.id === id)?.title) } : {}),
      },
    });
    setDone(true);
  };

  return (
    <div className="bk-scrim" onClick={onClose}>
      <div className="bk-sheet" role="dialog" aria-label={`Request booking with ${partner.name}`} onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="bk-done">
            <div className="title-md">Request sent</div>
            <p className="lead">
              Your request goes to our team, who confirm availability with {partner.name} — usually within 24 h. You'll see the status under “Your requests”.
            </p>
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="bk-head">
              <div>
                <span className="mono-sm">{CATEGORY_LABEL[partner.category]} · {partner.city}</span>
                <div className="title-md">{partner.name}</div>
              </div>
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
            </div>
            {CLINICAL.includes(partner.category) && (
              <p className="bk-safety">Non-surgical treatments are assessed by the clinic's licensed practitioner. We don't prescribe injectables — you're booking a consultation.</p>
            )}
            <label className="bk-field">
              <span className="mono-sm">Service</span>
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {partner.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — from {s.currency} {s.priceFrom} · {s.duration}
                  </option>
                ))}
              </select>
            </label>
            <div className="bk-row">
              <label className="bk-field">
                <span className="mono-sm">Preferred date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="bk-field">
                <span className="mono-sm">Time</span>
                <select value={time} onChange={(e) => setTime(e.target.value as typeof time)}>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </select>
              </label>
            </div>
            <label className="bk-field">
              <span className="mono-sm">Notes (optional)</span>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the partner should know" />
            </label>

            <div className="bk-consent">
              <span className="mono-sm">What you share</span>
              <Check on={contact} set={setContact} label="Name and contact details (needed to book)" />
              {can.macros && <Check on={macros} set={setMacros} label={phase ? "My calorie & macro targets and current phase" : "Macro targets (add height & weight first)"} disabled={!phase} />}
              {can.allergies && <Check on={allergies} set={setAllergies} label="My allergies" />}
              {can.training && <Check on={training} set={setTraining} label="My training split" disabled={!lifting} />}
              {can.planSection &&
                clinicalItems.map((it) => (
                  <Check
                    key={it.id}
                    on={sections.includes(it.id)}
                    set={(v) => setSections((s) => (v ? [...s, it.id] : s.filter((x) => x !== it.id)))}
                    label={`Plan section: ${it.title}`}
                  />
                ))}
              <div className="bk-never">Photos are never shared automatically.</div>
            </div>

            <div className="bk-summary">
              <span className="mono-sm">This request will contain</span>
              <ul>
                {summary.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <button className="btn bk-submit" onClick={submit} disabled={!contact}>
              Send request
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Check({ on, set, label, disabled }: { on: boolean; set: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={`bk-check ${disabled ? "dis" : ""}`}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => set(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
