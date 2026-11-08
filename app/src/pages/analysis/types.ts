import type { Plan } from "../../lib/plan";
import type { Profile, Scan, Visuals } from "../../lib/types";

/** Props every analysis section receives. */
export interface SectionProps {
  profile: Profile;
  scan: Scan;
  scans: Scan[]; // all scans for this profile, oldest first (for progress)
  facePhoto: string | null;
  bodyPhoto: string | null;
  sidePhoto: string | null;
  visuals: Visuals;
  plan: Plan;
}
