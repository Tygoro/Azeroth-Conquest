import type {
  TalentTree,
  ClassMeta,
  ClassDetail,
  SpecMeta,
  TalentNode,
  SidebarNode,
  ChoiceOption,
} from '@workspace/api-client-react';
import { generateLayout, getRowsFor, getClassRowsFor, type GeneratedLayout } from './tree-rows';

// ─── INTERNAL TYPES ──────────────────────────────────────────────────────────

type NodeDef = Omit<TalentNode, 'currentPoints'>;
type TalentDef = { name: string; description: string };

type SpecTheme = {
  signature: string[];
  prefix: string[];
  noun: string[];
  verb: string[];
  damageType: string;
  capstoneName: string;
  capstoneDesc: string;
};

type SpecConfig = {
  id: string;
  name: string;
  role: SpecMeta['role'];
  attribute: SpecMeta['attribute'];
  complexity: SpecMeta['complexity'];
  description: string;
  sampleSpells: string[];
  leftTreeName: string;
  rightTreeName: string;
  leftTheme: SpecTheme;
  rightTheme: SpecTheme;
};

type SpecBuildDef = {
  id: string;
  name: string;
  role: SpecMeta['role'];
  attribute: SpecMeta['attribute'];
  complexity: SpecMeta['complexity'];
  description: string;
  signatures: string[];
  prefix: string[];
  noun: string[];
  verb: string[];
  damageType?: string;
  capstoneName: string;
  capstoneDesc: string;
  rightTreeName?: string;
};

type ClassFlavor = {
  damageType: string;
  classTreeName: string;
  classSignatures: string[];
  classPrefix: string[];
  classNoun: string[];
  classVerb: string[];
  classCapstoneName: string;
  classCapstoneDesc: string;
  specs: SpecBuildDef[];
};

// ─── NODE BUILDER ────────────────────────────────────────────────────────────

function nodes(defs: NodeDef[]): TalentNode[] {
  return defs.map((d) => ({ ...d, currentPoints: 0 }));
}

// ─── CHOICE NODE GENERATOR ───────────────────────────────────────────────────

const CHOICE_PAIRS: Array<[string, string, string, string]> = [
  ['Aggressive', 'Damage increased by 25%, but cooldown is 30% longer.',
   'Reactive',   'Cooldown reduced by 30%, but damage is 15% lower.'],
  ['Burst',      'Releases all energy at once for massive {dmg} damage.',
   'Sustain',    'Spreads {dmg} effect over 8s for steady pressure.'],
  ['Lethal',     'Critical hits deal 50% additional {dmg} damage.',
   'Empowered',  'Each successful hit increases your power by 5%, stacking up to 5 times.'],
  ['Surging',    '{dmg} abilities have 20% chance to fire twice.',
   'Steadfast',  'Reduces damage taken by 10% while channeling {dmg} abilities.'],
  ['Ravaging',   'Bypass 30% of enemy armor with all {dmg} attacks.',
   'Enduring',   'Heals you for 5% of all {dmg} damage dealt.'],
  ['Unleashed',  'Activate to enter your ultimate state for 12s. 90s cooldown.',
   'Eternal',    'Permanent aura of power: 8% to all stats while above 50% health.'],
];

function genChoiceOptions(baseName: string, choiceIdx: number, nodeId: string, dmg: string): ChoiceOption[] {
  const [adjA, descA, adjB, descB] = CHOICE_PAIRS[choiceIdx % CHOICE_PAIRS.length];
  const interp = (s: string) => s.replace(/\{dmg\}/g, dmg);
  return [
    { id: `${nodeId}_oA`, name: `${adjA} ${baseName}`, description: interp(descA) },
    { id: `${nodeId}_oB`, name: `${adjB} ${baseName}`, description: interp(descB) },
  ];
}

// ─── DEEP TREE BUILDER ───────────────────────────────────────────────────────

function buildDeepTree(
  prefix: string,
  talents: TalentDef[],
  dmg: string,
  layout: GeneratedLayout,
): TalentNode[] {
  if (talents.length !== layout.count) {
    throw new Error(
      `buildDeepTree: expected ${layout.count} talents for prefix "${prefix}", got ${talents.length}`,
    );
  }
  let choiceCounter = 0;
  return nodes(
    talents.map((t, i) => {
      const id = `${prefix}_${i + 1}`;
      const type = layout.types[i];
      const node: NodeDef = {
        id,
        name: t.name,
        description: t.description,
        maxPoints: layout.maxPoints[i],
        prerequisites: layout.prereqs[i].map((idx) => `${prefix}_${idx + 1}`),
        position: layout.positions[i],
        type,
      };
      if (type === 'choice') {
        node.options = genChoiceOptions(t.name, choiceCounter++, id, dmg);
      }
      return node;
    }),
  );
}

// ─── SIDEBAR TRACK ───────────────────────────────────────────────────────────

const SIDEBAR_UNLOCK_THRESHOLDS = [0, 10, 20, 30, 40];

function buildSidebarTrack(specId: string, theme: SpecTheme): SidebarNode[] {
  const tier = (n: number) => ['I', 'II', 'III', 'IV', 'V'][n] ?? `${n + 1}`;
  const dmg = theme.damageType;
  const verbs = theme.verb;
  const nouns = theme.noun;
  const baseNames = [
    `${dmg} Attunement`,
    `${dmg} Conduit`,
    `${nouns[0] ?? 'Power'} Resonance`,
    `${verbs[0] ?? 'Strike'} Mastery`,
    `Avatar of ${theme.capstoneName.split(' ').pop()}`,
  ];
  const baseDescs = [
    `Increases your ${dmg} damage and healing by 3%.`,
    `Reduces the cooldown of your signature abilities by 10%.`,
    `Critical hits restore 1% of your maximum mana or resource.`,
    `Your ${verbs[0]?.toLowerCase() ?? 'abilities'} have a 15% chance to trigger an additional effect.`,
    `Unleash your inner power: gain 10% haste and 10% versatility while above 50% health.`,
  ];

  return SIDEBAR_UNLOCK_THRESHOLDS.map((threshold, i) => ({
    id: `${specId}_sb_${i + 1}`,
    name: `${baseNames[i]} ${tier(i)}`,
    description: baseDescs[i],
    unlockPointsRequired: threshold,
  }));
}

// ─── TALENT NAME GENERATOR ───────────────────────────────────────────────────

function genTalent(
  theme: SpecTheme,
  idx: number,
  isLeft: boolean,
  layout: GeneratedLayout,
): TalentDef {
  if (idx === layout.count - 1) {
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

  const style = idx % 3;
  let name: string;
  if (style === 0) name = `${pre} ${noun}`;
  else if (style === 1) name = `${noun} ${verb}`;
  else name = `${pre} ${verb}`;

  const nodeType = layout.types[idx];
  let desc: string;
  if (nodeType === 'passive') {
    desc = `Empowers your ${theme.damageType} abilities, increasing their potency. Bonus +5% per point.`;
  } else if (nodeType === 'choice') {
    desc = `Choose to either deal extra ${theme.damageType} damage or reduce damage taken by allies near you.`;
  } else {
    desc = `Unleash a ${theme.damageType.toLowerCase()} ${verb.toLowerCase()} on your foes. Damage +10% per point.`;
  }
  return { name, description: desc };
}

// ─── CLASS-INVARIANT LEFT TREE CACHE ────────────────────────────────────────

const CLASS_LEFT_TREE_CACHE = new Map<string, ReadonlyArray<TalentNode>>();

function getCanonicalClassLeftConfig(classId: string): {
  leftTreeName: string;
  leftTheme: SpecTheme;
} | undefined {
  const specs = ALL_CLASS_SPECS[classId];
  if (!specs || specs.length === 0) return undefined;
  return { leftTreeName: specs[0].leftTreeName, leftTheme: specs[0].leftTheme };
}

function getOrBuildClassLeftTree(classId: string): {
  leftTree: ReadonlyArray<TalentNode>;
  leftTreeName: string;
} | undefined {
  const cfg = getCanonicalClassLeftConfig(classId);
  if (!cfg) return undefined;

  let leftTree = CLASS_LEFT_TREE_CACHE.get(classId);
  if (!leftTree) {
    const leftLayout = generateLayout(getClassRowsFor(classId));
    const leftTalents: TalentDef[] = Array.from(
      { length: leftLayout.count },
      (_, i) => genTalent(cfg.leftTheme, i, true, leftLayout),
    );
    const built = buildDeepTree(
      `${classId}_class_l`,
      leftTalents,
      cfg.leftTheme.damageType,
      leftLayout,
    );
    leftTree = Object.freeze(built.map((n) => Object.freeze(n))) as ReadonlyArray<TalentNode>;
    CLASS_LEFT_TREE_CACHE.set(classId, leftTree);
  }
  return { leftTree, leftTreeName: cfg.leftTreeName };
}

// ─── SPEC TREE BUILDER ───────────────────────────────────────────────────────

function buildSpecTreeFromTheme(
  classId: string,
  specId: string,
  className: string,
  color: string,
  specName: string,
  rightTreeName: string,
  rightTheme: SpecTheme,
): TalentTree | undefined {
  const leftBundle = getOrBuildClassLeftTree(classId);
  if (!leftBundle) return undefined;

  const rightLayout = generateLayout(getRowsFor(classId, specId, 'r'));
  const rightTalents: TalentDef[] = Array.from(
    { length: rightLayout.count },
    (_, i) => genTalent(rightTheme, i, false, rightLayout),
  );

  return {
    class: className,
    classId,
    specId,
    specName,
    leftTreeName: leftBundle.leftTreeName,
    rightTreeName,
    maxPoints: 61,
    color,
    leftTree: [...leftBundle.leftTree],
    rightTree: buildDeepTree(`${classId}_${specId}_r`, rightTalents, rightTheme.damageType, rightLayout),
    sidebarTrack: buildSidebarTrack(`${classId}_${specId}`, rightTheme),
  };
}

// ─── CLASS METAS ────────────────────────────────────────────────────────────

export const classMetas: ClassMeta[] = [
  { id: 'suncleric',      name: 'Sun Cleric',       description: "A devoted servant of An'she's holy light.",    icon: 'sun',    color: '#FFD700' },
  { id: 'necromancer',    name: 'Necromancer',       description: 'Master of death and the undead arts.',          icon: 'skull',  color: '#2D9B6E' },
  { id: 'pyromancer',     name: 'Pyromancer',        description: 'A living conduit of flame.',                    icon: 'flame',  color: '#FF4500' },
  { id: 'cultist',        name: 'Cultist',           description: 'Devotee of forbidden powers.',                  icon: 'eye',    color: '#9B4DCA' },
  { id: 'starcaller',     name: 'Starcaller',        description: 'Channels celestial fury.',                      icon: 'star',   color: '#4169E1' },
  { id: 'tinker',         name: 'Tinker',            description: 'A mechanical genius of war.',                   icon: 'wrench', color: '#B8860B' },
  { id: 'runemaster',     name: 'Runemaster',        description: 'Carves runic sigils into reality.',             icon: 'rune',   color: '#DC143C' },
  { id: 'primalist',      name: 'Primalist',         description: 'A primal channeler of elemental forces.',       icon: 'earth',  color: '#228B22' },
  { id: 'reaper',         name: 'Reaper',            description: 'A swift harvester of souls.',                   icon: 'scythe', color: '#708090' },
  { id: 'venomancer',     name: 'Venomancer',        description: 'Wielder of toxin, web, and brood-magic.',       icon: 'spider', color: '#9C27B0' },
  { id: 'chronomancer',   name: 'Chronomancer',      description: 'Time-bending arcanist.',                        icon: 'clock',  color: '#00CED1' },
  { id: 'bloodmage',      name: 'Bloodmage',         description: 'Sorcerer of crimson alchemy and lifeblood.',    icon: 'drop',   color: '#B0234A' },
  { id: 'guardian',       name: 'Guardian',          description: 'Indomitable protector.',                        icon: 'shield', color: '#4682B4' },
  { id: 'stormbringer',   name: 'Stormbringer',      description: 'Tempest incarnate.',                            icon: 'bolt',   color: '#1E90FF' },
  { id: 'felsworn',       name: 'Felsworn',          description: 'Sworn to fel and infernal flame.',              icon: 'horn',   color: '#2CB04C' },
  { id: 'barbarian',      name: 'Barbarian',         description: 'Ferocious berserker.',                          icon: 'axe',    color: '#CD5C5C' },
  { id: 'witchdoctor',    name: 'Witch Doctor',      description: 'Tribal hexer who summons spirits.',             icon: 'mask',   color: '#20B2AA' },
  { id: 'witchhunter',    name: 'Witch Hunter',      description: 'Trained to destroy dark magic.',                icon: 'cross',  color: '#C8A96E' },
  { id: 'knightofxoroth', name: 'Knight of Xoroth',  description: 'Sworn to the Lords of Xoroth.',                icon: 'sword',  color: '#8B0000' },
  { id: 'ranger',         name: 'Ranger',            description: 'Wilderness expert with bow and trap.',          icon: 'bow',    color: '#6B8E23' },
  { id: 'templar',        name: 'Templar',           description: 'Holy warrior bound by sacred oath.',            icon: 'hammer', color: '#E0D080' },
];

// ─── CLASS FLAVOR DATA (ALL 21 CLASSES) ─────────────────────────────────────

const CLASS_FLAVORS: Record<string, ClassFlavor> = {
  suncleric: {
    damageType: 'Holy',
    classTreeName: 'Path of Sun Cleric',
    classSignatures: ['Holy Light', 'Sunfire', 'Lay on Hands', 'Consecration', 'Word of Glory', 'Divine Shield'],
    classPrefix: ['Sacred', 'Radiant', 'Hallowed', 'Solar', 'Blessed', 'Pious'],
    classNoun: ['Light', 'Sun', 'Faith', 'Prayer', 'Aegis', 'Halo'],
    classVerb: ['Bless', 'Channel', 'Awaken', 'Empower', 'Illuminate', 'Sanctify'],
    classCapstoneName: "Avatar of An'she",
    classCapstoneDesc: "For 20 sec, become a vessel of An'she's holy light. Your Holy spells deal 30% increased damage and healing, and your Holy strikes ignite enemies for additional Holy damage. 3 min cooldown.",
    specs: [
      {
        id: 'piety', name: 'Piety', role: 'damage', attribute: 'intellect', complexity: 'advanced',
        description: 'Wield sanctified flame and holy wrath in tandem, searing corruption away and reducing enemies into purified ash.',
        signatures: ['Sunfire', 'Holy Wrath', 'Pious Spark', 'Pyre of Faith', 'Flame of An\'she', 'Devoted Flame'],
        prefix: ['Devout', 'Pious', 'Searing', 'Burning', 'Holy', 'Sanctified'],
        noun: ['Flame', 'Pyre', 'Light', 'Sun', 'Halo', 'Beam'],
        verb: ['Burn', 'Sear', 'Smite', 'Channel', 'Illuminate', 'Consume'],
        capstoneName: "Wrath of An'she",
        capstoneDesc: "Channel a beam of pure solar fury for 8 sec. Deals massive Holy damage to all enemies in a 30-yard line and heals nearby allies for 5% max HP per second. 3 min cooldown.",
      },
      {
        id: 'valkyrie', name: 'Valkyrie', role: 'damage', attribute: 'strength', complexity: 'intermediate',
        description: "Become the Light's wrath made flesh, carving through foes with a greatblade in each hand as a storm of merciless holy steel.",
        signatures: ['Twin Heaven', "Valkyrie's Charge", 'Reckoning', 'Holy Cleave', 'Verdict', 'Wings of Light'],
        prefix: ['Vengeful', 'Wrathful', 'Soaring', 'Ascendant', 'Holy', 'Glorious'],
        noun: ['Blade', 'Wing', 'Verdict', 'Charge', 'Strike', 'Halo'],
        verb: ['Strike', 'Cleave', 'Charge', 'Soar', 'Smite', 'Judge'],
        capstoneName: 'Avatar of the Valkyrie',
        capstoneDesc: 'Take Valkyrie form for 20 sec. Sprout wings of light, dual-wield greatblades, and your auto-attacks cleave for Holy damage. 3 min cooldown.',
      },
      {
        id: 'seraphim', name: 'Seraphim', role: 'tank', attribute: 'stamina', complexity: 'normal',
        description: 'Swear a radiant oath to guard your allies — becoming a shield bearer that turns the wrath of the sun into impenetrable defense.',
        signatures: ["Seraphim's Oath", 'Bulwark of Light', 'Sacred Shield', 'Eternal Aegis', 'Hallowed Stand', "Guardian's Vow"],
        prefix: ['Sacred', 'Hallowed', 'Vigilant', 'Eternal', 'Radiant', 'Blessed'],
        noun: ['Shield', 'Aegis', 'Bulwark', 'Wall', 'Vow', 'Sentinel'],
        verb: ['Guard', 'Shield', 'Protect', 'Anchor', 'Withstand', 'Bless'],
        capstoneName: 'Eternal Bulwark',
        capstoneDesc: 'Take 50% reduced damage for 20 sec. Each attack against you generates a Holy retaliation that strikes the attacker. 3 min cooldown.',
      },
      {
        id: 'blessings', name: 'Blessings', role: 'healer', attribute: 'intellect', complexity: 'intermediate',
        description: 'A radiant healer who weaves blessings of restoration, mending the wounded with golden light and shielding allies from harm.',
        signatures: ['Holy Light', 'Blessing of Faith', 'Sacred Bloom', 'Lay on Hands', 'Word of Glory', 'Beacon of Light'],
        prefix: ['Blessed', 'Sacred', 'Devout', 'Holy', 'Restoring', "Mercy's"],
        noun: ['Blessing', 'Light', 'Mercy', 'Bloom', 'Prayer', 'Glory'],
        verb: ['Bless', 'Heal', 'Mend', 'Restore', 'Inspire', 'Pray'],
        capstoneName: "Tranquility of An'she",
        capstoneDesc: "Channel a radiant aura for 10 sec. Restores 5% of max HP per second to all allies within 30 yards and removes one harmful effect every 2 seconds. 5 min cooldown.",
      },
    ],
  },

  necromancer: {
    damageType: 'Shadow',
    classTreeName: 'Path of Necromancer',
    classSignatures: ['Death Coil', 'Drain Life', 'Shadow Bolt', 'Curse of Doom', 'Death Strike', 'Soul Tap'],
    classPrefix: ['Dark', 'Withered', 'Shadowed', 'Necrotic', 'Cursed', 'Sepulchral'],
    classNoun: ['Death', 'Shadow', 'Soul', 'Bone', 'Grave', 'Pact'],
    classVerb: ['Drain', 'Curse', 'Sap', 'Wither', 'Channel', 'Bind'],
    classCapstoneName: 'Avatar of Death',
    classCapstoneDesc: 'For 20 sec, your Shadow spells cost no resource and deal 30% increased damage. Killing an enemy refreshes the duration up to 30 sec total. 3 min cooldown.',
    specs: [
      {
        id: 'death', name: 'Death', role: 'damage', attribute: 'intellect', complexity: 'normal',
        description: 'Bend death itself to your will, draining the lifeforce of foes to fuel devastating necrotic spells.',
        signatures: ['Death Coil', 'Death Strike', 'Drain Life', 'Soul Tap', 'Necrotic Bolt', "Death's Embrace"],
        prefix: ['Withered', 'Necrotic', 'Mortal', 'Black', 'Sepulchral', 'Cursed'],
        noun: ['Death', 'Grave', 'Tomb', 'Pall', 'Wraith', 'Ruin'],
        verb: ['Reap', 'Drain', 'Wither', 'Curse', 'Slay', 'Embrace'],
        capstoneName: 'Lich Form',
        capstoneDesc: 'Become a lich for 20 sec — your Shadow spells deal 30% more damage and cost no resource. 3 min cooldown.',
      },
      {
        id: 'rime', name: 'Rime', role: 'damage', attribute: 'intellect', complexity: 'intermediate',
        description: 'Wreathe enemies in chilling rime, freezing them solid as your shadow magic withers their bones.',
        signatures: ['Frostbolt', 'Frozen Tomb', 'Rime Shard', 'Glacial Spike', 'Chill of the Grave', 'Frostfire Bolt'],
        prefix: ['Frostbitten', 'Glacial', 'Rimed', 'Chilling', 'Frozen', 'Boreal'],
        noun: ['Frost', 'Rime', 'Spike', 'Glacier', 'Tomb', 'Chill'],
        verb: ['Freeze', 'Chill', 'Pierce', 'Encase', 'Shatter', 'Wither'],
        damageType: 'Frost-Shadow',
        capstoneName: 'Eternal Winter',
        capstoneDesc: 'Encase the battlefield in lich-frost for 18 sec, slowing all enemies and dealing Frost-Shadow damage every second. 2 min cooldown.',
      },
      {
        id: 'animation', name: 'Animation', role: 'support', attribute: 'intellect', complexity: 'advanced',
        description: 'Raise legions of undead to fight at your side, commanding the dead to overwhelm the living.',
        signatures: ['Raise Dead', 'Skeletal Army', 'Reanimate', 'Dark Transformation', 'Bone Sovereign', 'Undead Legion'],
        prefix: ['Risen', 'Reanimated', 'Undying', 'Skeletal', 'Eternal', 'Sovereign'],
        noun: ['Skeleton', 'Ghoul', 'Lich', 'Minion', 'Pact', 'Legion'],
        verb: ['Raise', 'Command', 'Reanimate', 'Summon', 'Bind', 'Empower'],
        capstoneName: 'Army of the Dead',
        capstoneDesc: 'Summon a 30-sec army of skeletons that fight beside you and explode on death for Shadow damage. 5 min cooldown.',
      },
    ],
  },

  pyromancer: {
    damageType: 'Fire',
    classTreeName: 'Path of Pyromancer',
    classSignatures: ['Fireball', 'Pyroblast', 'Flamestrike', 'Combustion', 'Living Bomb', 'Scorch'],
    classPrefix: ['Searing', 'Burning', 'Smoldering', 'Blazing', 'Cinder', 'Molten'],
    classNoun: ['Flame', 'Fire', 'Ember', 'Inferno', 'Ash', 'Pyre'],
    classVerb: ['Burn', 'Ignite', 'Scorch', 'Blaze', 'Sear', 'Kindle'],
    classCapstoneName: 'Avatar of Flame',
    classCapstoneDesc: 'Take Avatar of Flame form for 20 sec — your Fire spells deal 30% increased damage and ignite victims for additional damage over time. 3 min cooldown.',
    specs: [
      {
        id: 'incineration', name: 'Incineration', role: 'damage', attribute: 'intellect', complexity: 'normal',
        description: 'Reduce your foes to ash with raw, devastating fire — the simplest path is the most destructive.',
        signatures: ['Fireball', 'Pyroblast', 'Incinerate', 'Combustion', 'Flame Surge', 'Searing Bolt'],
        prefix: ['Searing', 'Burning', 'Incinerating', 'Blazing', "Pyre's", 'Smoldering'],
        noun: ['Inferno', 'Pyre', 'Bolt', 'Burn', 'Surge', 'Blast'],
        verb: ['Burn', 'Incinerate', 'Sear', 'Erupt', 'Detonate', 'Scorch'],
        capstoneName: 'Combustion',
        capstoneDesc: 'Your next 6 spells are guaranteed critical hits and deal +50% Fire damage. 90 sec cooldown.',
      },
      {
        id: 'flameweaving', name: 'Flameweaving', role: 'damage', attribute: 'intellect', complexity: 'intermediate',
        description: 'Weave intricate spell-tapestries of flame, igniting enemies with elegant precision and chained burns.',
        signatures: ['Flame Lash', 'Living Bomb', 'Flame Tapestry', 'Flamestrike', 'Phoenix Strike', 'Burning Mantle'],
        prefix: ['Woven', 'Lashing', 'Cascading', 'Tapestried', 'Spiralling', 'Burning'],
        noun: ['Tapestry', 'Lash', 'Bloom', 'Veil', 'Strand', 'Phoenix'],
        verb: ['Weave', 'Lash', 'Bloom', 'Cascade', 'Spread', 'Ignite'],
        capstoneName: 'Living Inferno',
        capstoneDesc: 'Your damage-over-time effects spread to nearby foes and consume them, dealing massive Fire damage. 2 min cooldown.',
      },
      {
        id: 'draconic', name: 'Draconic', role: 'damage', attribute: 'intellect', complexity: 'advanced',
        description: 'Channel the ancient power of dragons themselves, breathing destruction in waves of draconic fire.',
        signatures: ["Dragon's Breath", 'Dragonfire', 'Wyrmcall', 'Wing Buffet', 'Draconic Aspect', 'Cataclysm'],
        prefix: ['Draconic', "Wyrm's", 'Ancient', 'Sovereign', 'Imperial', 'Roaring'],
        noun: ['Dragon', 'Wyrm', 'Aspect', 'Breath', 'Wing', 'Maw'],
        verb: ['Roar', 'Breathe', 'Buffet', 'Awaken', 'Empower', 'Devour'],
        capstoneName: 'Aspect of Pyre',
        capstoneDesc: 'Take draconic form for 20 sec — gain a fire breath ability that ignites enemies in a 30-yard cone. 3 min cooldown.',
      },
    ],
  },

  cultist: {
    damageType: 'Shadow',
    classTreeName: 'Path of Cultist',
    classSignatures: ['Mind Flay', 'Forbidden Knowledge', 'Dark Pact', 'Mind Sear', "Whispers of N'Zoth", 'Hex of Madness'],
    classPrefix: ['Forbidden', 'Eldritch', 'Maddened', 'Whispering', 'Profane', 'Ascendant'],
    classNoun: ['Whisper', 'Eye', 'Pact', 'Heresy', 'Truth', 'Veil'],
    classVerb: ['Whisper', 'Profess', 'Bind', 'Channel', 'Awaken', 'Embrace'],
    classCapstoneName: "Ascendance of N'Zoth",
    classCapstoneDesc: "For 20 sec, your Shadow spells deal 30% more damage and you take 20% less damage as the Old Gods shield you. 3 min cooldown.",
    specs: [
      {
        id: 'heretic', name: 'Heretic', role: 'damage', attribute: 'intellect', complexity: 'intermediate',
        description: 'Forsake the old ways and weaponize forbidden truths — your whispers drive foes to madness and ruin.',
        signatures: ['Forbidden Knowledge', 'Whispered Doom', 'Mind Flay', "Heretic's Mark", 'Mad Truth', 'Apostasy'],
        prefix: ['Heretical', 'Apostate', 'Forbidden', 'Maddening', 'Whispered', 'Profane'],
        noun: ['Heresy', 'Apostasy', 'Truth', 'Whisper', 'Mark', 'Doom'],
        verb: ['Whisper', 'Reveal', 'Curse', 'Profane', 'Madden', 'Doom'],
        capstoneName: "Apostate's Apotheosis",
        capstoneDesc: 'Sever your last bond to mortality for 20 sec — gain 30% spellpower and your shadow damage afflicts targets with Madness. 3 min cooldown.',
      },
      {
        id: 'corruption', name: 'Corruption', role: 'damage', attribute: 'intellect', complexity: 'normal',
        description: 'Pour rotting void energy into wound and vein, letting corruption fester until your enemies collapse from within.',
        signatures: ['Corruption', 'Curse of Doom', 'Void Touch', 'Rotting Sigil', 'Festering Hex', 'Soul Drain'],
        prefix: ['Corrupted', 'Festering', 'Rotting', 'Void-Touched', 'Withered', 'Putrid'],
        noun: ['Rot', 'Corruption', 'Sigil', 'Hex', 'Plague', 'Drain'],
        verb: ['Corrupt', 'Fester', 'Rot', 'Drain', 'Hex', 'Wither'],
        capstoneName: "Tendrils of N'Zoth",
        capstoneDesc: 'Summon writhing void tendrils that strike all enemies within 20 yards every second for 15 sec. 2 min cooldown.',
      },
      {
        id: 'godblade', name: 'Godblade', role: 'damage', attribute: 'strength', complexity: 'advanced',
        description: 'Forge a blade from the essence of an Old God and cleave through the world with eldritch steel.',
        signatures: ['Godblade', 'Eldritch Cleave', 'Void Slash', "Yogg's Edge", 'Cyclopean Strike', 'Ascendant Cut'],
        prefix: ['Eldritch', 'Cyclopean', 'Ascendant', 'Yogg-Marked', 'Voidsteel', "Old God's"],
        noun: ['Blade', 'Cleave', 'Edge', 'Cut', 'Strike', 'Sever'],
        verb: ['Cleave', 'Sever', 'Carve', 'Strike', 'Rend', 'Sunder'],
        capstoneName: "Old God's Edge",
        capstoneDesc: 'Manifest the Godblade for 20 sec — every melee strike deals additional Shadow damage and heals you for 10% max health. 3 min cooldown.',
      },
      {
        id: 'dreadnought', name: 'Dreadnought', role: 'tank', attribute: 'stamina', complexity: 'intermediate',
        description: 'Become an unyielding monolith of forbidden flesh — drawing power from the void to weather any onslaught.',
        signatures: ['Eldritch Ward', 'Dread Aegis', "Pact of N'Zoth", 'Void Skin', 'Maw Anchor', 'Unliving Vow'],
        prefix: ['Dread', 'Unliving', 'Eldritch', 'Anchored', 'Eternal', 'Voidskin'],
        noun: ['Aegis', 'Ward', 'Maw', 'Pact', 'Skin', 'Anchor'],
        verb: ['Endure', 'Anchor', 'Withstand', 'Bind', 'Devour', 'Resist'],
        capstoneName: 'Maw of the Old Gods',
        capstoneDesc: 'Take only 50% damage for 20 sec and reflect 30% of damage taken back at attackers as Shadow damage. 3 min cooldown.',
      },
    ],
  },

  starcaller: {
    damageType: 'Arcane',
    classTreeName: 'Path of Starcaller',
    classSignatures: ['Starfire', 'Moonfire', 'Wrath of Elune', 'Astral Blast', 'Stellar Flare', 'Lunar Beam'],
    classPrefix: ['Astral', 'Lunar', 'Stellar', 'Celestial', 'Crescent', 'Moonlit'],
    classNoun: ['Star', 'Moon', 'Constellation', 'Eclipse', 'Sky', 'Dawn'],
    classVerb: ['Channel', 'Awaken', 'Align', 'Empower', 'Bless', 'Summon'],
    classCapstoneName: 'Celestial Alignment',
    classCapstoneDesc: 'For 20 sec, sun and moon align — Solar and Lunar spells deal +30% damage, cost no mana, and have no cast time. 3 min cooldown.',
    specs: [
      {
        id: 'sentinel', name: 'Sentinel', role: 'damage', attribute: 'agility', complexity: 'normal',
        description: 'Sentinel of the night sky — wield bow and starlight to pick off enemies from the dark.',
        signatures: ['Moonshot', 'Starbow Volley', "Hunter's Mark", 'Twin Stars', 'Crescent Strike', 'Ambush from Above'],
        prefix: ['Crescent', 'Stellar', 'Silvered', 'Moonlit', 'Veiled', "Sentinel's"],
        noun: ['Bow', 'Arrow', 'Star', 'Volley', 'Mark', 'Strike'],
        verb: ['Loose', 'Strike', 'Mark', 'Volley', 'Pierce', 'Hunt'],
        capstoneName: 'Avatar of the Night',
        capstoneDesc: 'Enter sentinel form for 20 sec — your ranged attacks deal Arcane damage and crit for 200%. 3 min cooldown.',
      },
      {
        id: 'warden', name: 'Warden', role: 'tank', attribute: 'stamina', complexity: 'intermediate',
        description: 'Warden of the sacred groves — turn lunar might into a bulwark that no foe may cross.',
        signatures: ['Lunar Aegis', "Warden's Stance", 'Astral Block', 'Stellar Ward', 'Moonlit Wall', 'Constellation Guard'],
        prefix: ['Lunar', 'Astral', 'Stellar', 'Sacred', 'Vigilant', 'Moonlit'],
        noun: ['Aegis', 'Ward', 'Stance', 'Wall', 'Guard', 'Bulwark'],
        verb: ['Guard', 'Ward', 'Anchor', 'Withstand', 'Reflect', 'Block'],
        capstoneName: 'Avatar of the Warden',
        capstoneDesc: 'Take only 50% damage for 20 sec and counter every melee hit with a Moonfire. 3 min cooldown.',
      },
      {
        id: 'moonpriest', name: 'Moon Priest', role: 'healer', attribute: 'intellect', complexity: 'intermediate',
        description: "Pray beneath the moon's silver gaze — restoring allies with celestial light and lunar grace.",
        signatures: ['Lunar Prayer', 'Moonlight Mending', 'Astral Bloom', 'Restorative Beam', "Heaven's Blessing", 'Crescent Renewal'],
        prefix: ['Lunar', 'Silvered', 'Crescent', 'Sacred', 'Restoring', "Mercy's"],
        noun: ['Prayer', 'Mending', 'Bloom', 'Beam', 'Blessing', 'Renewal'],
        verb: ['Mend', 'Bless', 'Restore', 'Renew', 'Pray', 'Channel'],
        capstoneName: 'Tranquility of the Moon',
        capstoneDesc: 'Channel a 10-sec healing aura that restores 5% max HP every second to all allies within 30 yards. 5 min cooldown.',
      },
      {
        id: 'moonguard', name: 'Moon Guard', role: 'damage', attribute: 'intellect', complexity: 'advanced',
        description: 'Channel the secret arts of the Moon Guard — bending astral fire into apocalyptic spells of arcane fury.',
        signatures: ['Starfire', 'Lunar Strike', 'Comet Storm', 'Stellar Flare', 'Astral Conduit', 'Eclipse Burst'],
        prefix: ['Astral', 'Stellar', 'Cometary', 'Eclipsed', 'Celestial', 'Moon Guard\'s'],
        noun: ['Star', 'Comet', 'Flare', 'Burst', 'Conduit', 'Eclipse'],
        verb: ['Channel', 'Burst', 'Awaken', 'Align', 'Empower', 'Detonate'],
        capstoneName: 'Celestial Alignment',
        capstoneDesc: 'Align with the sun and moon for 20 sec — Solar and Lunar spells deal +30% damage and cost no mana. 3 min cooldown.',
      },
    ],
  },

  tinker: {
    damageType: 'Mechanical',
    classTreeName: 'Path of Tinker',
    classSignatures: ['Rocket Launch', 'Steam Surge', 'Recombobulator', 'Battle Drone', 'Force Bolt', 'Mechanical Mastery'],
    classPrefix: ['Reinforced', 'Tuned', 'Precision', 'Steam-Powered', 'Calibrated', 'Geared'],
    classNoun: ['Gadget', 'Cog', 'Wrench', 'Mechanism', 'Engine', 'Schematic'],
    classVerb: ['Engineer', 'Calibrate', 'Construct', 'Activate', 'Tinker', 'Deploy'],
    classCapstoneName: 'Master Tinker',
    classCapstoneDesc: 'For 20 sec, your gadgets and devices have no cooldown and deal 30% increased damage. 3 min cooldown.',
    specs: [
      {
        id: 'mechanics', name: 'Mechanics', role: 'tank', attribute: 'intellect', complexity: 'normal',
        description: 'Strap into a hardened combat suit, harnessing engineered armor and shielding subroutines to absorb every blow.',
        signatures: ['Power Suit', 'Force Bolt', 'Auto-Riveter', 'Plated Vanguard', 'Repair Bot', 'Defensive Subroutine'],
        prefix: ['Plated', 'Hardened', 'Reinforced', 'Riveted', 'Bulwark-Class', 'Industrial'],
        noun: ['Suit', 'Plating', 'Riveter', 'Vanguard', 'Subroutine', 'Frame'],
        verb: ['Plate', 'Reinforce', 'Engage', 'Withstand', 'Anchor', 'Repair'],
        capstoneName: 'Mecha-Tank Form',
        capstoneDesc: 'Pilot a 20-sec mecha-tank chassis — gain 50% damage reduction and a chest-mounted cannon that fires every 2 seconds. 3 min cooldown.',
      },
      {
        id: 'invention', name: 'Invention', role: 'support', attribute: 'intellect', complexity: 'advanced',
        description: 'Design and deploy ingenious gadgets — turrets, drones, and contraptions that turn the tide of battle.',
        signatures: ['Battle Drone', 'Mechanical Squire', 'Recombobulator', 'Gadget Belt', 'Mechanical Mastery', 'Steam Surge'],
        prefix: ['Inventive', 'Prototype', 'Master', 'Tuned', 'Engineered', "Gadgeteer's"],
        noun: ['Drone', 'Squire', 'Gadget', 'Schematic', 'Contraption', 'Belt'],
        verb: ['Invent', 'Deploy', 'Engineer', 'Activate', 'Construct', 'Tinker'],
        capstoneName: 'Engineered Salvation',
        capstoneDesc: 'Deploy a master toolkit for 25 sec that periodically heals, shields, and buffs all nearby allies. 3 min cooldown.',
      },
      {
        id: 'demolition', name: 'Demolition', role: 'damage', attribute: 'intellect', complexity: 'intermediate',
        description: 'Bombs, rockets, and high-yield ordnance — deliver maximum damage with minimum subtlety.',
        signatures: ['Rocket Launch', 'Flame Cannon', 'Mortar Volley', 'Goblin Bomb', "Tinker's Gambit", 'Hand Cannon'],
        prefix: ['Detonating', 'High-Yield', 'Explosive', 'Volatile', 'Roaring', 'Demo-Class'],
        noun: ['Bomb', 'Rocket', 'Cannon', 'Mortar', 'Charge', 'Volley'],
        verb: ['Detonate', 'Launch', 'Fire', 'Volley', 'Demolish', 'Blow'],
        capstoneName: 'Iron Star',
        capstoneDesc: 'Launch a 30-sec rolling iron star that explodes for massive Mechanical damage on impact and again at end of duration. 3 min cooldown.',
      },
    ],
  },

  runemaster: {
    damageType: 'Rune',
    classTreeName: 'Path of Runemaster',
    classSignatures: ['Sigil of Power', 'Runic Brand', 'Glyphic Weave', 'Stoneward', 'Inscribed Edge', 'Rune Strike'],
    classPrefix: ['Inscribed', 'Engraved', 'Etched', 'Runic', 'Glyphic', 'Sealed'],
    classNoun: ['Rune', 'Glyph', 'Sigil', 'Mark', 'Seal', 'Etching'],
    classVerb: ['Inscribe', 'Etch', 'Engrave', 'Channel', 'Activate', 'Empower'],
    classCapstoneName: 'Master Runemaster',
    classCapstoneDesc: 'For 20 sec, all runes you cast empower their next 3 effects with +50% potency. 3 min cooldown.',
    specs: [
      {
        id: 'engraver', name: 'Engraver', role: 'support', attribute: 'intellect', complexity: 'advanced',
        description: 'Etch ancient sigils into the world itself — your runes empower allies and weaken foes wherever you walk.',
        signatures: ['Engraved Sigil', 'Aegis Rune', 'Empowering Glyph', 'Stoneward', 'Sanctifying Mark', 'Banishing Brand'],
        prefix: ['Engraved', 'Inscribed', "Master's", 'Sanctifying', 'Sovereign', 'Etched'],
        noun: ['Sigil', 'Brand', 'Glyph', 'Stoneward', 'Mark', 'Rune'],
        verb: ['Engrave', 'Inscribe', 'Empower', 'Sanctify', 'Brand', 'Bless'],
        capstoneName: 'Master Engraver',
        capstoneDesc: 'Inscribe the Master Sigil for 30 sec — all party members within 30 yards gain 15% to all stats. 3 min cooldown.',
      },
      {
        id: 'glyphic', name: 'Glyphic', role: 'damage', attribute: 'intellect', complexity: 'normal',
        description: 'Inscribe glyphs of fury onto your foes — every burning glyph detonates with rune-shaped destruction.',
        signatures: ['Burning Rune', 'Sigil of Wrath', 'Etched Strike', 'Stone Spear', 'Rune Volley', 'Mark of Ruin'],
        prefix: ['Burning', 'Searing', 'Wrathful', 'Detonating', 'Volatile', 'Glyph-Burnt'],
        noun: ['Rune', 'Glyph', 'Spear', 'Strike', 'Mark', 'Volley'],
        verb: ['Burn', 'Etch', 'Detonate', 'Inscribe', 'Strike', 'Brand'],
        capstoneName: 'Sigil of Annihilation',
        capstoneDesc: 'Inscribe a 20-yard sigil that detonates after 4 sec for catastrophic Rune damage. 90 sec cooldown.',
      },
      {
        id: 'riftblade', name: 'Riftblade', role: 'damage', attribute: 'strength', complexity: 'intermediate',
        description: 'Wield a blade carved from a dimensional rift — every cut leaves runes shimmering between worlds.',
        signatures: ['Rift Cut', 'Rune Edge', 'Worldbreaker', 'Sigil Slash', 'Dimensional Cleave', 'Riftblade Form'],
        prefix: ['Rift-Forged', 'Dimensional', 'Sigil-Etched', 'Riftborn', 'Carved', 'Sundering'],
        noun: ['Blade', 'Cut', 'Edge', 'Cleave', 'Slash', 'Rift'],
        verb: ['Cleave', 'Cut', 'Carve', 'Sunder', 'Slash', 'Pierce'],
        capstoneName: 'Rift Ascendance',
        capstoneDesc: 'Take Riftblade form for 20 sec — your melee strikes carve open rifts that deal Rune damage in a line. 3 min cooldown.',
      },
    ],
  },

  primalist: {
    damageType: 'Nature',
    classTreeName: 'Path of Primalist',
    classSignatures: ['Primal Rejuvenation', 'Wildcall', 'Natural Bond', 'Earth Bind', 'Primal Surge', 'Wild Strike'],
    classPrefix: ['Primal', 'Wild', 'Untamed', 'Verdant', 'Bound', 'Ancient'],
    classNoun: ['Wild', 'Spirit', 'Roots', 'Beast', 'Stone', 'Bond'],
    classVerb: ['Awaken', 'Bond', 'Channel', 'Speak', 'Summon', 'Empower'],
    classCapstoneName: 'Spirit of the Wild',
    classCapstoneDesc: 'For 20 sec, channel the wild spirit. Gain 25% movement speed, 25% leech, and your Nature spells deal 30% more damage. 3 min cooldown.',
    specs: [
      {
        id: 'grovekeeper', name: 'Grovekeeper', role: 'healer', attribute: 'intellect', complexity: 'intermediate',
        description: 'Tend the sacred grove and channel its life-force into your allies — every leaf is a prayer for the wounded.',
        signatures: ['Verdant Bloom', 'Healing Touch', 'Wild Growth', "Grovekeeper's Mantle", 'Lifebloom', "Nature's Mercy"],
        prefix: ['Verdant', 'Sacred', 'Restoring', 'Living', 'Mossy', "Grove's"],
        noun: ['Bloom', 'Mercy', 'Grove', 'Mantle', 'Touch', 'Bloom'],
        verb: ['Mend', 'Bloom', 'Tend', 'Restore', 'Renew', 'Heal'],
        capstoneName: 'Heart of the Grove',
        capstoneDesc: 'Plant a Heart of the Grove for 20 sec that pulses powerful healing to all allies within 30 yards. 5 min cooldown.',
      },
      {
        id: 'wildwalker', name: 'Wildwalker', role: 'damage', attribute: 'agility', complexity: 'normal',
        description: 'Stalk through the wilds with claw and fang — strike with feral ferocity and primal precision.',
        signatures: ['Feral Pounce', 'Rake', 'Mangle', "Predator's Bite", 'Wildstrike', 'Bestial Cleave'],
        prefix: ['Feral', 'Bestial', 'Wild', 'Untamed', 'Predatory', 'Stalking'],
        noun: ['Claw', 'Fang', 'Pounce', 'Bite', 'Mangle', 'Stalk'],
        verb: ['Pounce', 'Rake', 'Mangle', 'Stalk', 'Bite', 'Cleave'],
        capstoneName: 'Avatar of the Wild',
        capstoneDesc: 'Take a Wildwalker beast form for 20 sec — gain 30% movement speed, 30% leech, and your melee deals Nature damage. 3 min cooldown.',
      },
      {
        id: 'mountainking', name: 'Mountain King', role: 'tank', attribute: 'strength', complexity: 'intermediate',
        description: 'Become an immovable mountain of stone-flesh — root yourself to the bedrock and refuse to fall.',
        signatures: ['Stoneform', 'Earthbond', "Mountain's Pride", 'Iron Bark', 'Stoneskin', 'Granite Aegis'],
        prefix: ['Granite', 'Stoneborn', 'Immovable', 'Earthbound', "Mountain's", 'Iron'],
        noun: ['Stone', 'Mountain', 'Bark', 'Aegis', 'Skin', 'Bedrock'],
        verb: ['Root', 'Anchor', 'Withstand', 'Endure', 'Stand', 'Bind'],
        capstoneName: 'Living Mountain',
        capstoneDesc: 'Become a Living Mountain for 20 sec — take only 40% damage and deal Nature damage to attackers. 3 min cooldown.',
      },
      {
        id: 'geomancy', name: 'Geomancy', role: 'damage', attribute: 'intellect', complexity: 'advanced',
        description: "Command the very stones beneath your enemies' feet — earthquakes, lava, and tectonic fury answer your call.",
        signatures: ['Earthshock', 'Lava Burst', 'Quake', 'Magma Spike', 'Tectonic Wrath', 'Stoneblade'],
        prefix: ['Tectonic', 'Magma', 'Quaking', 'Volcanic', 'Stoneborn', 'Seismic'],
        noun: ['Quake', 'Magma', 'Spike', 'Lava', 'Shockwave', 'Tremor'],
        verb: ['Erupt', 'Shake', 'Quake', 'Burst', 'Sunder', 'Hurl'],
        capstoneName: 'Cataclysm of the Earth',
        capstoneDesc: 'Tear open a 20-yard fissure for 12 sec that erupts magma every 2 sec, dealing massive Nature damage. 3 min cooldown.',
      },
    ],
  },

  reaper: {
    damageType: 'Shadow',
    classTreeName: 'Path of Reaper',
    classSignatures: ['Soul Reap', 'Phantom Strike', 'Shadow Step', 'Reaping Cleave', 'Soul Tether', 'Death Strike'],
    classPrefix: ['Phantom', 'Shadowed', 'Soul-Bound', "Reaper's", 'Withering', 'Spectral'],
    classNoun: ['Soul', 'Phantom', 'Scythe', 'Shade', 'Wraith', 'Reaping'],
    classVerb: ['Reap', 'Sever', 'Harvest', 'Drain', 'Stalk', 'Bind'],
    classCapstoneName: 'Avatar of the Reaper',
    classCapstoneDesc: 'Take Reaper form for 20 sec — gain 30% haste and your strikes drain the souls of foes for additional Shadow damage. 3 min cooldown.',
    specs: [
      {
        id: 'soul', name: 'Soul', role: 'damage', attribute: 'agility', complexity: 'intermediate',
        description: 'Cleave the souls from your enemies with a phantom scythe — devour their essence to grow ever stronger.',
        signatures: ['Soul Reap', 'Phantom Strike', 'Soul Tether', "Reaper's Mark", 'Soulrend', 'Soul Harvest'],
        prefix: ['Soulbound', 'Phantom', 'Spectral', 'Withering', 'Unliving', 'Soul-Drained'],
        noun: ['Soul', 'Phantom', 'Tether', 'Mark', 'Wraith', 'Echo'],
        verb: ['Reap', 'Tether', 'Sever', 'Drain', 'Harvest', 'Mark'],
        capstoneName: "Soulreaper's Embrace",
        capstoneDesc: 'Mark all visible enemies for 20 sec — killing a marked target restores 15% max HP and 1 cooldown. 3 min cooldown.',
      },
      {
        id: 'harvest', name: 'Harvest', role: 'damage', attribute: 'agility', complexity: 'normal',
        description: 'Reap your foes like wheat at harvest-time — wide cleaving sweeps that fell entire ranks at once.',
        signatures: ['Harvest Sweep', 'Black Sickle', 'Death Slash', 'Sever', 'Whirling Scythe', 'Final Reaping'],
        prefix: ['Harvesting', 'Sweeping', 'Whirling', 'Black', 'Reaping', 'Final'],
        noun: ['Sweep', 'Sickle', 'Scythe', 'Slash', 'Reaping', 'Whirlwind'],
        verb: ['Sweep', 'Reap', 'Whirl', 'Slash', 'Sever', 'Cleave'],
        capstoneName: 'Bountiful Harvest',
        capstoneDesc: 'Whirl your scythe in a 12-sec frenzy — every strike heals you for 5% of damage dealt. 3 min cooldown.',
      },
      {
        id: 'domination', name: 'Domination', role: 'damage', attribute: 'agility', complexity: 'advanced',
        description: 'Bind the souls of the slain to your will — every kill makes you swifter, stronger, deadlier.',
        signatures: ['Soul Bind', 'Domination Strike', "Reaper's Call", 'Phantom Veil', 'Shadow Step', 'Reaper Lord'],
        prefix: ['Dominating', 'Sovereign', "Tyrant's", "Lord's", "Reaper's", 'Binding'],
        noun: ['Dominion', 'Bind', 'Veil', 'Call', 'Strike', 'Tyranny'],
        verb: ['Bind', 'Dominate', 'Command', 'Step', 'Sever', 'Bend'],
        capstoneName: "Reaper's Dominion",
        capstoneDesc: "Drag every nearby soul into a 20-sec domain of death — gain 30% haste and reflect 20% damage taken. 3 min cooldown.",
      },
    ],
  },

  venomancer: {
    damageType: 'Poison',
    classTreeName: 'Path of Venomancer',
    classSignatures: ['Venom Spit', 'Brood Call', 'Web Trap', 'Toxin Lance', 'Spider Bite', 'Cocoon'],
    classPrefix: ['Venomous', 'Toxic', 'Webbed', 'Brooded', 'Spinneret', 'Shadra-Touched'],
    classNoun: ['Venom', 'Web', 'Brood', 'Spinneret', 'Toxin', 'Cocoon'],
    classVerb: ['Spin', 'Spit', 'Bind', 'Brood', 'Envenom', 'Hatch'],
    classCapstoneName: 'Avatar of Shadra',
    classCapstoneDesc: 'For 20 sec, take Avatar of Shadra form — gain 30% haste, your strikes apply Poison, and your spells cost no resource. 3 min cooldown.',
    specs: [
      {
        id: 'fortitude', name: 'Fortitude', role: 'tank', attribute: 'stamina', complexity: 'intermediate',
        description: 'Build a venom-laced fortress of body and will — let your toxic blood deter every attacker.',
        signatures: ['Venom Skin', 'Toxin Bond', 'Spider Hide', 'Cocoon', "Shadra's Aegis", 'Webwalker'],
        prefix: ['Venom-Skinned', 'Toxic', 'Webbed', 'Hardened', 'Cocooned', 'Shadra-Touched'],
        noun: ['Skin', 'Hide', 'Aegis', 'Cocoon', 'Bond', 'Carapace'],
        verb: ['Withstand', 'Anchor', 'Cocoon', 'Endure', 'Bind', 'Reflect'],
        capstoneName: 'Avatar of Venom',
        capstoneDesc: 'Become a Venom Avatar for 20 sec — take 40% less damage and poison every melee attacker. 3 min cooldown.',
      },
      {
        id: 'stalking', name: 'Stalking', role: 'damage', attribute: 'agility', complexity: 'normal',
        description: 'Stalk silently through shadow and spinneret — strike fast, withdraw faster, leaving only venom behind.',
        signatures: ['Silken Strike', 'Venom Spit', 'Shadowstep', "Stalker's Mark", 'Hidden Strike', 'Spider Bite'],
        prefix: ['Silken', 'Hidden', 'Stalking', 'Silent', "Spinneret's", 'Shadowed'],
        noun: ['Strike', 'Mark', 'Bite', 'Step', 'Veil', 'Stalker'],
        verb: ['Stalk', 'Strike', 'Step', 'Bite', 'Vanish', 'Mark'],
        capstoneName: "Spider Queen's Stalker",
        capstoneDesc: 'Vanish for 8 sec in spider-shadow — your next strike is a guaranteed crit for +200% Poison damage. 90 sec cooldown.',
      },
      {
        id: 'rotweaver', name: 'Rotweaver', role: 'damage', attribute: 'intellect', complexity: 'intermediate',
        description: 'Spin webs of necrotic rot and weeping toxin — your enemies wither in a tapestry of decay.',
        signatures: ['Rot Bolt', 'Weeping Web', 'Necrotic Strand', 'Festering Brood', 'Decay Field', 'Pestilence Bind'],
        prefix: ['Rotting', 'Weeping', 'Necrotic', 'Pestilent', 'Decaying', 'Festering'],
        noun: ['Rot', 'Web', 'Strand', 'Brood', 'Decay', 'Pestilence'],
        verb: ['Rot', 'Weep', 'Spin', 'Decay', 'Fester', 'Bind'],
        capstoneName: "Rotweaver's Bloom",
        capstoneDesc: 'All your damage-over-time effects detonate at once for massive Poison damage. 3 min cooldown.',
      },
      {
        id: 'vizier', name: 'Vizier', role: 'support', attribute: 'intellect', complexity: 'advanced',
        description: 'Whisper to the brood — command spider-spawn and venom-priests with the cunning of a venomous court.',
        signatures: ['Brood Call', "Vizier's Edict", 'Royal Toxin', 'Spider Council', 'Spawn Eternal', 'Web Tribute'],
        prefix: ['Royal', "Vizier's", 'Brood-Marked', 'Sovereign', 'Court', 'Eternal'],
        noun: ['Brood', 'Edict', 'Tribute', 'Council', 'Spawn', 'Court'],
        verb: ['Command', 'Edict', 'Summon', 'Spawn', 'Preside', 'Hatch'],
        capstoneName: "Vizier's Court",
        capstoneDesc: 'Summon a 30-sec court of venomous spawn that fight by your side and inflict Poison on foes. 3 min cooldown.',
      },
    ],
  },

  chronomancer: {
    damageType: 'Arcane',
    classTreeName: 'Path of Chronomancer',
    classSignatures: ['Time Warp', 'Quicken', 'Slow Time', 'Chronoshift', 'Past Self', 'Temporal Lance'],
    classPrefix: ['Temporal', 'Chronal', 'Echoed', 'Looping', 'Forever', 'Quickening'],
    classNoun: ['Echo', 'Hour', 'Loop', 'Sand', 'Past', 'Future'],
    classVerb: ['Loop', 'Echo', 'Quicken', 'Anchor', 'Channel', 'Rewind'],
    classCapstoneName: 'Master of Time',
    classCapstoneDesc: 'For 20 sec, your spells echo 1 second later for 50% damage. 3 min cooldown.',
    specs: [
      {
        id: 'infinite', name: 'Infinite', role: 'damage', attribute: 'intellect', complexity: 'advanced',
        description: 'Channel the Infinite Dragonflight — bend timelines, rewind history, erase enemies from existence.',
        signatures: ['Infinity Bolt', "Murozond's Hourglass", 'Erase', 'Final Echo', 'Time Stop', 'Timeless Strike'],
        prefix: ['Infinite', "Murozond's", 'Final', 'Erasing', 'Endless', 'Sovereign'],
        noun: ['Infinity', 'Hourglass', 'Echo', 'Stop', 'Erasure', 'Strike'],
        verb: ['Erase', 'Loop', 'Echo', 'Stop', 'Bend', 'Sever'],
        capstoneName: 'Time Lord',
        capstoneDesc: 'Take Infinite Dragon form for 20 sec — your spells cost no mana, and your damage is increased by 40%. 3 min cooldown.',
      },
      {
        id: 'time', name: 'Time', role: 'support', attribute: 'intellect', complexity: 'intermediate',
        description: 'Manipulate the flow of time itself — slow your foes, hasten your allies, rewind catastrophe.',
        signatures: ['Time Warp', 'Stasis Field', 'Slow Time', 'Quicken', 'Echo Veil', 'Past Self'],
        prefix: ['Quickened', 'Slowed', 'Stasis', 'Echoed', 'Temporal', 'Anchored'],
        noun: ['Warp', 'Field', 'Veil', 'Past', 'Echo', 'Anchor'],
        verb: ['Warp', 'Slow', 'Quicken', 'Echo', 'Anchor', 'Rewind'],
        capstoneName: 'Eternal Stasis',
        capstoneDesc: 'Lock 5 enemies in stasis for 8 sec — they cannot act, take damage, or be targeted. 3 min cooldown.',
      },
      {
        id: 'artificer', name: 'Artificer', role: 'damage', attribute: 'intellect', complexity: 'normal',
        description: 'Craft chronoshards and arcane artifacts — every spell echoes through future and past.',
        signatures: ['Chrono Spear', 'Hourglass Strike', 'Echo Shot', 'Stutter', 'Artifact Bolt', 'Recursion'],
        prefix: ['Crafted', "Artificer's", 'Recursive', 'Echoing', 'Stuttering', 'Forever'],
        noun: ['Spear', 'Strike', 'Shot', 'Stutter', 'Bolt', 'Recursion'],
        verb: ['Craft', 'Echo', 'Stutter', 'Recur', 'Channel', 'Anchor'],
        capstoneName: 'Recursion Engine',
        capstoneDesc: 'Your next 6 spells fire twice — once now and once 2 sec later. 90 sec cooldown.',
      },
    ],
  },

  bloodmage: {
    damageType: 'Blood',
    classTreeName: 'Path of Bloodmage',
    classSignatures: ['Blood Bolt', 'Crimson Lance', 'Sanguine Pact', 'Hemorrhage', 'Vital Drain', 'Lifeblood Surge'],
    classPrefix: ['Crimson', 'Sanguine', 'Bloodbound', 'Vital', 'Lifeblood', 'Hemorrhagic'],
    classNoun: ['Blood', 'Crimson', 'Vein', 'Pact', 'Lifeblood', 'Chalice'],
    classVerb: ['Spill', 'Bleed', 'Drain', 'Bond', 'Channel', 'Knit'],
    classCapstoneName: 'Avatar of Blood',
    classCapstoneDesc: 'For 20 sec, your Blood spells deal 30% increased damage and you heal for 30% of damage dealt. 3 min cooldown.',
    specs: [
      {
        id: 'fleshweaver', name: 'Fleshweaver', role: 'healer', attribute: 'intellect', complexity: 'advanced',
        description: 'Knit flesh and weave blood — restore the wounded with the dark gift of crimson alchemy.',
        signatures: ['Flesh Mend', 'Bloodknit', 'Sanguine Bloom', 'Crimson Salve', 'Vital Suture', 'Lifeblood Surge'],
        prefix: ['Knitting', 'Restoring', 'Crimson', 'Vital', 'Suture-Bound', "Mercy's"],
        noun: ['Mend', 'Bloom', 'Salve', 'Suture', 'Knit', 'Surge'],
        verb: ['Mend', 'Knit', 'Suture', 'Bloom', 'Restore', 'Channel'],
        capstoneName: "Fleshweaver's Mercy",
        capstoneDesc: 'Channel for 12 sec, restoring 8% max HP per second to your most wounded ally. 5 min cooldown.',
      },
      {
        id: 'sanguine', name: 'Sanguine', role: 'damage', attribute: 'intellect', complexity: 'intermediate',
        description: "Spill your own blood and your enemies' alike — every drop is fuel for your sanguine sorcery.",
        signatures: ['Bloodbolt', 'Sanguine Strike', 'Hemorrhage', 'Crimson Lash', 'Blood Boil', 'Vein Burst'],
        prefix: ['Bleeding', 'Sanguine', 'Hemorrhagic', 'Crimson', 'Boiling', 'Spilled'],
        noun: ['Blood', 'Strike', 'Lash', 'Boil', 'Burst', 'Wound'],
        verb: ['Bleed', 'Spill', 'Lash', 'Boil', 'Burst', 'Hemorrhage'],
        capstoneName: 'Crimson Tide',
        capstoneDesc: 'Erupt with 18 sec of crimson rain — deals Blood damage every second and heals you for 50% of damage dealt. 3 min cooldown.',
      },
      {
        id: 'accursed', name: 'Accursed', role: 'damage', attribute: 'intellect', complexity: 'normal',
        description: 'Curse your enemies with afflictions of blood — their hearts beat against them, their veins betray them.',
        signatures: ['Curse of Vitality', 'Accursed Mark', 'Blood Hex', 'Crimson Doom', 'Vein Curse', 'Bleeding Verdict'],
        prefix: ['Accursed', 'Cursed', 'Hexed', 'Doomed', 'Marked', 'Bleeding'],
        noun: ['Curse', 'Hex', 'Mark', 'Doom', 'Verdict', 'Affliction'],
        verb: ['Curse', 'Hex', 'Mark', 'Doom', 'Bleed', 'Afflict'],
        capstoneName: 'Accursed Verdict',
        capstoneDesc: 'All your curses on visible enemies detonate for massive Blood damage. 90 sec cooldown.',
      },
      {
        id: 'eternal', name: 'Eternal', role: 'tank', attribute: 'stamina', complexity: 'advanced',
        description: 'Drink from the chalice of eternity — let blood-magic make your body unbreakable, your wounds unending.',
        signatures: ['Eternal Chalice', 'Vampiric Aura', 'Blood Aegis', 'Crimson Skin', 'Lifesteal Bond', 'Undying Vow'],
        prefix: ['Eternal', 'Undying', 'Vampiric', 'Crimson', 'Bound', 'Lifesteal'],
        noun: ['Chalice', 'Aura', 'Aegis', 'Skin', 'Bond', 'Vow'],
        verb: ['Endure', 'Drink', 'Bind', 'Withstand', 'Channel', 'Anchor'],
        capstoneName: 'Eternal Lifeblood',
        capstoneDesc: 'Become Eternal for 20 sec — heal for 100% of all damage you deal and take 50% less damage. 3 min cooldown.',
      },
    ],
  },

  guardian: {
    damageType: 'Holy',
    classTreeName: 'Path of Guardian',
    classSignatures: ['Shield Bash', 'Hammer of Justice', 'Devotion Aura', 'Stalwart Strike', 'Sanctuary', 'Last Stand'],
    classPrefix: ['Sacred', 'Stalwart', 'Vigilant', 'Eternal', "Bulwark's", 'Hallowed'],
    classNoun: ['Aura', 'Standard', 'Vigil', 'Vow', 'Aegis', 'Sentinel'],
    classVerb: ['Bless', 'Inspire', 'Guard', 'Anchor', 'Lead', 'Watch'],
    classCapstoneName: 'Avatar of the Guardian',
    classCapstoneDesc: 'For 20 sec, become a Guardian Avatar — gain 50% damage reduction and increase nearby allies\' healing received by 30%. 3 min cooldown.',
    specs: [
      {
        id: 'gladiator', name: 'Gladiator', role: 'damage', attribute: 'strength', complexity: 'normal',
        description: 'Trade the shield for a second weapon — wade into the melee with a gladiator\'s relentless aggression.',
        signatures: ["Gladiator's Charge", 'Heroic Cleave', 'Mortal Strike', 'Gladiator Stance', 'Bloodthirst', 'Decisive Blow'],
        prefix: ['Heroic', 'Brutal', 'Decisive', 'Charging', "Gladiator's", 'Mortal'],
        noun: ['Charge', 'Cleave', 'Strike', 'Stance', 'Blow', 'Slash'],
        verb: ['Charge', 'Cleave', 'Strike', 'Slam', 'Bash', 'Slash'],
        capstoneName: 'Avatar of the Gladiator',
        capstoneDesc: 'Take Gladiator Form for 20 sec — gain 25% damage and 25% movement speed. 3 min cooldown.',
      },
      {
        id: 'inspiration', name: 'Inspiration', role: 'support', attribute: 'intellect', complexity: 'intermediate',
        description: 'Lead by example and rally your allies — your aura turns ordinary soldiers into legends.',
        signatures: ['Aura of Vigor', 'Blessing of Light', 'Holy Standard', 'Vigilance', 'Inspiration', "Watcher's Eye"],
        prefix: ['Inspiring', 'Vigilant', 'Hallowed', 'Heroic', 'Watchful', 'Sacred'],
        noun: ['Aura', 'Blessing', 'Standard', 'Vigil', 'Eye', 'Inspiration'],
        verb: ['Inspire', 'Bless', 'Watch', 'Lead', 'Rally', 'Empower'],
        capstoneName: 'Beacon of Light',
        capstoneDesc: 'Plant the Beacon for 25 sec — all allies within 40 yards heal 3% max HP every 2 sec and gain 10% damage. 3 min cooldown.',
      },
      {
        id: 'vanguard', name: 'Vanguard', role: 'tank', attribute: 'stamina', complexity: 'normal',
        description: 'Stand at the front of the line — your shield is unbreakable, your courage immovable.',
        signatures: ['Shield Bash', 'Bulwark', 'Sanctuary', 'Iron Will', 'Bastion', 'Last Stand'],
        prefix: ['Iron', 'Vigilant', "Bulwark's", 'Stalwart', 'Eternal', "Vanguard's"],
        noun: ['Bulwark', 'Bastion', 'Sanctuary', 'Aegis', 'Stand', 'Shield'],
        verb: ['Stand', 'Anchor', 'Withstand', 'Guard', 'Shield', 'Endure'],
        capstoneName: 'Eternal Bulwark',
        capstoneDesc: 'Become an Eternal Bulwark for 20 sec — take 50% less damage and absorb the next 5 critical strikes. 3 min cooldown.',
      },
    ],
  },

  stormbringer: {
    damageType: 'Lightning',
    classTreeName: 'Path of Stormbringer',
    classSignatures: ['Lightning Bolt', 'Chain Lightning', 'Stormstrike', 'Thunderclap', 'Static Charge', 'Tempest'],
    classPrefix: ['Storm-Wrought', 'Thunderous', 'Tempestuous', 'Charged', 'Surging', 'Galeborn'],
    classNoun: ['Storm', 'Lightning', 'Thunder', 'Tempest', 'Wind', 'Gale'],
    classVerb: ['Strike', 'Surge', 'Channel', 'Awaken', 'Unleash', 'Ride'],
    classCapstoneName: 'Avatar of the Storm',
    classCapstoneDesc: 'For 20 sec, become an Avatar of the Storm — your spells deal Lightning damage and your strikes shock with chain lightning. 3 min cooldown.',
    specs: [
      {
        id: 'maelstrom', name: 'Maelstrom', role: 'damage', attribute: 'intellect', complexity: 'intermediate',
        description: 'Conjure a churning maelstrom of lightning, water, and wind — overwhelm foes with elemental fury.',
        signatures: ['Maelstrom Surge', 'Tempest Vortex', 'Squall Burst', "Stormcaller's Fury", 'Maelstrom Bolt', 'Eye of the Storm'],
        prefix: ['Churning', 'Vortex', "Maelstrom's", 'Squalling', 'Roaring', 'Storm-Eyed'],
        noun: ['Maelstrom', 'Vortex', 'Squall', 'Surge', 'Eye', 'Tempest'],
        verb: ['Churn', 'Surge', 'Vortex', 'Squall', 'Roar', 'Awaken'],
        capstoneName: 'Living Storm',
        capstoneDesc: 'Become a Living Storm for 20 sec — every action discharges a Lightning Bolt at the nearest enemy. 3 min cooldown.',
      },
      {
        id: 'lightning', name: 'Lightning', role: 'damage', attribute: 'intellect', complexity: 'normal',
        description: 'Hurl pure lightning from sky to earth — direct, brilliant, devastating.',
        signatures: ['Lightning Bolt', 'Chain Lightning', 'Thunderstorm', 'Stormstrike', 'Static Charge', 'Thunderclap'],
        prefix: ['Charged', 'Static', 'Crackling', 'Roaring', 'Forked', 'Thunderous'],
        noun: ['Bolt', 'Chain', 'Storm', 'Charge', 'Thunderclap', 'Strike'],
        verb: ['Strike', 'Chain', 'Charge', 'Hurl', 'Crackle', 'Thunder'],
        capstoneName: "Stormcaller's Wrath",
        capstoneDesc: 'Call down a 12-sec lightning storm — every 1 sec a bolt strikes a random enemy in 30 yards for massive Lightning damage. 90 sec cooldown.',
      },
      {
        id: 'wind', name: 'Wind', role: 'support', attribute: 'agility', complexity: 'advanced',
        description: 'Ride the wind itself — flow between battles, carrying your allies on the breath of the storm.',
        signatures: ['Wind Walk', 'Tailwind', 'Wind Wall', 'Cyclone', 'Wind Whisper', 'Gale Force'],
        prefix: ['Galeborn', 'Soaring', 'Riding', "Tailwind's", 'Whispered', 'Cyclonic'],
        noun: ['Wind', 'Gale', 'Tailwind', 'Wall', 'Cyclone', 'Whisper'],
        verb: ['Ride', 'Soar', 'Whisper', 'Cycle', 'Carry', 'Flow'],
        capstoneName: 'Master of the Winds',
        capstoneDesc: 'Grant your party Master of the Winds for 20 sec — +30% movement speed and +20% haste. 3 min cooldown.',
      },
    ],
  },

  felsworn: {
    damageType: 'Fel',
    classTreeName: 'Path of Felsworn',
    classSignatures: ['Felblade', "Demon's Bite", 'Chaos Strike', 'Hellfire', 'Fel Rush', 'Soul Cleave'],
    classPrefix: ['Fel-Burnt', 'Infernal', 'Demonic', 'Sworn', 'Pit-Forged', 'Damned'],
    classNoun: ['Fel', 'Demon', 'Pit', 'Infernal', 'Pact', 'Sigil'],
    classVerb: ['Burn', 'Cleave', 'Bind', 'Empower', 'Devour', 'Sever'],
    classCapstoneName: 'Avatar of the Fel',
    classCapstoneDesc: 'Take Fel Avatar form for 20 sec — your strikes ignite enemies with Fel-fire and you regenerate 5% HP per second. 3 min cooldown.',
    specs: [
      {
        id: 'slaying', name: 'Slaying', role: 'damage', attribute: 'agility', complexity: 'normal',
        description: 'Wield twin warglaives like an avatar of slaughter — every cut bleeds fel and ends a life.',
        signatures: ['Felblade', "Demon's Bite", 'Chaos Strike', 'Annihilation', 'Felblade Whirl', 'Fel Rush'],
        prefix: ['Slaying', 'Bloodthirsty', 'Annihilating', 'Twin-Glaive', 'Frenzied', "Demon's"],
        noun: ['Glaive', 'Strike', 'Cut', 'Bite', 'Whirl', 'Rush'],
        verb: ['Slay', 'Cleave', 'Cut', 'Whirl', 'Rush', 'Bite'],
        capstoneName: 'Eye of the Slayer',
        capstoneDesc: 'Enter Slaying Frenzy for 20 sec — gain 30% haste and your melee strikes deal Fel damage. 3 min cooldown.',
      },
      {
        id: 'infernal', name: 'Infernal', role: 'damage', attribute: 'intellect', complexity: 'intermediate',
        description: 'Summon infernals from the Twisting Nether — call down hellish meteors and pillars of fel-fire.',
        signatures: ['Summon Infernal', 'Infernal Strike', 'Hellfire', 'Fel Meteor', "Pit Lord's Call", 'Brimstone Burst'],
        prefix: ['Infernal', 'Brimstone', 'Pit-Born', 'Hellish', 'Meteoric', "Pyre's"],
        noun: ['Infernal', 'Hellfire', 'Meteor', 'Brimstone', 'Pillar', 'Burst'],
        verb: ['Summon', 'Hurl', 'Burn', 'Erupt', 'Empower', 'Call'],
        capstoneName: 'Cataclysm Infernal',
        capstoneDesc: 'Summon a Greater Infernal that fights for 30 sec and deals Fel damage in a 10-yard radius around it. 5 min cooldown.',
      },
      {
        id: 'tyrant', name: 'Tyrant', role: 'tank', attribute: 'stamina', complexity: 'advanced',
        description: 'Become a Demon Tyrant — your fel-corrupted hide weathers any blow, your presence terrifies your foes.',
        signatures: ['Demon Spikes', 'Soul Cleave', 'Spectral Sight', 'Pit Pact', 'Fel Aegis', 'Bulwark of Fel'],
        prefix: ["Tyrant's", 'Pit-Forged', 'Demonic', 'Spectral', 'Damned', 'Eternal'],
        noun: ['Spike', 'Cleave', 'Aegis', 'Bulwark', 'Pact', 'Skin'],
        verb: ['Endure', 'Cleave', 'Anchor', 'Devour', 'Withstand', 'Bind'],
        capstoneName: 'Demonic Tyrant',
        capstoneDesc: 'Take Tyrant form for 20 sec — gain 50% damage reduction and double max HP. 3 min cooldown.',
      },
    ],
  },

  barbarian: {
    damageType: 'Physical',
    classTreeName: 'Path of Barbarian',
    classSignatures: ['Whirlwind', 'Berserker Rage', 'Heroic Throw', 'Slam', 'Cleave', 'Battle Shout'],
    classPrefix: ['Savage', 'Brutal', 'Frenzied', 'Roaring', 'Bloodthirsty', 'Tribal'],
    classNoun: ['Rage', 'Frenzy', 'Roar', 'Slam', 'Cleave', 'Trophy'],
    classVerb: ['Roar', 'Smash', 'Cleave', 'Charge', 'Rage', 'Hunt'],
    classCapstoneName: 'Avatar of War',
    classCapstoneDesc: 'For 20 sec, take Avatar form — gain 30% damage and 20% size, your strikes cleave nearby foes. 3 min cooldown.',
    specs: [
      {
        id: 'brutality', name: 'Brutality', role: 'damage', attribute: 'strength', complexity: 'normal',
        description: 'Crush, cleave, and shatter — the Brutality path is pure savage destruction unleashed in close quarters.',
        signatures: ['Whirlwind', 'Cleave', 'Mortal Strike', 'Berserker Rage', 'Heroic Throw', 'Slam'],
        prefix: ['Brutal', 'Savage', 'Crushing', 'Heroic', 'Mortal', 'Bone-Cracking'],
        noun: ['Whirlwind', 'Cleave', 'Strike', 'Throw', 'Slam', 'Smash'],
        verb: ['Smash', 'Cleave', 'Crush', 'Whirl', 'Slam', 'Strike'],
        capstoneName: 'Avatar of War',
        capstoneDesc: 'Take Avatar form for 20 sec — gain 30% damage and 20% size, your strikes cleave nearby foes. 3 min cooldown.',
      },
      {
        id: 'headhunting', name: 'Headhunting', role: 'damage', attribute: 'agility', complexity: 'intermediate',
        description: 'Hunt your enemies for trophies — every kill empowers you, every head taken brings you closer to legend.',
        signatures: ["Headhunter's Mark", 'Trophy Strike', "Hunter's Charge", 'Bone Cleaver', 'Skullcracker', 'Bloodthirsty Pursuit'],
        prefix: ["Headhunter's", 'Trophy', 'Bone-Cracking', 'Tribal', 'Pursuing', 'Bloodthirsty'],
        noun: ['Trophy', 'Mark', 'Charge', 'Cleaver', 'Pursuit', 'Skull'],
        verb: ['Hunt', 'Take', 'Crack', 'Charge', 'Mark', 'Pursue'],
        capstoneName: 'Trophy of Champions',
        capstoneDesc: 'For 20 sec, every kill grants you 5% haste, 5% damage, and 5% max HP, stacking up to 10. 3 min cooldown.',
      },
      {
        id: 'ancestry', name: 'Ancestry', role: 'support', attribute: 'spirit', complexity: 'advanced',
        description: 'Call upon the spirits of fallen warriors — your ancestors fight beside you and bless your weapon.',
        signatures: ['Ancestral Roar', 'Spirit War Cry', 'Ghostly Vanguard', "Forefather's Blessing", 'War Drum', 'Spirit Bond'],
        prefix: ['Ancestral', "Forefather's", 'Ghostly', 'Spirit-Bound', 'Tribal', 'Eternal'],
        noun: ['Roar', 'Cry', 'Vanguard', 'Blessing', 'Drum', 'Bond'],
        verb: ['Roar', 'Call', 'Bless', 'Empower', 'Bond', 'Drum'],
        capstoneName: 'Spirits of the Tribe',
        capstoneDesc: 'Summon 5 ancestor spirit warriors that fight beside you for 30 sec. 5 min cooldown.',
      },
    ],
  },

  witchdoctor: {
    damageType: 'Nature',
    classTreeName: 'Path of Witch Doctor',
    classSignatures: ['Hex Bolt', 'Spirit Lance', 'Voodoo Doll', 'Loa Mark', 'Healing Brew', 'Curse of Loa'],
    classPrefix: ['Voodoo', 'Loa-Touched', 'Hexed', 'Tribal', 'Spirit-Bound', 'Brewing'],
    classNoun: ['Hex', 'Voodoo', 'Loa', 'Spirit', 'Doll', 'Brew'],
    classVerb: ['Hex', 'Brew', 'Summon', 'Curse', 'Channel', 'Bond'],
    classCapstoneName: 'Avatar of the Loa',
    classCapstoneDesc: 'For 20 sec, take Loa form — your spells deal 30% increased damage and your strikes apply Voodoo Curse. 3 min cooldown.',
    specs: [
      {
        id: 'shadowhunting', name: 'Shadowhunting', role: 'damage', attribute: 'agility', complexity: 'intermediate',
        description: 'Stalk the spirit world with javelin and hex — strike from the shadows of the loa.',
        signatures: ['Spirit Javelin', 'Loa Strike', "Shadowhunter's Mark", 'Voodoo Dart', 'Hex of the Hunt', 'Spirit Pounce'],
        prefix: ["Shadowhunter's", 'Spirit', 'Stalking', 'Loa-Touched', 'Hidden', 'Hexed'],
        noun: ['Javelin', 'Strike', 'Mark', 'Dart', 'Hunt', 'Pounce'],
        verb: ['Hunt', 'Strike', 'Mark', 'Pounce', 'Dart', 'Stalk'],
        capstoneName: 'Spirit of the Loa',
        capstoneDesc: 'Take Loa Beast form for 20 sec — gain 30% damage, 30% movement speed, and your strikes inflict Hex. 3 min cooldown.',
      },
      {
        id: 'voodoo', name: 'Voodoo', role: 'damage', attribute: 'intellect', complexity: 'normal',
        description: 'Master the dark arts of voodoo — dolls, hexes, and toxic rituals tear your enemies apart.',
        signatures: ['Voodoo Doll', 'Hex Bolt', 'Spirit Lance', 'Toxin Spit', 'Curse of the Loa', 'Cripple Curse'],
        prefix: ['Voodoo', 'Hexed', 'Cursed', 'Crippling', 'Toxic', 'Lethal'],
        noun: ['Doll', 'Hex', 'Lance', 'Curse', 'Bolt', 'Spit'],
        verb: ['Hex', 'Curse', 'Cripple', 'Spit', 'Bind', 'Mark'],
        capstoneName: 'Voodoo Lord',
        capstoneDesc: 'Plant a Voodoo Doll on each visible enemy for 20 sec — every strike on you also damages them. 90 sec cooldown.',
      },
      {
        id: 'brewing', name: 'Brewing', role: 'healer', attribute: 'spirit', complexity: 'advanced',
        description: 'Brew restorative concoctions from grave-herbs and spirit-water — your potions can mend any wound.',
        signatures: ['Healing Brew', 'Reviving Tincture', 'Spirit Salve', "Loa's Ferment", "Witch's Cauldron", 'Curative Vapors'],
        prefix: ['Brewed', 'Reviving', 'Restoring', "Cauldron's", "Loa's", "Mercy's"],
        noun: ['Brew', 'Tincture', 'Salve', 'Ferment', 'Cauldron', 'Vapor'],
        verb: ['Brew', 'Restore', 'Mend', 'Revive', 'Pour', 'Channel'],
        capstoneName: 'Cauldron of the Loa',
        capstoneDesc: 'Brew a 20-sec cauldron at your feet — allies within 15 yards heal 4% max HP per second. 5 min cooldown.',
      },
    ],
  },

  witchhunter: {
    damageType: 'Holy',
    classTreeName: 'Path of Witch Hunter',
    classSignatures: ['Holy Bullet', 'Silver Bolt', 'Banishing Brand', 'Inquisition', 'Witch Tracker', 'Sanctified Mark'],
    classPrefix: ['Sanctified', 'Hallowed', 'Banishing', 'Pure-Silver', 'Holy', "Inquisitor's"],
    classNoun: ['Banishing', 'Inquisition', 'Mark', 'Brand', 'Stake', 'Silver'],
    classVerb: ['Banish', 'Hunt', 'Mark', 'Inscribe', 'Sanctify', 'Empower'],
    classCapstoneName: 'Avatar of the Inquisition',
    classCapstoneDesc: 'For 20 sec, take Inquisitor form — your spells deal 30% increased Holy damage and you reveal stealthed enemies. 3 min cooldown.',
    specs: [
      {
        id: 'boltslinger', name: 'Boltslinger', role: 'damage', attribute: 'agility', complexity: 'normal',
        description: "Sling silver bolt and holy bullet from twin pistols — the witch's friend dies in a hail of sanctified lead.",
        signatures: ['Holy Bullet', 'Silver Bolt', 'Twin Pistols', 'Quickdraw', 'Penetrating Round', 'Sanctified Volley'],
        prefix: ['Quickdraw', 'Twin-Barreled', 'Silver', 'Holy', 'Sanctified', 'Penetrating'],
        noun: ['Bullet', 'Bolt', 'Round', 'Volley', 'Pistol', 'Shot'],
        verb: ['Sling', 'Fire', 'Pierce', 'Bolt', 'Volley', 'Draw'],
        capstoneName: 'Holy Volley',
        capstoneDesc: 'Empty both pistols in 6 sec — fire 12 sanctified bolts at random enemies for massive Holy damage. 90 sec cooldown.',
      },
      {
        id: 'houndmaster', name: 'Houndmaster', role: 'damage', attribute: 'agility', complexity: 'intermediate',
        description: 'Loose the witch hounds — let your trained beasts run down witches, warlocks, and worse.',
        signatures: ["Hound's Leap", 'Witch Tracker', 'Hound Pack', "Houndmaster's Whip", 'Beast Bond', 'Hunt and Run'],
        prefix: ["Houndmaster's", 'Trained', 'Tracking', 'Hunting', 'Pack-Bound', 'Wild-Tracked'],
        noun: ['Hound', 'Pack', 'Whip', 'Tracker', 'Bond', 'Hunt'],
        verb: ['Loose', 'Track', 'Hunt', 'Bond', 'Whip', 'Charge'],
        capstoneName: 'Pack of Hounds',
        capstoneDesc: 'Summon 4 witch-hounds that hunt for 30 sec, slowing and damaging targets they bite. 3 min cooldown.',
      },
      {
        id: 'inquisition', name: 'Inquisition', role: 'damage', attribute: 'intellect', complexity: 'advanced',
        description: 'Burn out heresy with sanctified fire and holy interrogation — none escape the Inquisition\'s eye.',
        signatures: ['Inquisition Mark', 'Holy Trial', 'Banishing Brand', 'Sanctified Mark', "Inquisitor's Eye", 'Heretic Mark'],
        prefix: ["Inquisitor's", 'Sanctified', 'Banishing', 'Pious', 'Hallowed', 'Trial-Marked'],
        noun: ['Mark', 'Trial', 'Brand', 'Eye', 'Verdict', 'Sentence'],
        verb: ['Mark', 'Brand', 'Inquire', 'Burn', 'Reveal', 'Sanctify'],
        capstoneName: "Inquisitor's Wrath",
        capstoneDesc: 'Mark all visible enemies for Inquisition for 15 sec — every spell you cast also strikes them for Holy damage. 3 min cooldown.',
      },
      {
        id: 'blackknight', name: 'Black Knight', role: 'tank', attribute: 'strength', complexity: 'intermediate',
        description: 'Don the cursed plate of the Black Knight — slow, hard, and impossible to bring down.',
        signatures: ['Black Plate', 'Cursed Steel', "Black Knight's Charge", 'Sanctified Plate', 'Stalwart Faith', 'Vengeful Bash'],
        prefix: ['Black', 'Cursed', 'Sanctified', 'Vengeful', 'Stalwart', 'Blackplate'],
        noun: ['Plate', 'Steel', 'Charge', 'Faith', 'Bash', 'Vow'],
        verb: ['Charge', 'Bash', 'Anchor', 'Withstand', 'Reflect', 'Smite'],
        capstoneName: "Black Knight's Vow",
        capstoneDesc: 'Become a Black Knight for 20 sec — take 50% less damage and reflect 30% damage taken. 3 min cooldown.',
      },
    ],
  },

  knightofxoroth: {
    damageType: 'Fel',
    classTreeName: 'Path of the Knight of Xoroth',
    classSignatures: ['Fel Strike', 'Shadow Brand', "Demon's Leap", 'Chaos Shard', 'Pit Pact', 'Doom Pronouncement'],
    classPrefix: ['Xorothian', 'Pit-Sworn', 'Felsteed', 'Damned', 'Infernal', "Lord's"],
    classNoun: ['Pact', 'Pit', 'Felsteed', 'Lord', 'Brand', 'Pronouncement'],
    classVerb: ['Swear', 'Burn', 'Cleave', 'Bind', 'Empower', 'Charge'],
    classCapstoneName: "Pit Lord's Avatar",
    classCapstoneDesc: 'For 20 sec, take Pit Lord Avatar form — gain 30% damage, 30% size, and your strikes deal Fel damage. 3 min cooldown.',
    specs: [
      {
        id: 'hellfire', name: 'Hellfire', role: 'damage', attribute: 'strength', complexity: 'normal',
        description: 'Wreath your felblade in hellfire — burn, cleave, and laugh as your enemies char.',
        signatures: ['Fel Strike', 'Shadow Brand', "Demon's Leap", 'Chaos Shard', 'Fel Cleave', 'Doom Pronouncement'],
        prefix: ['Hellfire', 'Burning', 'Damned', 'Searing', 'Pit-Born', 'Brimstone'],
        noun: ['Strike', 'Brand', 'Leap', 'Shard', 'Cleave', 'Pronouncement'],
        verb: ['Burn', 'Strike', 'Leap', 'Cleave', 'Char', 'Damn'],
        capstoneName: 'Felsworn Form',
        capstoneDesc: 'Take Felsworn Form for 20 sec — gain 25% damage and your strikes ignite enemies in Fel-fire. 3 min cooldown.',
      },
      {
        id: 'defiance', name: 'Defiance', role: 'tank', attribute: 'stamina', complexity: 'intermediate',
        description: 'Defy the Light, defy your fate — your fel-pact lets you weather any holy fury.',
        signatures: ['Xorothian Steel', 'Pit Pact', 'Legion Seal', 'Infernal Presence', 'Fel Aegis', 'Demon Skin'],
        prefix: ['Xorothian', 'Pit-Forged', 'Damned', 'Infernal', "Legion's", 'Pact-Bound'],
        noun: ['Steel', 'Pact', 'Seal', 'Presence', 'Aegis', 'Skin'],
        verb: ['Defy', 'Anchor', 'Withstand', 'Bind', 'Reflect', 'Endure'],
        capstoneName: "Pit Lord's Bulwark",
        capstoneDesc: "Channel the Pit Lord's Bulwark for 20 sec — take only 40% damage and reflect Holy damage. 3 min cooldown.",
      },
      {
        id: 'war', name: 'War', role: 'damage', attribute: 'strength', complexity: 'advanced',
        description: 'The Knight of Xoroth is the Lords\' general — wage war with infernal armies and fel-empowered cavalry.',
        signatures: ['War Cry of Xoroth', "Knight's Charge", 'Felsteed Strike', 'Battle Banner', 'Fel Empowerment', 'Legion Lord'],
        prefix: ["Knight's", 'Felsteed', "Legion's", "Lord's", 'Bannered', 'Cavalry'],
        noun: ['Cry', 'Charge', 'Strike', 'Banner', 'Empowerment', 'Lord'],
        verb: ['Charge', 'Lead', 'Empower', 'Roar', 'Mount', 'Command'],
        capstoneName: 'Knight of Xoroth',
        capstoneDesc: 'Mount the Felsteed for 30 sec and lead an infernal cavalry charge that deals massive Fel damage. 5 min cooldown.',
      },
    ],
  },

  ranger: {
    damageType: 'Physical',
    classTreeName: 'Path of Ranger',
    classSignatures: ['Aimed Shot', "Hunter's Mark", 'Multi-Shot', 'Rapid Fire', 'Trap', "Tracker's Eye"],
    classPrefix: ['Marked', 'Tracking', 'Hunting', 'Wild', "Sharpshooter's", 'Stealthy'],
    classNoun: ['Bow', 'Arrow', 'Shot', 'Mark', 'Trap', 'Quiver'],
    classVerb: ['Loose', 'Mark', 'Track', 'Hunt', 'Pierce', 'Aim'],
    classCapstoneName: 'Avatar of the Ranger',
    classCapstoneDesc: 'For 20 sec, take Ranger Avatar form — gain 30% ranged damage and 30% movement speed. 3 min cooldown.',
    specs: [
      {
        id: 'archery', name: 'Archery', role: 'damage', attribute: 'agility', complexity: 'normal',
        description: 'Master the bow — every shot is precise, every arrow finds its mark, every quiver is a quivering enemy line.',
        signatures: ['Aimed Shot', 'Multi-Shot', 'Rapid Fire', 'Marked Shot', "Hunter's Mark", 'Volley'],
        prefix: ['Aimed', 'Rapid', 'Marked', "Volley's", "Sharpshooter's", 'Piercing'],
        noun: ['Shot', 'Volley', 'Mark', 'Aim', 'Arrow', 'Quiver'],
        verb: ['Aim', 'Loose', 'Pierce', 'Volley', 'Mark', 'Fire'],
        capstoneName: 'Trueshot',
        capstoneDesc: 'Enter Trueshot stance for 15 sec — all your shots crit, and crits deal +50% damage. 3 min cooldown.',
      },
      {
        id: 'brigand', name: 'Brigand', role: 'damage', attribute: 'agility', complexity: 'intermediate',
        description: 'Strike from the brush like a highwayman — traps, ambushes, and merciless guerrilla warfare.',
        signatures: ["Highwayman's Trap", 'Ambush', 'Snare Volley', "Bandit's Mark", 'Backstabber', 'Quickfoot'],
        prefix: ["Highwayman's", 'Ambushing', 'Trapping', "Bandit's", 'Stealthy', 'Quickfoot'],
        noun: ['Trap', 'Ambush', 'Snare', 'Mark', 'Backstab', 'Vendetta'],
        verb: ['Trap', 'Ambush', 'Snare', 'Mark', 'Strike', 'Vanish'],
        capstoneName: "Brigand's Vendetta",
        capstoneDesc: 'Mark a target for Vendetta for 20 sec — they take 30% increased damage from you and bleed continuously. 90 sec cooldown.',
      },
      {
        id: 'farstrider', name: 'Farstrider', role: 'damage', attribute: 'agility', complexity: 'advanced',
        description: 'Walk where no Ranger dares — wild bond, wild spirits, wild bow on the edge of the world.',
        signatures: ["Farstrider's Bond", 'Wild Spirits', 'Beast Mastery', "Pet's Loyalty", "Hunter's Lore", 'Beastial Wrath'],
        prefix: ["Farstrider's", 'Wild', 'Beast-Bound', 'Lore-Wise', 'Spirit-Loyal', 'Beastial'],
        noun: ['Bond', 'Spirit', 'Pet', 'Lore', 'Wrath', 'Mastery'],
        verb: ['Bond', 'Roam', 'Loose', 'Awaken', 'Channel', 'Empower'],
        capstoneName: 'Beast Master',
        capstoneDesc: 'Summon 3 wild beasts that fight by your side for 30 sec, each empowered with your stats. 5 min cooldown.',
      },
    ],
  },

  templar: {
    damageType: 'Holy',
    classTreeName: 'Path of Templar',
    classSignatures: ["Templar's Verdict", 'Crusader Strike', 'Hammer of Light', 'Holy Charge', 'Sanctified Aegis', 'Word of Faith'],
    classPrefix: ['Sworn', 'Hallowed', 'Pious', 'Sanctified', "Templar's", 'Oath-Bound'],
    classNoun: ['Oath', 'Vow', 'Hammer', 'Verdict', 'Aegis', 'Charge'],
    classVerb: ['Swear', 'Smite', 'Bless', 'Charge', 'Anchor', 'Inscribe'],
    classCapstoneName: 'Avatar of the Templar',
    classCapstoneDesc: 'For 20 sec, take Templar Avatar form — gain 30% Holy damage and your strikes heal nearby allies for 5% max HP. 3 min cooldown.',
    specs: [
      {
        id: 'oathkeeper', name: 'Oathkeeper', role: 'tank', attribute: 'stamina', complexity: 'intermediate',
        description: "Swear the Templar's Oath and hold the line — your shield is the wall between innocents and ruin.",
        signatures: ["Oathkeeper's Bulwark", 'Sworn Shield', 'Templar Stance', 'Hallowed Aegis', 'Vow of Defense', 'Oath Renewal'],
        prefix: ['Oath-Bound', 'Sworn', 'Hallowed', 'Vigilant', "Templar's", 'Sacred'],
        noun: ['Bulwark', 'Shield', 'Stance', 'Aegis', 'Vow', 'Oath'],
        verb: ['Anchor', 'Swear', 'Hold', 'Withstand', 'Renew', 'Block'],
        capstoneName: 'Eternal Oath',
        capstoneDesc: 'Channel your Eternal Oath for 20 sec — take 50% less damage and grant nearby allies 25% damage reduction. 3 min cooldown.',
      },
      {
        id: 'zealot', name: 'Zealot', role: 'damage', attribute: 'strength', complexity: 'normal',
        description: "A zealot's faith burns brighter than the sun — strike with twin holy weapons in a flurry of righteous fury.",
        signatures: ["Zealot's Strike", 'Holy Cleave', 'Wrathful Slash', 'Fervent Smite', "Zealot's Charge", "Heaven's Verdict"],
        prefix: ['Zealous', 'Wrathful', 'Fervent', 'Holy', 'Righteous', "Heaven's"],
        noun: ['Strike', 'Cleave', 'Slash', 'Smite', 'Charge', 'Verdict'],
        verb: ['Strike', 'Cleave', 'Smite', 'Charge', 'Burn', 'Judge'],
        capstoneName: "Zealot's Fury",
        capstoneDesc: "Enter Zealot's Fury for 18 sec — gain 30% haste and 25% damage, every melee strike heals you. 3 min cooldown.",
      },
      {
        id: 'crusader', name: 'Crusader', role: 'damage', attribute: 'strength', complexity: 'advanced',
        description: 'Lead the holy crusade with two-handed righteousness — every blow rings of judgment and divine wrath.',
        signatures: ['Crusader Strike', 'Holy Hammer', 'Divine Wrath', "Avenger's Verdict", 'Glorious Bash', 'Smite'],
        prefix: ["Crusader's", 'Glorious', "Avenger's", 'Divine', 'Hallowed', 'Righteous'],
        noun: ['Strike', 'Hammer', 'Wrath', 'Verdict', 'Bash', 'Smite'],
        verb: ['Smite', 'Crush', 'Judge', 'Hammer', 'Avenge', 'Bash'],
        capstoneName: 'Avenging Wrath',
        capstoneDesc: 'Take Avenging Wrath form for 20 sec — gain wings, +30% damage, and your spells crit for +50%. 3 min cooldown.',
      },
    ],
  },
};

// ─── SPEC FACTORY ────────────────────────────────────────────────────────────

function autoBuildSpecsForClass(classId: string): SpecConfig[] {
  const flavor = CLASS_FLAVORS[classId];
  if (!flavor) return [];

  const classTheme: SpecTheme = {
    signature: flavor.classSignatures,
    prefix: flavor.classPrefix,
    noun: flavor.classNoun,
    verb: flavor.classVerb,
    damageType: flavor.damageType,
    capstoneName: flavor.classCapstoneName,
    capstoneDesc: flavor.classCapstoneDesc,
  };

  return flavor.specs.map((spec): SpecConfig => ({
    id: spec.id,
    name: spec.name,
    role: spec.role,
    attribute: spec.attribute,
    complexity: spec.complexity,
    description: spec.description,
    sampleSpells: spec.signatures.slice(0, 3),
    leftTreeName: flavor.classTreeName,
    rightTreeName: spec.rightTreeName ?? `Path of ${spec.name}`,
    leftTheme: classTheme,
    rightTheme: {
      signature: spec.signatures,
      prefix: spec.prefix,
      noun: spec.noun,
      verb: spec.verb,
      damageType: spec.damageType ?? flavor.damageType,
      capstoneName: spec.capstoneName,
      capstoneDesc: spec.capstoneDesc,
    },
  }));
}

const ALL_CLASS_SPECS: Record<string, SpecConfig[]> = {};
for (const meta of classMetas) {
  ALL_CLASS_SPECS[meta.id] = autoBuildSpecsForClass(meta.id);
}

// ─── PUBLIC LOOKUPS ──────────────────────────────────────────────────────────

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
    spec.rightTreeName,
    spec.rightTheme,
  );
}
