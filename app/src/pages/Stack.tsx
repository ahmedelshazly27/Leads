import { useNavigate } from "react-router-dom";
import { Bag, Doc, LayoutGrid } from "../components/icons";
import { Kicker } from "../components/ui";
import "./pages.css";

export function Stack() {
  const nav = useNavigate();
  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <Kicker>Stack</Kicker>
      </div>
      <div className="sk-hero">
        <span className="sk-badge">Coming soon</span>
        <h1 className="title-xl">
          Your <span style={{ opacity: 0.7 }}>stack</span>
        </h1>
        <p>A curated set of products matched to your plan — every one tied to the evidence behind the recommendation, not to sponsorship.</p>
      </div>
      <div className="sk-grid">
        <div className="sk-card">
          <span className="icon-wrap">
            <Doc size={20} />
          </span>
          <div className="title-md" style={{ fontSize: 17 }}>
            <span className="hl">Evidence</span> first
          </div>
          <p>Each product maps to a plan item and its evidence grade — e.g. adapalene 0.1% for acne (grade A), niacinamide 5% for redness (grade B).</p>
        </div>
        <div className="sk-card">
          <span className="icon-wrap">
            <Bag size={20} />
          </span>
          <div className="title-md" style={{ fontSize: 17 }}>
            <span className="hl">Matched to</span> your skin
          </div>
          <p>Filtered by your skin type, allergies, budget and preferences, with active-ingredient concentrations that match the studies.</p>
        </div>
        <div className="sk-card">
          <span className="icon-wrap">
            <LayoutGrid size={20} />
          </span>
          <div className="title-md" style={{ fontSize: 17 }}>
            <span className="hl">Routine</span> builder
          </div>
          <p>Morning and evening order of use, conflicts flagged (e.g. retinoids with strong acids), and refill reminders tied to your action plan.</p>
        </div>
      </div>
      <div style={{ marginTop: 22 }}>
        <button className="btn btn-ghost" onClick={() => nav("/analysis/recommendations")}>
          See your recommendations
        </button>
      </div>
    </div>
  );
}
