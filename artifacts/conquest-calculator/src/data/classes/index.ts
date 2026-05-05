// Single source of truth for all valid Conquest of Azeroth classes.
// The backend API must contain exactly these classes.
// The frontend uses this to validate API responses and drive the dropdown fallback.

export const CLASSES = [
  "Sun Cleric",
  "Necromancer",
  "Pyromancer",
  "Cultist",
  "Starcaller",
  "Tinker",
  "Runemaster",
  "Primalist",
  "Reaper",
  "Venomancer",
  "Chronomancer",
  "Bloodmage",
  "Guardian",
  "Stormbringer",
  "Felsworn",
  "Barbarian",
  "Witch Doctor",
  "Witch Hunter",
  "Knight of Xoroth",
  "Ranger",
  "Templar",
] as const;

export type ClassName = (typeof CLASSES)[number];

// Canonical ID mapping — must match backend classId values
export const CLASS_IDS: Record<ClassName, string> = {
  "Sun Cleric": "suncleric",
  Necromancer: "necromancer",
  Pyromancer: "pyromancer",
  Cultist: "cultist",
  Starcaller: "starcaller",
  Tinker: "tinker",
  Runemaster: "runemaster",
  Primalist: "primalist",
  Reaper: "reaper",
  Venomancer: "venomancer",
  Chronomancer: "chronomancer",
  Bloodmage: "bloodmage",
  Guardian: "guardian",
  Stormbringer: "stormbringer",
  Felsworn: "felsworn",
  Barbarian: "barbarian",
  "Witch Doctor": "witchdoctor",
  "Witch Hunter": "witchhunter",
  "Knight of Xoroth": "knightofxoroth",
  Ranger: "ranger",
  Templar: "templar",
};

export const VALID_CLASS_IDS = new Set(Object.values(CLASS_IDS));

// Class display colors — mirrors backend
export const CLASS_COLORS: Record<string, string> = {
  suncleric: "#FFD700",
  necromancer: "#2D9B6E",
  pyromancer: "#FF4500",
  cultist: "#9B4DCA",
  starcaller: "#4169E1",
  tinker: "#B8860B",
  runemaster: "#DC143C",
  primalist: "#228B22",
  reaper: "#708090",
  venomancer: "#9C27B0",
  chronomancer: "#00CED1",
  bloodmage: "#B0234A",
  guardian: "#4682B4",
  stormbringer: "#1E90FF",
  felsworn: "#2CB04C",
  barbarian: "#CD5C5C",
  witchdoctor: "#20B2AA",
  witchhunter: "#C8A96E",
  knightofxoroth: "#8B0000",
  ranger: "#6B8E23",
  templar: "#E0D080",
};
