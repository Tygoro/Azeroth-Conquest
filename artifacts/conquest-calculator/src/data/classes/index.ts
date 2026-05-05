// Single source of truth for all valid Conquest of Azeroth classes.
// The backend API must contain exactly these classes.
// The frontend uses this to validate API responses and drive the dropdown fallback.

export const CLASSES = [
  "Necromancer",
  "Pyromancer",
  "Cultist",
  "Starcaller",
  "Sun Cleric",
  "Tinker",
  "Runemaster",
  "Primalist",
  "Chronomancer",
  "Reaper",
  "Guardian",
  "Monk",
  "Demon Hunter",
  "Stormbringer",
  "Witch Hunter",
  "Knight of Xoroth",
  "Barbarian",
  "Ranger",
  "Son of Arugal",
  "Witch Doctor",
  "Disciple of Shadra",
] as const;

export type ClassName = (typeof CLASSES)[number];

// Canonical ID mapping — must match backend classId values
export const CLASS_IDS: Record<ClassName, string> = {
  Necromancer: "necromancer",
  Pyromancer: "pyromancer",
  Cultist: "cultist",
  Starcaller: "starcaller",
  "Sun Cleric": "suncleric",
  Tinker: "tinker",
  Runemaster: "runemaster",
  Primalist: "primalist",
  Chronomancer: "chronomancer",
  Reaper: "reaper",
  Guardian: "guardian",
  Monk: "monk",
  "Demon Hunter": "demonhunter",
  Stormbringer: "stormbringer",
  "Witch Hunter": "witchhunter",
  "Knight of Xoroth": "knightofxoroth",
  Barbarian: "barbarian",
  Ranger: "ranger",
  "Son of Arugal": "sonofarugal",
  "Witch Doctor": "witchdoctor",
  "Disciple of Shadra": "discipleofshadra",
};

export const VALID_CLASS_IDS = new Set(Object.values(CLASS_IDS));

// Class display colors — mirrors backend
export const CLASS_COLORS: Record<string, string> = {
  necromancer: "#2D9B6E",
  pyromancer: "#FF4500",
  cultist: "#9B4DCA",
  starcaller: "#4169E1",
  suncleric: "#FFD700",
  tinker: "#B8860B",
  runemaster: "#DC143C",
  primalist: "#228B22",
  chronomancer: "#00CED1",
  reaper: "#708090",
  guardian: "#4682B4",
  monk: "#00CC7A",
  demonhunter: "#A330C9",
  stormbringer: "#1E90FF",
  witchhunter: "#C8A96E",
  knightofxoroth: "#8B0000",
  barbarian: "#CD5C5C",
  ranger: "#6B8E23",
  sonofarugal: "#9400D3",
  witchdoctor: "#20B2AA",
  discipleofshadra: "#DAA520",
};
