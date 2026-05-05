import type { TalentTree, ClassMeta, ClassDetail, SpecMeta, TalentNode } from "@workspace/api-zod";

// ─── 30-NODE DEEP TREE LAYOUT (8 TIERS, BRANCHY, DRAGONFLIGHT-STYLE) ────────
// Tier 0 (y=40):  3 root nodes      cols 1, 2, 3
// Tier 1 (y=110): 4 nodes           cols 0.5, 1.5, 2.5, 3.5
// Tier 2 (y=180): 5 nodes (wide)    cols 0, 1, 2, 3, 4         — gate: 3pt
// Tier 3 (y=250): 5 nodes (cluster) cols 0, 1, 2, 3, 4         — gate: 8pt
// Tier 4 (y=320): 5 nodes (cluster) cols 0, 1, 2, 3, 4         — gate: 14pt  ← densest middle
// Tier 5 (y=390): 4 nodes           cols 0.5, 1.5, 2.5, 3.5    — gate: 20pt
// Tier 6 (y=460): 3 nodes           cols 1, 2, 3               — gate: 28pt
// Tier 7 (y=540): 1 capstone        col 2                      — gate: 35pt
// Tighter spacing (78px col / explicit row Y) for denser feel.
const COL_X = (col: number): number => 48 + col * 78;
const POS = (col: number, y: number) => ({ x: COL_X(col), y });

const NODE_POSITIONS = [
  // Tier 0 — 3 roots
  POS(1, 40),   POS(2, 40),   POS(3, 40),
  // Tier 1 — 4 nodes
  POS(0.5, 110), POS(1.5, 110), POS(2.5, 110), POS(3.5, 110),
  // Tier 2 — 5 nodes
  POS(0, 180),  POS(1, 180),  POS(2, 180),  POS(3, 180),  POS(4, 180),
  // Tier 3 — 5 nodes (cluster)
  POS(0, 250),  POS(1, 250),  POS(2, 250),  POS(3, 250),  POS(4, 250),
  // Tier 4 — 5 nodes (cluster, choice tier)
  POS(0, 320),  POS(1, 320),  POS(2, 320),  POS(3, 320),  POS(4, 320),
  // Tier 5 — 4 nodes
  POS(0.5, 390), POS(1.5, 390), POS(2.5, 390), POS(3.5, 390),
  // Tier 6 — 3 nodes
  POS(1, 460),  POS(2, 460),  POS(3, 460),
  // Tier 7 — capstone
  POS(2, 540),
] as const;

// Prereq DAG. Each node has 1–3 prereqs from the tier above. Multi-prereq
// nodes are satisfied by ANY prereq being maxed (OR logic — Dragonflight
// branching). Mid-tree clusters (T3, T4) feature 3-prereq nodes for the
// dense branching/reconnect feel.
const NODE_PREREQS: number[][] = [
  [], [], [],                                                    // T0  (0,1,2)
  [0],     [0, 1],     [1, 2],     [2],                          // T1  (3,4,5,6)
  [3],     [3, 4],     [4, 5],     [5, 6],     [6],              // T2  (7,8,9,10,11)
  [7, 8],  [7, 8, 9],  [8, 9, 10], [9, 10, 11], [10, 11],        // T3  (12,13,14,15,16)
  [12],    [12, 13, 14], [13, 14, 15], [14, 15, 16], [16],       // T4  (17,18,19,20,21)
  [17, 18], [18, 19],  [19, 20],   [20, 21],                     // T5  (22,23,24,25)
  [22, 23], [23, 24],  [24, 25],                                 // T6  (26,27,28)
  [26, 27, 28],                                                  // T7 capstone (29) — needs ANY of the 3
];

// Visual node type per index — varied so each tier feels different
const NODE_TYPES: Array<TalentNode["type"]> = [
  // T0
  "active",  "active",  "active",
  // T1
  "passive", "active",  "active",  "passive",
  // T2
  "passive", "active",  "active",  "active",  "passive",
  // T3 — cluster, lots of mixing
  "active",  "passive", "choice",  "passive", "active",
  // T4 — choice/active heavy
  "choice",  "active",  "choice",  "active",  "choice",
  // T5
  "passive", "active",  "active",  "passive",
  // T6
  "active",  "active",  "active",
  // T7
  "capstone",
];

// Max points per node — choices are always 1pt, capstone 1pt, rest mostly 2pt
const NODE_MAX_POINTS: number[] = [
  // T0
  1, 1, 1,
  // T1
  2, 2, 2, 2,
  // T2
  2, 2, 2, 2, 2,
  // T3 (choice in mid is 1pt)
  2, 2, 1, 2, 2,
  // T4 (choices = 1pt)
  1, 2, 1, 2, 1,
  // T5
  2, 2, 2, 2,
  // T6
  2, 2, 2,
  // T7
  1,
];

type NodeDef = Omit<TalentNode, "currentPoints">;

function nodes(defs: NodeDef[]): TalentNode[] {
  return defs.map((d) => ({ ...d, currentPoints: 0 }));
}

// ─── DEEP TREE BUILDER ──────────────────────────────────────────────────────
// Generates a 22-node tree from a list of 22 talent name + description pairs
type TalentDef = { name: string; description: string };

function buildDeepTree(prefix: string, talents: TalentDef[]): TalentNode[] {
  if (talents.length !== 30) {
    throw new Error(`buildDeepTree: expected 30 talents for prefix "${prefix}", got ${talents.length}`);
  }
  return nodes(
    talents.map((t, i) => ({
      id: `${prefix}_${i + 1}`,
      name: t.name,
      description: t.description,
      maxPoints: NODE_MAX_POINTS[i],
      prerequisites: NODE_PREREQS[i].map((idx) => `${prefix}_${idx + 1}`),
      position: NODE_POSITIONS[i],
      type: NODE_TYPES[i],
    })),
  );
}

// ─── CLASS METAS ────────────────────────────────────────────────────────────
export const classMetas: ClassMeta[] = [
  { id: "necromancer", name: "Necromancer", description: "Master of death and the undead arts.", icon: "skull", color: "#2D9B6E" },
  { id: "pyromancer", name: "Pyromancer", description: "A living conduit of flame.", icon: "flame", color: "#FF4500" },
  { id: "cultist", name: "Cultist", description: "Devotee of forbidden powers.", icon: "eye", color: "#9B4DCA" },
  { id: "starcaller", name: "Starcaller", description: "Channels celestial fury.", icon: "star", color: "#4169E1" },
  { id: "suncleric", name: "Sun Cleric", description: "A devoted servant of An'she's holy light.", icon: "sun", color: "#FFD700" },
  { id: "tinker", name: "Tinker", description: "A mechanical genius of war.", icon: "wrench", color: "#B8860B" },
  { id: "runemaster", name: "Runemaster", description: "Carves runic sigils into reality.", icon: "rune", color: "#DC143C" },
  { id: "primalist", name: "Primalist", description: "A primal channeler of elemental forces.", icon: "earth", color: "#228B22" },
  { id: "chronomancer", name: "Chronomancer", description: "Time-bending arcanist.", icon: "clock", color: "#00CED1" },
  { id: "reaper", name: "Reaper", description: "A swift harvester of souls.", icon: "scythe", color: "#708090" },
  { id: "guardian", name: "Guardian", description: "Indomitable protector.", icon: "shield", color: "#4682B4" },
  { id: "monk", name: "Monk", description: "Disciplined martial artist.", icon: "fist", color: "#00CC7A" },
  { id: "demonhunter", name: "Demon Hunter", description: "Wields demonic essence as a weapon.", icon: "horn", color: "#A330C9" },
  { id: "stormbringer", name: "Stormbringer", description: "Tempest incarnate.", icon: "bolt", color: "#1E90FF" },
  { id: "witchhunter", name: "Witch Hunter", description: "Trained to destroy dark magic.", icon: "cross", color: "#C8A96E" },
  { id: "knightofxoroth", name: "Knight of Xoroth", description: "Sworn to the Lords of Xoroth.", icon: "sword", color: "#8B0000" },
  { id: "barbarian", name: "Barbarian", description: "Ferocious berserker.", icon: "axe", color: "#CD5C5C" },
  { id: "ranger", name: "Ranger", description: "Wilderness expert with bow and trap.", icon: "bow", color: "#6B8E23" },
  { id: "sonofarugal", name: "Son of Arugal", description: "Cursed worgen shapeshifter.", icon: "wolf", color: "#9400D3" },
  { id: "witchdoctor", name: "Witch Doctor", description: "Tribal hexer who summons spirits.", icon: "mask", color: "#20B2AA" },
  { id: "discipleofshadra", name: "Disciple of Shadra", description: "Servant of the spider goddess.", icon: "spider", color: "#DAA520" },
];

// ─── PROCEDURAL TALENT NAME GENERATOR ───────────────────────────────────────
// Each spec defines theme tokens. Talents are generated by combining tokens.
type SpecTheme = {
  signature: string[];  // 6 unique signature ability names (one per "key" slot)
  prefix: string[];     // adjective prefixes ("Improved", "Twin", "Burning")
  noun: string[];       // theme nouns ("Flame", "Light", "Frost")
  verb: string[];       // ability verbs ("Strike", "Burst", "Cleave")
  damageType: string;   // "Holy", "Shadow", "Frost", etc.
  capstoneName: string; // single capstone name
  capstoneDesc: string; // capstone description
};

function genTalent(theme: SpecTheme, idx: number, isLeft: boolean): TalentDef {
  // Slot 0,1,2 = roots (use signature names — first 3 for left, second 3 for right)
  // Slot 29 = capstone
  // Others = procedural
  if (idx === 29) {
    return { name: theme.capstoneName, description: theme.capstoneDesc };
  }
  if (idx < 3 && theme.signature.length >= 3) {
    const sigIdx = idx + (isLeft ? 0 : 3);
    const sig = theme.signature[sigIdx] ?? theme.signature[idx];
    return {
      name: sig,
      description: `A signature ${theme.damageType.toLowerCase()} ability of this path. Effectiveness +15% per point.`,
    };
  }

  const seed = idx * (isLeft ? 7 : 13) + (isLeft ? 0 : 31);
  const pre = theme.prefix[seed % theme.prefix.length];
  const noun = theme.noun[(seed * 3) % theme.noun.length];
  const verb = theme.verb[(seed * 5) % theme.verb.length];

  // Mix three styles of names so adjacent nodes don't all read the same
  const style = idx % 3;
  let name: string;
  if (style === 0) name = `${pre} ${noun}`;
  else if (style === 1) name = `${noun} ${verb}`;
  else name = `${pre} ${verb}`;

  // Description varies by node type
  const nodeType = NODE_TYPES[idx];
  let desc: string;
  if (nodeType === "passive") {
    desc = `Empowers your ${theme.damageType} abilities, increasing their potency. Bonus +5% per point.`;
  } else if (nodeType === "choice") {
    desc = `Choose to either deal extra ${theme.damageType} damage or reduce damage taken by allies near you.`;
  } else {
    desc = `Unleash a ${theme.damageType.toLowerCase()} ${verb.toLowerCase()} on your foes. Damage +10% per point.`;
  }
  return { name, description: desc };
}

function buildSpecTreeFromTheme(
  classId: string,
  specId: string,
  className: string,
  color: string,
  specName: string,
  leftTreeName: string,
  rightTreeName: string,
  leftTheme: SpecTheme,
  rightTheme: SpecTheme,
): TalentTree {
  const leftTalents: TalentDef[] = Array.from({ length: 30 }, (_, i) => genTalent(leftTheme, i, true));
  const rightTalents: TalentDef[] = Array.from({ length: 30 }, (_, i) => genTalent(rightTheme, i, false));

  return {
    class: className,
    classId,
    specId,
    specName,
    leftTreeName,
    rightTreeName,
    maxPoints: 61,
    color,
    leftTree: buildDeepTree(`${classId}_${specId}_l`, leftTalents),
    rightTree: buildDeepTree(`${classId}_${specId}_r`, rightTalents),
  };
}

// ─── PER-CLASS SPEC CONFIGURATIONS ──────────────────────────────────────────
type SpecConfig = {
  id: string;
  name: string;
  role: SpecMeta["role"];
  attribute: SpecMeta["attribute"];
  complexity: SpecMeta["complexity"];
  description: string;
  sampleSpells: string[];
  leftTreeName: string;
  rightTreeName: string;
  leftTheme: SpecTheme;
  rightTheme: SpecTheme;
};

// Themed spec templates per class
const CLASS_SPECS: Record<string, SpecConfig[]> = {
  // ─── SUN CLERIC ──────────────────────────────────────────────────────────
  // Hand-crafted from screenshots — has 4 specs as shown in CoA
  suncleric: [
    {
      id: "piety",
      name: "Piety",
      role: "damage",
      attribute: "intellect",
      complexity: "advanced",
      description: "Wield sanctified flame and holy wrath in tandem, searing corruption away and reducing enemies into purified ash.",
      sampleSpells: ["Solar Invocation", "Cleansing Pyre", "Radiant Wrath"],
      leftTreeName: "Path of Sun Cleric",
      rightTreeName: "Path of Piety",
      leftTheme: {
        signature: ["Solar Invocation: Resplendence", "Illumination", "An'she's Grace", "Sunfire Ward", "Radiant Focus", "Solar Flare"],
        prefix: ["Radiant", "Sanctified", "Burning", "Inner", "Searing", "Glorious"],
        noun: ["Light", "Flame", "Sunfire", "Radiance", "Halo", "Pyre"],
        verb: ["Strike", "Cleanse", "Ignite", "Smite", "Burst", "Rebuke"],
        damageType: "Holy",
        capstoneName: "Avatar of An'she",
        capstoneDesc: "Become an avatar of An'she for 20s. Your spells cost no mana, your critical strike chance increases by 30%, and your healing and damage are increased by 25%. 3 min cooldown.",
      },
      rightTheme: {
        signature: ["Cleansing Pyre", "Sun's Embrace", "Daybreak", "Searing Ray", "Solar Wind", "Pillar of Light"],
        prefix: ["Pure", "Cleansing", "Daybreak", "Sunlit", "Fervent", "Hallowed"],
        noun: ["Fire", "Wrath", "Beam", "Flare", "Warmth", "Crucible"],
        verb: ["Burn", "Purify", "Smite", "Surge", "Ignite", "Banish"],
        damageType: "Holy",
        capstoneName: "Eternal Conflagration",
        capstoneDesc: "Erupt with eternal solar flame for 20s, dealing massive Holy damage to all enemies near you and burning corruption from allies. 3 min cooldown.",
      },
    },
    {
      id: "valkyrie",
      name: "Valkyrie",
      role: "damage",
      attribute: "strength",
      complexity: "normal",
      description: "Become the Light's wrath made flesh, carving through foes with a greatblade in each hand as a storm of merciless holy steel.",
      sampleSpells: ["Glorious Execution", "Heavenly Charge", "Wings of Light"],
      leftTreeName: "Path of Sun Cleric",
      rightTreeName: "Path of Valkyrie",
      leftTheme: {
        signature: ["Solar Invocation: Resplendence", "Illumination", "An'she's Grace", "Sunfire Ward", "Radiant Focus", "Solar Flare"],
        prefix: ["Radiant", "Sanctified", "Burning", "Inner", "Searing", "Glorious"],
        noun: ["Light", "Flame", "Sunfire", "Radiance", "Halo", "Pyre"],
        verb: ["Strike", "Cleanse", "Ignite", "Smite", "Burst", "Rebuke"],
        damageType: "Holy",
        capstoneName: "Avatar of An'she",
        capstoneDesc: "Become an avatar of An'she for 20s. Your spells cost no mana, your critical strike chance increases by 30%, and your healing and damage are increased by 25%. 3 min cooldown.",
      },
      rightTheme: {
        signature: ["Glorious Execution", "Greatblade Mastery", "Heavenly Charge", "Wings of Light", "Radiant Cleave", "Holy Onslaught"],
        prefix: ["Heavenly", "Wrathful", "Soaring", "Brutal", "Crusading", "Final"],
        noun: ["Greatblade", "Wing", "Verdict", "Cadence", "Onslaught", "Aegis"],
        verb: ["Charge", "Cleave", "Slash", "Execute", "Smite", "Pronounce"],
        damageType: "Holy",
        capstoneName: "Aegis of Heaven",
        capstoneDesc: "Activate a barrier of pure light, absorbing damage equal to 30% of your max health for 10s, and your next 5 attacks deal Holy damage and heal you. 90 sec cooldown.",
      },
    },
    {
      id: "seraphim",
      name: "Seraphim",
      role: "tank",
      attribute: "stamina",
      complexity: "intermediate",
      description: "Swear a radiant oath to guard your allies — becoming a shield bearer that turns the wrath of the sun into impenetrable defense.",
      sampleSpells: ["Radiant Oath", "Sun Shield", "Holy Bastion"],
      leftTreeName: "Path of Sun Cleric",
      rightTreeName: "Path of Seraphim",
      leftTheme: {
        signature: ["Solar Invocation: Resplendence", "Illumination", "An'she's Grace", "Sunfire Ward", "Radiant Focus", "Solar Flare"],
        prefix: ["Radiant", "Sanctified", "Burning", "Inner", "Searing", "Glorious"],
        noun: ["Light", "Flame", "Sunfire", "Radiance", "Halo", "Pyre"],
        verb: ["Strike", "Cleanse", "Ignite", "Smite", "Burst", "Rebuke"],
        damageType: "Holy",
        capstoneName: "Avatar of An'she",
        capstoneDesc: "Become an avatar of An'she for 20s. Your spells cost no mana, your critical strike chance increases by 30%, and your healing and damage are increased by 25%. 3 min cooldown.",
      },
      rightTheme: {
        signature: ["Radiant Oath", "Sun Shield", "Aegis of Faith", "Holy Bastion", "Unwavering Resolve", "Pillar of Conviction"],
        prefix: ["Stalwart", "Unbreakable", "Hallowed", "Faithful", "Indomitable", "Sanctified"],
        noun: ["Bastion", "Aegis", "Bulwark", "Shield", "Pillar", "Vow"],
        verb: ["Guard", "Block", "Endure", "Withstand", "Repel", "Defend"],
        damageType: "Holy",
        capstoneName: "Avatar of Faith",
        capstoneDesc: "Become an unbreakable avatar of faith for 20s — damage taken is reduced by 50%, you cannot be stunned, and reflected damage scales with your missing health. 3 min cooldown.",
      },
    },
    {
      id: "blessings",
      name: "Blessings",
      role: "healer",
      attribute: "intellect",
      complexity: "intermediate",
      description: "Bathe your companions in radiant sunlight, mending grievous wounds and empowering them with steadfast hope and divine blessings.",
      sampleSpells: ["Sun's Mercy", "Blessing of Dawn", "Resurrection of An'she"],
      leftTreeName: "Path of Sun Cleric",
      rightTreeName: "Path of Blessings",
      leftTheme: {
        signature: ["Solar Invocation: Resplendence", "Illumination", "An'she's Grace", "Sunfire Ward", "Radiant Focus", "Solar Flare"],
        prefix: ["Radiant", "Sanctified", "Burning", "Inner", "Searing", "Glorious"],
        noun: ["Light", "Flame", "Sunfire", "Radiance", "Halo", "Pyre"],
        verb: ["Strike", "Cleanse", "Ignite", "Smite", "Burst", "Rebuke"],
        damageType: "Holy",
        capstoneName: "Avatar of An'she",
        capstoneDesc: "Become an avatar of An'she for 20s. Your spells cost no mana, your critical strike chance increases by 30%, and your healing and damage are increased by 25%. 3 min cooldown.",
      },
      rightTheme: {
        signature: ["Sun's Mercy", "Blessing of Dawn", "Mending Light", "Sanctuary", "Beacon of Hope", "Resurrection of An'she"],
        prefix: ["Blessed", "Tender", "Gentle", "Hallowed", "Reverent", "Boundless"],
        noun: ["Mercy", "Hope", "Sanctuary", "Beacon", "Salve", "Grace"],
        verb: ["Heal", "Mend", "Restore", "Bless", "Soothe", "Renew"],
        damageType: "Holy",
        capstoneName: "Resurrection of An'she",
        capstoneDesc: "Channel An'she's eternal light. All allies within 40 yards are fully healed, freed of all harmful effects, and gain immunity to fatal damage for 8s. 5 min cooldown.",
      },
    },
  ],
};

// ─── PROCEDURAL SPEC FACTORY FOR REMAINING CLASSES ──────────────────────────
// Generates 3 specs per class: Damage / Defense / Mastery, with class-themed naming
type ClassFlavor = {
  damageType: string;
  damageNoun: string[];   // theme nouns for damage spec
  damageVerb: string[];
  defenseNoun: string[];  // theme nouns for defense spec
  defenseVerb: string[];
  masteryNoun: string[];  // utility/mastery
  masteryVerb: string[];
  signaturesA: string[];  // 6 signature ability names — first spec
  signaturesB: string[];  // 6 signature ability names — second spec
  signaturesC: string[];  // 6 signature ability names — third spec
  capstoneA: string;
  capstoneB: string;
  capstoneC: string;
};

const CLASS_FLAVORS: Record<string, ClassFlavor> = {
  necromancer: {
    damageType: "Shadow",
    damageNoun: ["Bone", "Plague", "Death", "Soul", "Coffin", "Tomb"],
    damageVerb: ["Drain", "Strike", "Cast", "Hurl", "Decay", "Curse"],
    defenseNoun: ["Bone Wall", "Crypt", "Shroud", "Phylactery", "Pact", "Grave"],
    defenseVerb: ["Ward", "Shield", "Bind", "Anchor", "Resurrect", "Drain"],
    masteryNoun: ["Lich", "Skeleton", "Familiar", "Apparition", "Pet", "Minion"],
    masteryVerb: ["Raise", "Command", "Empower", "Summon", "Drain", "Channel"],
    signaturesA: ["Death Coil", "Bone Spear", "Plague Strike", "Corpse Explosion", "Wither", "Soul Harvest"],
    signaturesB: ["Bone Shield", "Dark Pact", "Frozen Tomb", "Vampiric Aura", "Death's Embrace", "Crypt Guard"],
    signaturesC: ["Raise Dead", "Skeletal Army", "Lich Form", "Death and Decay", "Army of the Dead", "Soul Reaper"],
    capstoneA: "Lich Form",
    capstoneB: "Bone Sovereign",
    capstoneC: "Army of the Dead",
  },
  pyromancer: {
    damageType: "Fire",
    damageNoun: ["Flame", "Ember", "Blaze", "Pyre", "Inferno", "Solar Fire"],
    damageVerb: ["Burn", "Ignite", "Hurl", "Erupt", "Scorch", "Conflagrate"],
    defenseNoun: ["Magma Shield", "Ember Aura", "Phoenix", "Cinder Ward", "Heat Aura", "Pyre"],
    defenseVerb: ["Ward", "Reflect", "Absorb", "Rebirth", "Endure", "Cinder"],
    masteryNoun: ["Phoenix", "Ember", "Combustion", "Flame Spirit", "Fire Elemental", "Solar Wisp"],
    masteryVerb: ["Empower", "Channel", "Bind", "Summon", "Awaken", "Ignite"],
    signaturesA: ["Fireball", "Pyroblast", "Combustion", "Flame Surge", "Lava Burst", "Searing Bolt"],
    signaturesB: ["Molten Armor", "Phoenix Rising", "Magma Shield", "Cinder Ward", "Heat Wave", "Conflagrate"],
    signaturesC: ["Inferno", "Meteor", "Solar Wrath", "Firestorm", "Burning Ember", "Dragon's Breath"],
    capstoneA: "Solar Wrath",
    capstoneB: "Phoenix Resurrection",
    capstoneC: "Meteor Storm",
  },
  cultist: {
    damageType: "Shadow",
    damageNoun: ["Whisper", "Madness", "Tendril", "Void", "Eldritch", "Maw"],
    damageVerb: ["Whisper", "Madden", "Crush", "Devour", "Curse", "Tear"],
    defenseNoun: ["Eldritch Ward", "Void Shroud", "Forbidden Pact", "Aura of Dread", "Madness", "Eye"],
    defenseVerb: ["Ward", "Shroud", "Bind", "Hex", "Drain", "Enthrall"],
    masteryNoun: ["Cultist", "Tendril", "Apparition", "Familiar", "Brood", "Disciple"],
    masteryVerb: ["Summon", "Bind", "Command", "Empower", "Sacrifice", "Hex"],
    signaturesA: ["Shadow Bolt", "Void Grasp", "Soul Drain", "Forbidden Knowledge", "Curse of Weakness", "Wrath of the Old Gods"],
    signaturesB: ["Eldritch Ward", "Aura of Dread", "Void Shroud", "Binding Chains", "Vile Tendrils", "Enthrall"],
    signaturesC: ["Dark Ritual", "Madness", "Hex", "Psychic Scream", "The Maw Opens", "Ascendance"],
    capstoneA: "Ascendance",
    capstoneB: "Eldritch Pact",
    capstoneC: "The Maw Opens",
  },
  starcaller: {
    damageType: "Arcane",
    damageNoun: ["Star", "Comet", "Moonbeam", "Astral", "Constellation", "Eclipse"],
    damageVerb: ["Strike", "Cast", "Hurl", "Channel", "Ignite", "Pierce"],
    defenseNoun: ["Astral Shield", "Moonlight", "Star Halo", "Eclipse Veil", "Stellar Aegis", "Veil"],
    defenseVerb: ["Ward", "Shroud", "Veil", "Reflect", "Absorb", "Bind"],
    masteryNoun: ["Starlight", "Moonlight", "Eclipse", "Constellation", "Wisp", "Owlbear"],
    masteryVerb: ["Empower", "Channel", "Awaken", "Summon", "Align", "Bless"],
    signaturesA: ["Starfall", "Lunar Strike", "Moonbeam", "Nova", "Comet Storm", "Astral Bolt"],
    signaturesB: ["Astral Form", "Stellar Ward", "Moonlight Veil", "Celestial Alignment", "Star Halo", "Constellation Guard"],
    signaturesC: ["Eclipse", "Solar Wrath", "Cosmic Rite", "Galactic Form", "Heavenly Tide", "Cosmic Bloom"],
    capstoneA: "Celestial Alignment",
    capstoneB: "Stellar Aegis",
    capstoneC: "Galactic Form",
  },
  tinker: {
    damageType: "Mechanical",
    damageNoun: ["Rocket", "Flamethrower", "Mortar", "Cannon", "Drone", "Gear"],
    damageVerb: ["Fire", "Launch", "Detonate", "Crank", "Bombard", "Rivet"],
    defenseNoun: ["Plate Armor", "Force Field", "Bulwark", "Power Suit", "Engineered", "Repair Kit"],
    defenseVerb: ["Engineer", "Reinforce", "Power", "Bolt", "Repair", "Plate"],
    masteryNoun: ["Drone", "Turret", "Robot", "Gadget", "Wrench", "Tool"],
    masteryVerb: ["Construct", "Deploy", "Activate", "Empower", "Tinker", "Build"],
    signaturesA: ["Rocket Launch", "Flame Cannon", "Mortar Volley", "Goblin Bomb", "Tinker's Gambit", "Hand Cannon"],
    signaturesB: ["Power Suit", "Force Bolt", "Repair Bot", "Plated Vanguard", "Auto-Riveter", "Defensive Subroutine"],
    signaturesC: ["Battle Drone", "Mechanical Squire", "Recombobulator", "Gadget Belt", "Mechanical Mastery", "Steam Surge"],
    capstoneA: "Mecha-Tank Form",
    capstoneB: "Engineered Salvation",
    capstoneC: "Iron Star",
  },
  runemaster: {
    damageType: "Rune",
    damageNoun: ["Rune", "Sigil", "Glyph", "Stone", "Etching", "Mark"],
    damageVerb: ["Carve", "Inscribe", "Burn", "Strike", "Etch", "Brand"],
    defenseNoun: ["Stone Skin", "Rune Shield", "Etched Aegis", "Earthbond", "Granite", "Bedrock"],
    defenseVerb: ["Inscribe", "Anchor", "Etch", "Reinforce", "Bind", "Stone"],
    masteryNoun: ["Rune", "Glyph", "Sigil", "Mark", "Etching", "Lore"],
    masteryVerb: ["Empower", "Channel", "Inscribe", "Awaken", "Activate", "Read"],
    signaturesA: ["Burning Rune", "Sigil of Wrath", "Etched Strike", "Stone Spear", "Rune Volley", "Mark of Ruin"],
    signaturesB: ["Stoneskin", "Earthbond", "Granite Aegis", "Sigil Wall", "Etched Aegis", "Anchor Rune"],
    signaturesC: ["Rune of Mastery", "Glyph of Power", "Sigil of Renewal", "Mark of Vigor", "Lore of the Elders", "Awakened Rune"],
    capstoneA: "Sigil of Annihilation",
    capstoneB: "Mountain Form",
    capstoneC: "Rune Ascendance",
  },
  primalist: {
    damageType: "Nature",
    damageNoun: ["Thorn", "Vine", "Storm", "Quake", "Tide", "Sap"],
    damageVerb: ["Strike", "Lash", "Erupt", "Surge", "Crush", "Tear"],
    defenseNoun: ["Bark", "Stone Skin", "Earthen Aegis", "Tideguard", "Iron Bark", "Wildcall"],
    defenseVerb: ["Bark", "Anchor", "Heal", "Ward", "Surge", "Renew"],
    masteryNoun: ["Spirit", "Wolf", "Bear", "Treant", "Wildcall", "Totem"],
    masteryVerb: ["Summon", "Awaken", "Bond", "Channel", "Empower", "Speak"],
    signaturesA: ["Thornlash", "Stoneblade", "Tidal Wave", "Quake", "Wind Slash", "Wildfire"],
    signaturesB: ["Iron Bark", "Earthen Aegis", "Tideguard", "Stone Skin", "Wildcall", "Verdant Pact"],
    signaturesC: ["Wolf Spirit", "Treant Form", "Spirit Walk", "Bestial Wrath", "Primal Awakening", "Bear Form"],
    capstoneA: "Avatar of Storm",
    capstoneB: "Living Mountain",
    capstoneC: "Primal Ascension",
  },
  chronomancer: {
    damageType: "Arcane",
    damageNoun: ["Hourglass", "Time", "Past", "Future", "Echo", "Stutter"],
    damageVerb: ["Rewind", "Echo", "Quicken", "Slow", "Halt", "Erase"],
    defenseNoun: ["Time Shield", "Echo Veil", "Stasis Field", "Chrono Ward", "Hourglass", "Past Self"],
    defenseVerb: ["Rewind", "Halt", "Stasis", "Echo", "Veil", "Anchor"],
    masteryNoun: ["Echo", "Past Self", "Future Self", "Chronoshard", "Hourglass", "Loop"],
    masteryVerb: ["Echo", "Loop", "Quicken", "Channel", "Anchor", "Rewind"],
    signaturesA: ["Time Bolt", "Hourglass Strike", "Echo Shot", "Stutter", "Chrono Spear", "Final Echo"],
    signaturesB: ["Stasis Field", "Time Shield", "Chrono Ward", "Echo Veil", "Past Self", "Hourglass"],
    signaturesC: ["Time Lord", "Loop", "Echo Form", "Quicken", "Final Hour", "Time Walker"],
    capstoneA: "Time Lord",
    capstoneB: "Eternal Stasis",
    capstoneC: "Recursion",
  },
  reaper: {
    damageType: "Shadow",
    damageNoun: ["Scythe", "Sickle", "Reap", "Soul", "Harvest", "Black Blade"],
    damageVerb: ["Reap", "Slash", "Harvest", "Cleave", "Sever", "Behead"],
    defenseNoun: ["Shroud", "Phantom Cloak", "Veil", "Soul Skin", "Wraith Form", "Phantom"],
    defenseVerb: ["Veil", "Shroud", "Phase", "Wraith", "Drain", "Phantom"],
    masteryNoun: ["Wraith", "Soul", "Phantom", "Shade", "Spectre", "Reaping"],
    masteryVerb: ["Reap", "Empower", "Channel", "Bind", "Harvest", "Awaken"],
    signaturesA: ["Soul Reap", "Death Slash", "Phantom Strike", "Reaper's Mark", "Black Sickle", "Sever"],
    signaturesB: ["Wraith Form", "Phantom Veil", "Soul Skin", "Shroud", "Phase Step", "Death Pact"],
    signaturesC: ["Soul Harvest", "Reap and Sow", "Death's Embrace", "Final Reaping", "Reaper's Call", "Specter"],
    capstoneA: "Reaper's Embrace",
    capstoneB: "Wraith Form",
    capstoneC: "Soul Harvest",
  },
  guardian: {
    damageType: "Holy",
    damageNoun: ["Hammer", "Shield Bash", "Smite", "Wrath", "Verdict", "Crusader"],
    damageVerb: ["Bash", "Smite", "Strike", "Hammer", "Cleave", "Pummel"],
    defenseNoun: ["Bulwark", "Aegis", "Shield Wall", "Bastion", "Sanctuary", "Iron Will"],
    defenseVerb: ["Guard", "Block", "Withstand", "Defend", "Protect", "Anchor"],
    masteryNoun: ["Aura", "Blessing", "Sanctuary", "Watch", "Vigil", "Standard"],
    masteryVerb: ["Bless", "Watch", "Protect", "Anchor", "Inspire", "Lead"],
    signaturesA: ["Holy Hammer", "Crusader Strike", "Divine Wrath", "Avenger's Verdict", "Glorious Bash", "Smite"],
    signaturesB: ["Shield Wall", "Bulwark", "Sanctuary", "Iron Will", "Bastion", "Last Stand"],
    signaturesC: ["Aura of Vigor", "Blessing of Light", "Holy Standard", "Vigilance", "Inspiration", "Watcher's Eye"],
    capstoneA: "Avenging Wrath",
    capstoneB: "Eternal Bulwark",
    capstoneC: "Beacon of Light",
  },
  monk: {
    damageType: "Physical",
    damageNoun: ["Fist", "Palm", "Roundhouse", "Strike", "Blow", "Chi"],
    damageVerb: ["Strike", "Punch", "Kick", "Tornado", "Sweep", "Sever"],
    defenseNoun: ["Stance", "Iron Body", "Bamboo Skin", "Calm Mind", "Steel Frame", "Zen"],
    defenseVerb: ["Stance", "Endure", "Reflect", "Anchor", "Calm", "Withstand"],
    masteryNoun: ["Chi", "Spirit", "Tiger", "Crane", "Serpent", "Ox"],
    masteryVerb: ["Channel", "Awaken", "Embrace", "Empower", "Focus", "Meditate"],
    signaturesA: ["Tiger Palm", "Rising Sun Kick", "Spinning Crane Kick", "Roundhouse", "Blackout Strike", "Chi Burst"],
    signaturesB: ["Iron Body", "Stagger", "Zen Meditation", "Diffuse Magic", "Bamboo Skin", "Calm Mind"],
    signaturesC: ["Way of the Tiger", "Way of the Crane", "Way of the Serpent", "Inner Peace", "Spirit Channeling", "Awakening"],
    capstoneA: "Storm, Earth, and Fire",
    capstoneB: "Touch of Death",
    capstoneC: "Inner Awakening",
  },
  demonhunter: {
    damageType: "Chaos",
    damageNoun: ["Glaive", "Fel Strike", "Demon's Bite", "Chaos Slash", "Fel Burst", "Eye Beam"],
    damageVerb: ["Slash", "Bite", "Tear", "Rend", "Burn", "Annihilate"],
    defenseNoun: ["Demon Skin", "Soul Cloak", "Fel Aegis", "Spectral Sight", "Chaos Veil", "Pit Pact"],
    defenseVerb: ["Skin", "Veil", "Phase", "Soul", "Anchor", "Endure"],
    masteryNoun: ["Demon", "Imp", "Fel Spirit", "Soul", "Sigil", "Pact"],
    masteryVerb: ["Summon", "Bind", "Channel", "Empower", "Awaken", "Consume"],
    signaturesA: ["Eye Beam", "Chaos Strike", "Annihilation", "Demon's Bite", "Fel Rush", "Vengeful Retreat"],
    signaturesB: ["Demon Spikes", "Soul Cleave", "Spectral Sight", "Pit Pact", "Fel Aegis", "Bulwark of Fel"],
    signaturesC: ["Metamorphosis", "Sigil of Chains", "Sigil of Flame", "Sigil of Misery", "Demonic Trample", "Last Resort"],
    capstoneA: "Metamorphosis",
    capstoneB: "Fel Devastation",
    capstoneC: "Demon Form",
  },
  stormbringer: {
    damageType: "Lightning",
    damageNoun: ["Bolt", "Thunder", "Storm", "Tempest", "Surge", "Squall"],
    damageVerb: ["Strike", "Bolt", "Crash", "Surge", "Rip", "Shock"],
    defenseNoun: ["Storm Shield", "Lightning Veil", "Tempest Skin", "Wind Wall", "Squall Veil", "Thunder Aegis"],
    defenseVerb: ["Surge", "Veil", "Anchor", "Withstand", "Reflect", "Endure"],
    masteryNoun: ["Storm", "Wind", "Tempest", "Lightning", "Thunder", "Cloud"],
    masteryVerb: ["Channel", "Empower", "Awaken", "Summon", "Surge", "Embrace"],
    signaturesA: ["Lightning Bolt", "Chain Lightning", "Thunderstorm", "Tempest Surge", "Squall", "Stormstrike"],
    signaturesB: ["Storm Shield", "Wind Wall", "Lightning Veil", "Tempest Skin", "Squall Veil", "Thunder Aegis"],
    signaturesC: ["Stormcaller", "Wind Walker", "Tempest Form", "Master of Storms", "Lightning Lord", "Eye of the Storm"],
    capstoneA: "Tempest Form",
    capstoneB: "Living Storm",
    capstoneC: "Eye of the Storm",
  },
  witchhunter: {
    damageType: "Holy",
    damageNoun: ["Crossbow", "Pistol", "Silver", "Stake", "Whip", "Hammer"],
    damageVerb: ["Strike", "Shoot", "Pierce", "Burn", "Sanctify", "Banish"],
    defenseNoun: ["Plate", "Holy Cloak", "Anti-Magic Veil", "Banishing Skin", "Sanctified Plate", "Pious Aegis"],
    defenseVerb: ["Reflect", "Banish", "Sanctify", "Anchor", "Endure", "Veil"],
    masteryNoun: ["Holy Mark", "Stake", "Banishing", "Hex Breaker", "Pure Silver", "Inquisition"],
    masteryVerb: ["Mark", "Banish", "Empower", "Inscribe", "Awaken", "Channel"],
    signaturesA: ["Holy Bullet", "Sanctified Crossbow", "Banishing Strike", "Silver Stake", "Pious Hammer", "Inquisition"],
    signaturesB: ["Sanctified Plate", "Anti-Magic Veil", "Pious Aegis", "Holy Cloak", "Stalwart Faith", "Banishing Skin"],
    signaturesC: ["Hex Breaker", "Heretic Mark", "Holy Trial", "Inquisitor's Eye", "Banishing Brand", "Sanctified Mark"],
    capstoneA: "Final Banishing",
    capstoneB: "Sanctified Bastion",
    capstoneC: "Inquisitor's Wrath",
  },
  knightofxoroth: {
    damageType: "Fel",
    damageNoun: ["Fel Strike", "Shadow Brand", "Demon's Leap", "Chaos Shard", "Fel Storm", "Soul Brand"],
    damageVerb: ["Strike", "Slash", "Burn", "Curse", "Rend", "Tear"],
    defenseNoun: ["Xorothian Steel", "Pit Pact", "Fel Aegis", "Demon Skin", "Infernal Plate", "Legion Seal"],
    defenseVerb: ["Pact", "Veil", "Anchor", "Reflect", "Withstand", "Endure"],
    masteryNoun: ["Felsteed", "Demon", "Imp", "Fel Spirit", "Pit Lord", "Sigil"],
    masteryVerb: ["Summon", "Bind", "Channel", "Empower", "Awaken", "Consume"],
    signaturesA: ["Fel Strike", "Shadow Brand", "Demon's Leap", "Chaos Shard", "Fel Cleave", "Doom Pronouncement"],
    signaturesB: ["Xorothian Steel", "Pit Pact", "Legion Seal", "Infernal Presence", "Fel Aegis", "Demon Skin"],
    signaturesC: ["Felsworn Form", "Demon Form", "Knight of Xoroth", "Pit Lord's Pact", "Fel Empowerment", "Legion Lord"],
    capstoneA: "Felsworn Form",
    capstoneB: "Pit Lord's Bulwark",
    capstoneC: "Knight of Xoroth",
  },
  barbarian: {
    damageType: "Physical",
    damageNoun: ["Axe", "Cleaver", "Fury", "Berserker", "Whirlwind", "Carnage"],
    damageVerb: ["Cleave", "Hew", "Hack", "Whirl", "Rend", "Smash"],
    defenseNoun: ["Iron Hide", "Battle Trance", "War Stance", "Berserker Skin", "Iron Will", "Bloodlust"],
    defenseVerb: ["Stance", "Endure", "Withstand", "Anchor", "Bloodlust", "Rage"],
    masteryNoun: ["Rage", "Fury", "Bloodlust", "War Cry", "Battle Trance", "Bloodthirst"],
    masteryVerb: ["Channel", "Embrace", "Awaken", "Inspire", "Empower", "Roar"],
    signaturesA: ["Whirlwind", "Cleave", "Mortal Strike", "Berserker Rage", "Heroic Throw", "Slam"],
    signaturesB: ["Iron Hide", "Battle Stance", "Berserker Skin", "Iron Will", "Last Stand", "Spell Reflection"],
    signaturesC: ["Bloodthirst", "War Cry", "Bloodlust", "Heroic Leap", "Avatar", "Recklessness"],
    capstoneA: "Avatar of War",
    capstoneB: "Endless Rage",
    capstoneC: "Bloodbath",
  },
  ranger: {
    damageType: "Physical",
    damageNoun: ["Arrow", "Volley", "Snipe", "Trap", "Bolt", "Arrow Storm"],
    damageVerb: ["Shoot", "Snipe", "Volley", "Pierce", "Trap", "Mark"],
    defenseNoun: ["Camouflage", "Stalker's Veil", "Wild Skin", "Beast Bond", "Trap Mastery", "Hawk Eye"],
    defenseVerb: ["Veil", "Camouflage", "Phase", "Anchor", "Mark", "Stalk"],
    masteryNoun: ["Beast", "Hawk", "Wolf", "Cat", "Bear", "Pet"],
    masteryVerb: ["Tame", "Command", "Empower", "Bond", "Awaken", "Lead"],
    signaturesA: ["Aimed Shot", "Multi-Shot", "Rapid Fire", "Marked Shot", "Hunter's Mark", "Volley"],
    signaturesB: ["Camouflage", "Stalker's Veil", "Disengage", "Feign Death", "Wild Skin", "Hawk Eye"],
    signaturesC: ["Beast Mastery", "Wild Bond", "Pet's Loyalty", "Hunter's Lore", "Beastial Wrath", "Master Trapper"],
    capstoneA: "Trueshot",
    capstoneB: "Wild Spirits",
    capstoneC: "Beast Master",
  },
  sonofarugal: {
    damageType: "Physical",
    damageNoun: ["Claw", "Fang", "Maul", "Bite", "Pounce", "Howl"],
    damageVerb: ["Slash", "Maul", "Bite", "Pounce", "Tear", "Rend"],
    defenseNoun: ["Hide", "Wolf Form", "Pelt", "Stalker", "Worgen Skin", "Pack Bond"],
    defenseVerb: ["Stalk", "Pelt", "Endure", "Anchor", "Pack", "Howl"],
    masteryNoun: ["Pack", "Wolf", "Worgen", "Cursed", "Lunar", "Howl"],
    masteryVerb: ["Bond", "Awaken", "Embrace", "Channel", "Lead", "Howl"],
    signaturesA: ["Worgen Form", "Slashing Claws", "Maul", "Pounce", "Bite", "Frenzied Strikes"],
    signaturesB: ["Stalker", "Worgen Skin", "Wolf Pelt", "Pack Bond", "Lunar Hide", "Cursed Endurance"],
    signaturesC: ["Howling Pack", "Lunar Frenzy", "Pack Leader", "Cursed Form", "Bestial Surge", "Wolf Spirit"],
    capstoneA: "Worgen Awakening",
    capstoneB: "Pack Leader",
    capstoneC: "Lunar Frenzy",
  },
  witchdoctor: {
    damageType: "Nature",
    damageNoun: ["Hex", "Curse", "Spirit", "Toxin", "Poison", "Voodoo"],
    damageVerb: ["Hex", "Curse", "Conjure", "Channel", "Poison", "Cripple"],
    defenseNoun: ["Spirit Veil", "Hex Skin", "Voodoo Ward", "Toxin Bond", "Tribal Aegis", "Mask"],
    defenseVerb: ["Veil", "Hex", "Anchor", "Bind", "Endure", "Reflect"],
    masteryNoun: ["Spirit", "Voodoo", "Mask", "Wisp", "Familiar", "Totem"],
    masteryVerb: ["Summon", "Channel", "Bind", "Awaken", "Empower", "Speak"],
    signaturesA: ["Hex Bolt", "Spirit Lance", "Toxin Spit", "Poison Cloud", "Cripple Curse", "Voodoo Strike"],
    signaturesB: ["Spirit Veil", "Hex Skin", "Voodoo Ward", "Tribal Aegis", "Toxin Bond", "Mask of Endurance"],
    signaturesC: ["Spirit Walker", "Voodoo Mastery", "Tribal Lore", "Wisp Form", "Familiar Bond", "Spirit Channeling"],
    capstoneA: "Spirit Walker",
    capstoneB: "Tribal Bulwark",
    capstoneC: "Voodoo Lord",
  },
  discipleofshadra: {
    damageType: "Nature",
    damageNoun: ["Web", "Venom", "Fang", "Spider", "Toxin", "Sting"],
    damageVerb: ["Strike", "Bite", "Sting", "Poison", "Inject", "Cripple"],
    defenseNoun: ["Silk Veil", "Spider Skin", "Web Bulwark", "Venom Pact", "Shadra's Aegis", "Cocoon"],
    defenseVerb: ["Veil", "Web", "Anchor", "Cocoon", "Endure", "Reflect"],
    masteryNoun: ["Spider", "Shadra", "Brood", "Hatchling", "Spawn", "Cocoon"],
    masteryVerb: ["Summon", "Bind", "Channel", "Awaken", "Empower", "Brood"],
    signaturesA: ["Web Bolt", "Venom Strike", "Spider Bite", "Toxin Spit", "Poison Cloud", "Cripple Web"],
    signaturesB: ["Silk Veil", "Spider Skin", "Web Bulwark", "Cocoon", "Shadra's Aegis", "Venom Pact"],
    signaturesC: ["Brood Mother", "Shadra's Servant", "Spider Lord", "Web Master", "Brood Bond", "Spawn Eternal"],
    capstoneA: "Avatar of Shadra",
    capstoneB: "Shadra's Bulwark",
    capstoneC: "Brood Mother",
  },
};

function autoBuildSpecsForClass(classId: string): SpecConfig[] {
  const flavor = CLASS_FLAVORS[classId];
  if (!flavor) {
    // Generic fallback
    return [];
  }

  const sharedThemeBase = (signatures: string[], capstoneName: string, capstoneDesc: string): SpecTheme => ({
    signature: signatures,
    prefix: ["Improved", "Twin", "Greater", "Empowered", "Focused", "Honed"],
    noun: flavor.damageNoun,
    verb: flavor.damageVerb,
    damageType: flavor.damageType,
    capstoneName,
    capstoneDesc,
  });

  const damageThemeRight = (sigs: string[], capName: string, capDesc: string): SpecTheme => ({
    signature: sigs,
    prefix: ["Improved", "Twin", "Greater", "Empowered", "Focused", "Honed"],
    noun: flavor.damageNoun,
    verb: flavor.damageVerb,
    damageType: flavor.damageType,
    capstoneName: capName,
    capstoneDesc: capDesc,
  });

  const defenseTheme = (sigs: string[], capName: string, capDesc: string): SpecTheme => ({
    signature: sigs,
    prefix: ["Stalwart", "Iron", "Hallowed", "Resolute", "Indomitable", "Unyielding"],
    noun: flavor.defenseNoun,
    verb: flavor.defenseVerb,
    damageType: flavor.damageType,
    capstoneName: capName,
    capstoneDesc: capDesc,
  });

  const masteryTheme = (sigs: string[], capName: string, capDesc: string): SpecTheme => ({
    signature: sigs,
    prefix: ["Ancient", "Awakened", "Empowered", "Channeled", "Hallowed", "True"],
    noun: flavor.masteryNoun,
    verb: flavor.masteryVerb,
    damageType: flavor.damageType,
    capstoneName: capName,
    capstoneDesc: capDesc,
  });

  return [
    {
      id: "wrath",
      name: "Path of Wrath",
      role: "damage",
      attribute: "strength",
      complexity: "normal",
      description: `Channel raw destruction through ${flavor.damageType.toLowerCase()} fury — devastating enemies in close quarters with overwhelming damage.`,
      sampleSpells: flavor.signaturesA.slice(0, 3),
      leftTreeName: "Class Path",
      rightTreeName: "Path of Wrath",
      leftTheme: sharedThemeBase(flavor.signaturesA, flavor.capstoneA, `Unleash ${flavor.capstoneA} — a transformative state for 20s, dramatically empowering all your abilities. 3 min cooldown.`),
      rightTheme: damageThemeRight(flavor.signaturesA, flavor.capstoneA, `Unleash ${flavor.capstoneA} — a transformative state for 20s, dramatically empowering all your abilities. 3 min cooldown.`),
    },
    {
      id: "bulwark",
      name: "Path of Bulwark",
      role: "tank",
      attribute: "stamina",
      complexity: "intermediate",
      description: `Become an unbreakable bulwark — withstand devastating blows and shield your allies with an iron will and ${flavor.damageType.toLowerCase()} resilience.`,
      sampleSpells: flavor.signaturesB.slice(0, 3),
      leftTreeName: "Class Path",
      rightTreeName: "Path of Bulwark",
      leftTheme: sharedThemeBase(flavor.signaturesA, flavor.capstoneA, `Unleash ${flavor.capstoneA} for 20s, empowering all your abilities. 3 min cooldown.`),
      rightTheme: defenseTheme(flavor.signaturesB, flavor.capstoneB, `Become ${flavor.capstoneB} for 20s — damage taken is reduced by 50% and you cannot be stunned. 3 min cooldown.`),
    },
    {
      id: "mastery",
      name: "Path of Mastery",
      role: "support",
      attribute: "intellect",
      complexity: "advanced",
      description: `Master the ancient lore of your kind — bend the forces of ${flavor.damageType.toLowerCase()} to your will through deep knowledge and channeled power.`,
      sampleSpells: flavor.signaturesC.slice(0, 3),
      leftTreeName: "Class Path",
      rightTreeName: "Path of Mastery",
      leftTheme: sharedThemeBase(flavor.signaturesA, flavor.capstoneA, `Unleash ${flavor.capstoneA} for 20s, empowering all your abilities. 3 min cooldown.`),
      rightTheme: masteryTheme(flavor.signaturesC, flavor.capstoneC, `Channel the true mastery of your craft — ${flavor.capstoneC} radiates power to all allies for 20s. 3 min cooldown.`),
    },
  ];
}

// Build the final per-class specs map
const ALL_CLASS_SPECS: Record<string, SpecConfig[]> = {};
for (const meta of classMetas) {
  if (CLASS_SPECS[meta.id]) {
    ALL_CLASS_SPECS[meta.id] = CLASS_SPECS[meta.id];
  } else {
    ALL_CLASS_SPECS[meta.id] = autoBuildSpecsForClass(meta.id);
  }
}

// ─── PUBLIC LOOKUPS ─────────────────────────────────────────────────────────
export function getClassDetail(classId: string): ClassDetail | undefined {
  const meta = classMetas.find((c) => c.id === classId);
  if (!meta) return undefined;
  const specs = ALL_CLASS_SPECS[classId] ?? [];
  return {
    ...meta,
    specs: specs.map<SpecMeta>((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      attribute: s.attribute,
      complexity: s.complexity,
      description: s.description,
      sampleSpells: s.sampleSpells,
    })),
  };
}

export function getSpecTree(classId: string, specId: string): TalentTree | undefined {
  const meta = classMetas.find((c) => c.id === classId);
  if (!meta) return undefined;
  const specs = ALL_CLASS_SPECS[classId] ?? [];
  const spec = specs.find((s) => s.id === specId);
  if (!spec) return undefined;
  return buildSpecTreeFromTheme(
    classId,
    spec.id,
    meta.name,
    meta.color,
    spec.name,
    spec.leftTreeName,
    spec.rightTreeName,
    spec.leftTheme,
    spec.rightTheme,
  );
}
