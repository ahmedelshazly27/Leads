import { latestScan, scansFor, setActiveProfile, useAppState, photoUrl } from "./store";

/** The active profile, its scans and the latest scan + photos. */
export function useActive() {
  const s = useAppState();
  const profile = s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0] ?? null;
  const scans = profile ? scansFor(s, profile.id) : [];
  const scan = profile ? latestScan(s, profile.id) ?? null : null;
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
