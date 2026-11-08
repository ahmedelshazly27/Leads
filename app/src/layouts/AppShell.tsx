import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Bag, Bars, ChevronDown, ChevronRight, FaceScan, Gear, LayoutGrid, ListIcon, PanelLeft, Scan, User } from "../components/icons";
import { ALL_ITEMS, NAV, groupOf } from "../lib/sections";
import { useActive } from "../lib/useActive";
import "./AppShell.css";

const RAIL = [
  { to: "/protocols", label: "Protocols", icon: LayoutGrid },
  { to: "/biometrics", label: "Biometrics", icon: Bars },
  { to: "/visualization", label: "Visualization", icon: Scan },
  { to: "/analysis", label: "Your Analysis", icon: FaceScan },
  { to: "/plans", label: "Plans", icon: Bag },
  { to: "/stack", label: "Stack", icon: Bag, soon: true },
  { to: "/settings", label: "Settings", icon: Gear },
];

const TABS = [
  { to: "/protocols", label: "Protocols", icon: LayoutGrid },
  { to: "/analysis", label: "Analysis", icon: FaceScan },
  { to: "/visualization", label: "Visuals", icon: Scan },
  { to: "/biometrics", label: "Data", icon: Bars },
  { to: "/settings", label: "Settings", icon: Gear },
];

function titleFor(path: string) {
  if (path.startsWith("/analysis/")) {
    const id = path.split("/")[2];
    return ALL_ITEMS.find((i) => i.id === id)?.label ?? "Your Analysis";
  }
  const map: Record<string, string> = {
    "/protocols": "Protocols",
    "/new": "New analysis",
    "/biometrics": "Biometrics",
    "/visualization": "Visualization",
    "/settings": "Settings",
    "/stack": "Stack",
  };
  const key = Object.keys(map).find((k) => path === k || path.startsWith(k + "/"));
  return key ? map[key] : "Facet";
}

export function AppShell() {
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const inAnalysis = loc.pathname.startsWith("/analysis");
  const { profile, facePhoto } = useActive();
  useEffect(() => {
    setDrawer(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className={`shell ${collapsed ? "is-collapsed" : ""} ${inAnalysis ? "has-secnav" : ""}`}>
      <header className="mbar">
        {inAnalysis ? (
          <button className="mbar-btn" onClick={() => setDrawer(true)} aria-label="Open sections">
            <ListIcon size={18} />
            <span className="mbar-btn-label">Sections</span>
          </button>
        ) : (
          <NavLink to="/protocols" className="mbar-logo" aria-label="Home"><Logo /></NavLink>
        )}
        <div className="mbar-title">{titleFor(loc.pathname)}</div>
        <NavLink to={inAnalysis ? "/analysis/about-you" : "/protocols"} className="mbar-avatar" aria-label={profile?.intake.name ?? "Profile"}>
          {facePhoto ? <img src={facePhoto} alt="" /> : <User size={16} />}
        </NavLink>
      </header>
      {inAnalysis && (
        <div className={`drawer ${drawer ? "open" : ""}`} aria-hidden={!drawer}>
          <div className="drawer-scrim" onClick={() => setDrawer(false)} />
          <div className="drawer-panel" role="dialog" aria-label="Sections">
            <div className="drawer-head">
              <span className="title-md">Sections</span>
              <button className="mbar-btn" onClick={() => setDrawer(false)} aria-label="Close">✕</button>
            </div>
            <SectionNav inDrawer />
          </div>
        </div>
      )}
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
      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>
            <span className="tab-icon"><Icon size={18} /></span>
            <span className="tab-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function SectionNav({ inDrawer = false }: { inDrawer?: boolean }) {
  const loc = useLocation();
  const current = loc.pathname.split("/")[2] ?? "getting-started";
  const g = groupOf(current);
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ [g ?? "introduction"]: true }));
  const { scan } = useActive();
  return (
    <aside className={inDrawer ? "secnav secnav-drawer" : "secnav"}>
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
                    const missing = item.needs && !(item.needs === "face" ? scan?.face : item.needs === "side" ? scan?.bodySide : scan?.body);
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
