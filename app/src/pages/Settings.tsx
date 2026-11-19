import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import { PageHeader, Toggle } from "../components/ui";
import { Download } from "../components/icons";
import { exportAll, importAll, resetAll, setStaff, useAppState } from "../lib/store";
import { backendEnabled } from "../lib/backend";
import { useLang } from "../lib/i18n";
import { legalHref } from "./legal/content";
import "./pages.css";

/** Staff mode is offered only in development or with ?staff=1 in the URL, until a server role replaces it. */
function staffSwitchAllowed() {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).get("staff") === "1";
  } catch {
    return false;
  }
}

export function Settings() {
  const s = useAppState();
  // keep the switch visible while staff mode is on, so it can always be turned off
  const showStaff = staffSwitchAllowed() || !!s.settings.staff;
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const lang = useLang();

  const doExport = async () => {
    const json = await exportAll();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = `facet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Backup downloaded.");
  };

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <PageHeader
        kicker="Settings"
        muted="Your"
        strong="settings"
        lead="Display preferences and your data."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/" className="btn btn-ghost">About &amp; pricing</Link>
          </div>
        }
      />

      {backendEnabled && (
        <div className="bt-card" style={{ padding: "4px 22px" }}>
          <div className="st-row">
            <div>
              <div className="title-md">Your account</div>
              <p className="lead">Orders, membership, and your data online: download it, withdraw photo consent or delete your account.</p>
            </div>
            <div className="st-actions">
              <Link to="/account" className="btn">
                Open account
              </Link>
            </div>
          </div>
        </div>
      )}

      {showStaff && (
      <div className="bt-card" style={{ padding: "4px 22px" }}>
        <div className="st-row">
          <div>
            <div className="title-md">Staff mode</div>
            <p className="lead">Shows the review console on this device. For the founder's own device only — real staff access arrives with accounts.</p>
          </div>
          <Toggle
            value={s.settings.staff ? "on" : "off"}
            onChange={(v) => setStaff(v === "on")}
            options={[
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
            ]}
          />
        </div>
      </div>
      )}

      <div className="bt-card" style={{ padding: "4px 22px" }}>
        <div className="st-row">
          <div>
            <div className="title-md">Export data</div>
            <p className="lead">Download every profile, scan, photo and plan progress as one JSON file.</p>
          </div>
          <div className="st-actions">
            <button className="btn btn-ghost" onClick={doExport}>
              <Download size={15} /> Export
            </button>
          </div>
        </div>
        <div className="st-row">
          <div>
            <div className="title-md">Import data</div>
            <p className="lead">Restore from a backup file. This replaces everything currently stored.</p>
          </div>
          <div className="st-actions">
            <input
              ref={file}
              type="file"
              accept="application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  await importAll(await f.text());
                  setMsg("Backup restored.");
                } catch (err) {
                  setMsg(`Import failed: ${(err as Error).message}`);
                }
                e.target.value = "";
              }}
            />
            <button className="btn btn-ghost" onClick={() => file.current?.click()}>
              Import
            </button>
          </div>
        </div>
        <div className="st-row">
          <div>
            <div className="title-md">Reset all data</div>
            <p className="lead">Deletes every profile, scan and photo from this browser and restores the sample profile.</p>
          </div>
          <div className="st-actions">
            <button
              className="btn btn-ghost st-danger"
              onClick={async () => {
                if (confirm("Delete all profiles, scans and photos from this browser? This cannot be undone.")) {
                  await resetAll();
                  setMsg("All data deleted.");
                }
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
      {msg && (
        <p className="lead" role="status" style={{ marginBottom: 14 }}>
          {msg}
        </p>
      )}

      <div className="bt-card">
        <h2 className="title-md">Privacy</h2>
        {backendEnabled ? (
          <p className="lead" style={{ maxWidth: "none", marginBottom: 12 }}>
            Analysis runs on this device, and profiles, scans and photos on this page are stored only in this browser. When you order a reviewed report, your photos are uploaded
            encrypted to our servers in the EU, only after you agree, and deleted 90 days after delivery. Results are estimates for tracking change, not medical advice.
          </p>
        ) : (
        <p className="lead" style={{ maxWidth: "none", marginBottom: 12 }}>
          Analysis runs on this device. In this preview, profiles, scans and photos are stored only in this browser (IndexedDB). Specialist review and the before/after visuals need your photos: when
          accounts launch, submitting a scan uploads it securely to the review team only, after you agree. Results are estimates for tracking change, not medical advice.
        </p>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 14 }}>
          <Link to={legalHref("privacy", lang)} className="btn btn-ghost">
            Privacy policy
          </Link>
          <Link to={legalHref("terms", lang)} className="btn btn-ghost">
            Terms
          </Link>
          <Link to={legalHref("refunds", lang)} className="btn btn-ghost">
            Refund policy
          </Link>
        </div>
      </div>
    </div>
  );
}
