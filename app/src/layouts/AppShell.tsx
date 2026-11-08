import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Bag, Bars, ChevronDown, ChevronRight, FaceScan, Gear, LayoutGrid, PanelLeft, Scan } from "../components/icons";
import { NAV, groupOf } from "../lib/sections";
import { useActive } from "../lib/useActive";
import "./AppShell.css";

const RAIL = [
  { to: "/protocols", label: "Protocols", icon: LayoutGrid },
  { to: "/biometrics", label: "Biometrics", icon: Bars },
  { to: "/visualization", label: "Visualization", icon: Scan },
  { to: "/analysis", label: "Your Analysis", icon: FaceScan },
  { to: "/stack", label: "Stack", icon: Bag, soon: true },
  { to: "/settings", label: "Settings", icon: Gear },
];

export function AppShell() {
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const inAnalysis = loc.pathname.startsWith("/analysis");
  return (
    <div className={`shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="rail">
        <div className="rail-head">
          <NavLink to="/protocols" className="rail-logo"><Logo /></NavLink>
          <button className="rail-toggle" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
            <PanelLeft size={16} />
          </button>
        </div>
        <nav className="rail-nav">
          {RAIL.map(({ to, label, icon: Icon, soon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `rail-item ${isActive ? "active" : ""}`}>
              <span className="rail-icon"><Icon size={16} /></span>
              <span className="rail-label">{label}</span>
              {soon && <span className="rail-soon">Coming Soon</span>}
            </NavLink>
          ))}
        </nav>
        <ProfileSwitch />
      </aside>
      {inAnalysis && <SectionNav />}
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}

function SectionNav() {
  const loc = useLocation();
  const current = loc.pathname.split("/")[2] ?? "getting-started";
  const g = groupOf(current);
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ [g ?? "introduction"]: true }));
  const { scan } = useActive();
  return (
    <aside className="secnav">
      <div className="secnav-card">
        {NAV.map((group) => {
          const isOpen = open[group.id] ?? false;
          return (
            <div key={group.id} className={`secnav-group ${isOpen ? "open" : ""}`}>
              <button className="secnav-head" onClick={() => setOpen((o) => ({ ...o, [group.id]: !isOpen }))}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>{group.label}</span>
              </button>
              {isOpen && (
                <div className="secnav-items">
                  {group.items.map((item) => {
                    const missing = item.needs && !(item.needs === "face" ? scan?.face : scan?.body);
                    return (
                      <NavLink
                        key={item.id}
                        to={`/analysis/${item.id}`}
                        className={({ isActive }) => `secnav-item ${isActive ? "active" : ""} ${missing ? "missing" : ""}`}
                      >
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function ProfileSwitch() {
  const { profile, profiles, select } = useActive();
  const nav = useNavigate();
  if (!profile) return null;
  return (
    <div className="rail-profile">
      <select
        value={profile.id}
        onChange={(e) => {
          if (e.target.value === "__new") nav("/new");
          else select(e.target.value);
        }}
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>{p.intake.name}</option>
        ))}
        <option value="__new">+ New analysis…</option>
      </select>
      <div className="rail-profile-name">{profile.intake.name}</div>
      <div className="rail-profile-sub">{profile.sample ? "Sample data" : `${profile.intake.age} · ${profile.intake.gender}`}</div>
    </div>
  );
}
