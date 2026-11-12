import { useState } from "react";
import type { Art } from "../lib/library";
import { Citations, GradeBadge, PageHeader } from "../components/ui";
import { FeatureArt } from "../components/FeatureArt";
import { BASIS_LABEL, LIBRARY, REGIONS, categoriesFor, matchFor, typeCount, type Ctx, type FeatureCategory, type Region, NO_PHOTO } from "../lib/library";
import { useActive } from "../lib/useActive";
import "./library.css";

/**
 * Feature library: every type the platform names — hair textures, eye shapes,
 * brows, noses, lips, jaws, skin and body types — with how we decide which one
 * you are and the research behind it.
 */
export function Library() {
  const { profile, scan } = useActive();
  const [region, setRegion] = useState<Region | "all">("all");
  const gender = profile?.intake.gender ?? "male";
  const cats = profile ? categoriesFor(gender) : LIBRARY;
  const ctx: Ctx | null = profile ? { face: scan?.face, body: scan?.body?.metrics, side: scan?.bodySide?.metrics, intake: profile.intake } : null;
  const shown = cats.filter((c) => region === "all" || c.region === region);
  const regions = REGIONS.filter((r) => cats.some((c) => c.region === r.id));

  const mine = ctx
    ? cats
        .map((c) => ({ c, m: matchFor(c, ctx, scan?.featureTypes) }))
        .filter((x) => x.m)
        .map(({ c, m }) => ({ c, name: m!.typeId ? c.types.find((t) => t.id === m!.typeId)?.name : `${m!.family![0].toUpperCase()}${m!.family!.slice(1)} family` }))
        .filter((x) => x.name)
    : [];

  return (
    <div className="page lib">
      <PageHeader
        kicker="Feature library"
        muted="Every type,"
        strong="explained."
        lead={`${typeCount} types across ${LIBRARY.length} features. Each says what it is, how we decide which one you are, and the research behind it. Types describe a face; none is better than another. Photos show AI-generated synthetic people, not real ones.`}
      />

      {mine.length > 0 && (
        <section className="lib-mine" aria-label="Your types">
          <div className="mono-sm">Your types{profile ? ` · ${profile.intake.name}` : ""}</div>
          <div className="lib-mine-list">
            {mine.map(({ c, name }) => (
              <a key={c.id} href={`#${c.id}`} className="lib-mine-chip" onClick={() => setRegion("all")}>
                <span>{c.title}</span>
                <b>{name}</b>
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="lib-regions" role="tablist" aria-label="Region">
        {[{ id: "all" as const, label: "All" }, ...regions].map((r) => (
          <button key={r.id} role="tab" aria-selected={region === r.id} className={`lib-region ${region === r.id ? "on" : ""}`} onClick={() => setRegion(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      {shown.map((c) => (
        <Category key={c.id} cat={c} ctx={ctx} overrides={scan?.featureTypes} />
      ))}
    </div>
  );
}

function Category({ cat, ctx, overrides }: { cat: FeatureCategory; ctx: Ctx | null; overrides?: Record<string, string> }) {
  const m = ctx ? matchFor(cat, ctx, overrides) : null;
  const pending = ctx && !m && cat.basis === "reviewer";
  return (
    <section className="lib-cat" id={cat.id}>
      <header className="lib-cat-head">
        <div>
          <div className="mono-sm">{REGIONS.find((r) => r.id === cat.region)?.label}</div>
          <h2 className="title-md">{cat.title}</h2>
        </div>
        <div className="lib-badges">
          <span className={`lib-basis lib-b-${cat.basis}`}>{BASIS_LABEL[cat.basis]}</span>
          <GradeBadge grade={cat.grade} />
        </div>
      </header>

      <div className="lib-facts">
        <div>
          <span className="mono-sm">What it is</span>
          <p>{cat.what}</p>
        </div>
        <div>
          <span className="mono-sm">Why it matters</span>
          <p>{cat.why}</p>
        </div>
        <div>
          <span className="mono-sm">How we decide</span>
          <p>{cat.how}</p>
        </div>
      </div>

      {ctx && (
        <p className="lib-you-line">
          {m ? (
            <>
              <b>You:</b> {m.typeId ? cat.types.find((t) => t.id === m.typeId)?.name : `${m.family} family — your reviewer confirms the exact pattern`}
              {m.value ? ` · ${m.value}` : ""} · <span className="lib-by">{m.by === "reviewer" ? "confirmed by your reviewer" : BASIS_LABEL[m.by].toLowerCase()}</span>
            </>
          ) : pending ? (
            <>Your reviewer sets this from your photos.</>
          ) : (
            <>Add the photo or answer this needs to see your type.</>
          )}
        </p>
      )}

      <div className="lib-types">
        {cat.types.map((t) => {
          const on = !!m && (m.typeId === t.id || (!!m.family && !m.typeId && t.family === m.family));
          return (
            <article key={t.id} className={`lib-type ${on ? "on" : ""}`}>
              <TypeVisual catId={cat.id} typeId={t.id} name={t.name} art={t.art} on={on} />
              {on && <span className="lib-you">{m?.family && !m.typeId ? "Your family" : "You"}</span>}
              <h3>{t.name}</h3>
              {t.aka && <div className="lib-aka">{t.aka}</div>}
              <p>{t.definition}</p>
              {t.criteria && <div className="lib-crit">{t.criteria}</div>}
            </article>
          );
        })}
      </div>

      <p className="lib-change">
        <span className="mono-sm">What can change</span> {cat.change}
      </p>
      {cat.note && <p className="lib-note">{cat.note}</p>}
      <details className="lib-refs">
        <summary>Sources ({cat.refs.length})</summary>
        <Citations ids={cat.refs} />
      </details>
    </section>
  );
}

/** Categories shown as measured diagrams rather than photos. */
const DIAGRAM_ONLY = new Set(["thirds", "eye-spacing"]);
const PORTRAIT = new Set(["face-shape", "frame-male", "frame-female", "posture"]);

/** Realistic photo of the type (synthetic person), with its exact diagram inset. */
function TypeVisual({ catId, typeId, name, art, on }: { catId: string; typeId: string; name: string; art: Art; on: boolean }) {
  const [failed, setFailed] = useState(false);
  if (DIAGRAM_ONLY.has(catId) || NO_PHOTO.has(catId) || failed)
    return (
      <div className="lib-art">
        <FeatureArt art={art} active={on} />
      </div>
    );
  return (
    <div className={`lib-art lib-photo ${PORTRAIT.has(catId) ? "tall" : ""}`}>
      <img src={`/library/${catId}/${typeId}.jpg`} alt={`${name} — AI-generated synthetic example`} loading="lazy" onError={() => setFailed(true)} />
      <span className="lib-inset" aria-hidden>
        <FeatureArt art={art} active />
      </span>
    </div>
  );
}
