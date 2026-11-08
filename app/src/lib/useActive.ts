import { useMemo } from "react";
import { scansFor, setActiveProfile, useAppState, photoUrl } from "./store";
import { refreshBody } from "./bodyAnalysis";
import type { Scan } from "./types";

/** The active profile, its scans and the latest scan + photos. */
export function useActive() {
  const s = useAppState();
  const profile = s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0] ?? null;
  const rawScans = profile ? scansFor(s, profile.id) : [];
  // re-derive intake-dependent body metrics so edits to "About you" apply immediately
  const scans = useMemo(
    () => rawScans.map((x): Scan => (x.body && profile ? { ...x, body: refreshBody(x.body, profile.intake) } : x)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.scans, profile],
  );
  const scan = scans.length ? scans[scans.length - 1] : null;
  return {
    state: s,
    profile,
    profiles: s.profiles,
    scans,
    scan,
    facePhoto: scan ? photoUrl(scan.id, "face") : null,
    bodyPhoto: scan ? photoUrl(scan.id, "body") : null,
    progress: profile ? s.progress[profile.id] ?? {} : {},
    select: setActiveProfile,
  };
}
