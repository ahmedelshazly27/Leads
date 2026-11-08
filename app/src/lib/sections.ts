export interface NavItem {
  id: string;
  label: string;
  needs?: "face" | "body" | "side";
}
export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    id: "introduction",
    label: "Introduction",
    items: [
      { id: "getting-started", label: "Getting Started" },
      { id: "about-you", label: "About You" },
      { id: "methodology", label: "Methodology & Sources" },
    ],
  },
  {
    id: "assessments",
    label: "Facial Assessments",
    items: [
      { id: "first-impression", label: "First Impression", needs: "face" },
      { id: "dimorphism", label: "Dimorphism", needs: "face" },
      { id: "averageness", label: "Averageness", needs: "face" },
      { id: "proportions", label: "Proportions", needs: "face" },
      { id: "symmetry", label: "Symmetry", needs: "face" },
      { id: "neoteny", label: "Neoteny", needs: "face" },
      { id: "face-shape", label: "Face Shape", needs: "face" },
      { id: "adiposity", label: "Adiposity", needs: "face" },
      { id: "contrast", label: "Facial Contrast", needs: "face" },
    ],
  },
  {
    id: "features",
    label: "Features Analysis",
    items: [
      { id: "eyebrows", label: "Eyebrow Analysis", needs: "face" },
      { id: "eyes", label: "Eye Analysis", needs: "face" },
      { id: "nose", label: "Nose Analysis", needs: "face" },
      { id: "lips", label: "Lips Analysis", needs: "face" },
      { id: "cheeks", label: "Cheek Analysis", needs: "face" },
      { id: "jaw", label: "Jaw Analysis", needs: "face" },
      { id: "chin", label: "Chin Analysis", needs: "face" },
      { id: "skin", label: "Skin Analysis", needs: "face" },
      { id: "features-summary", label: "Summary of Facial Analysis", needs: "face" },
    ],
  },
  {
    id: "body",
    label: "Body Analysis",
    items: [
      { id: "body-overview", label: "Body Overview", needs: "body" },
      { id: "physique-impression", label: "Physique Impression", needs: "body" },
      { id: "body-proportions", label: "Shoulders & V-Taper", needs: "body" },
      { id: "chest-arms", label: "Chest & Arms", needs: "body" },
      { id: "waist-core", label: "Waist & Core", needs: "body" },
      { id: "hips-legs", label: "Hips & Legs", needs: "body" },
      { id: "posture", label: "Front Posture", needs: "body" },
      { id: "side-posture", label: "Side Posture", needs: "side" },
      { id: "body-symmetry", label: "Body Symmetry", needs: "body" },
      { id: "composition", label: "Composition", needs: "body" },
      { id: "body-summary", label: "Summary of Body Analysis", needs: "body" },
    ],
  },
  {
    id: "protocol",
    label: "Protocol",
    items: [
      { id: "your-protocol", label: "Your Protocol" },
      { id: "recommendations", label: "Recommendations" },
      { id: "action-plan", label: "Action Plan" },
      { id: "estimations", label: "Estimations" },
      { id: "nutrition", label: "Nutrition Plan" },
      { id: "training", label: "Training Plan" },
      { id: "partners", label: "Book Partners" },
      { id: "progress", label: "Progress" },
      { id: "summary", label: "Summary" },
    ],
  },
];

export const ALL_ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.id })));
export const groupOf = (id: string) => ALL_ITEMS.find((i) => i.id === id)?.group;
