import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import { PageHeader, Toggle } from "../components/ui";
import { Download } from "../components/icons";
import { exportAll, importAll, resetAll, setCurrency, setUnits, useAppState } from "../lib/store";
import "./pages.css";

export function Settings() {
  const s = useAppState();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
            <Link to="/requests" className="btn btn-ghost">Booking requests (admin)</Link>
            <Link to="/" className="btn btn-ghost">About &amp; pricing</Link>
          </div>
        }
      />
      <div className="bt-card" style={{ padding: "4px 22px" }}>
        <div className="st-row">
          <div>
            <div className="title-md">Units</div>
            <p className="lead">Used for height, weight and tape measurements.</p>
          </div>
          <Toggle
            value={s.settings.units}
            onChange={setUnits}
            options={[
              { value: "metric", label: "Metric" },
              { value: "imperial", label: "Imperial" },
            ]}
          />
        </div>
        <div className="st-row">
          <div>
            <div className="title-md">Currency</div>
            <p className="lead">Used for plan cost estimates (approximate retail prices).</p>
          </div>
          <Toggle
            value={s.settings.currency}
            onChange={setCurrency}
            options={[
              { value: "EUR", label: "EUR" },
              { value: "USD", label: "USD" },
              { value: "GBP", label: "GBP" },
            ]}
          />
        </div>
      </div>

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
        <p className="lead" style={{ maxWidth: "none", marginBottom: 12 }}>
          All analysis runs on this device. Profiles, scans and photos are stored only in this browser (IndexedDB) and are never uploaded. Photos only leave the device if you choose to use an external
          image generator for the before/after visuals. Results are estimates for tracking change, not medical advice.
        </p>
      </div>
    </div>
  );
}
