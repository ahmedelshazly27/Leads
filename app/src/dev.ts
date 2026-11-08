import { addScan, createProfile, getState } from "./lib/store";
import { runScan } from "./lib/pipeline";
import { sampleProfile } from "./lib/sample";

/** Dev-only helper: window.__seed(faceUrl, bodyUrl?, name?) runs a real scan. */
export function installDevHooks() {
  (window as unknown as Record<string, unknown>).__seed = async (face: string | null, body: string | null, name = "Test Profile") => {
    const toData = async (u: string | null) => {
      if (!u) return null;
      const b = await (await fetch(u)).blob();
      return new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(b); });
    };
    const f = await toData(face);
    const bd = await toData(body);
    const p = createProfile({ ...sampleProfile.intake, name });
    const scan = await runScan(p.id, p.intake, f, bd, () => {});
    await addScan(scan, f, bd);
    return getState().scans.length;
  };
}
