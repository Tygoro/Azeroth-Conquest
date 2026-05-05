import type { TalentTree, ClassMeta } from "@workspace/api-zod";

export const classMetas: ClassMeta[] = [
  { id: "warrior", name: "Warrior", description: "A mighty melee fighter who excels in close combat and tanking.", icon: "⚔️", color: "#C69B3A" },
  { id: "paladin", name: "Paladin", description: "A holy warrior who combines divine power with martial prowess.", icon: "🛡️", color: "#F58CBA" },
  { id: "hunter", name: "Hunter", description: "A master of ranged combat and beast taming.", icon: "🏹", color: "#ABD473" },
  { id: "rogue", name: "Rogue", description: "A cunning fighter who relies on stealth and speed.", icon: "🗡️", color: "#FFF569" },
  { id: "priest", name: "Priest", description: "A holy spellcaster who heals allies and smites foes.", icon: "✨", color: "#FFFFFF" },
  { id: "shaman", name: "Shaman", description: "A spiritual leader who calls on the elements for aid.", icon: "⚡", color: "#0070DE" },
  { id: "mage", name: "Mage", description: "A powerful arcane spellcaster who commands fire, frost, and magic.", icon: "🔥", color: "#69CCF0" },
  { id: "warlock", name: "Warlock", description: "A dark spellcaster who draws power from demons and shadow.", icon: "💜", color: "#9482C9" },
  { id: "druid", name: "Druid", description: "A shapeshifting nature channeler equally at home in any role.", icon: "🌿", color: "#FF7D0A" },
  { id: "deathknight", name: "Death Knight", description: "A fallen champion reborn in undeath, wielding runic power.", icon: "💀", color: "#C41E3A" },
  { id: "monk", name: "Monk", description: "A martial arts master who channels chi energy.", icon: "☯️", color: "#00FF96" },
  { id: "demonhunter", name: "Demon Hunter", description: "A Night Elf or Blood Elf warrior who sacrifices their sight to gain spectral vision and immense power.", icon: "👁️", color: "#A330C9" },
  { id: "evoker", name: "Evoker", description: "A Dracthyr who channels the essence of the five dragonflights.", icon: "🐉", color: "#33937F" },
  { id: "necromancer", name: "Necromancer", description: "A dark practitioner who raises the dead and commands skeletal armies.", icon: "🦴", color: "#2D6B4D" },
  { id: "spellblade", name: "Spellblade", description: "A hybrid warrior who imbues blades with arcane and elemental energy.", icon: "⚗️", color: "#7B68EE" },
  { id: "beastmaster", name: "Beast Master", description: "A primal warrior who bonds with powerful wild beasts.", icon: "🐾", color: "#8B4513" },
  { id: "shadowdancer", name: "Shadow Dancer", description: "An assassin who weaves between shadow and light.", icon: "🌑", color: "#4A4A8A" },
  { id: "stormbringer", name: "Storm Bringer", description: "A storm-caller who channels lightning and wind into devastating attacks.", icon: "🌩️", color: "#4169E1" },
  { id: "runeblade", name: "Rune Blade", description: "A rune-inscribed warrior who carves reality with ancient sigils.", icon: "🔷", color: "#DC143C" },
  { id: "lichbane", name: "Lich Bane", description: "A holy avenger trained specifically to destroy undead and dark magic.", icon: "⭐", color: "#FFD700" },
  { id: "warden", name: "Warden", description: "An ancient sentinel guardian who punishes those who break the laws of nature.", icon: "🌲", color: "#228B22" },
];

function buildWarriorTree(): TalentTree {
  return {
    class: "Warrior",
    classId: "warrior",
    maxPoints: 61,
    color: "#C69B3A",
    nodes: [
      { id: "w1", name: "Battle Stance", description: "Enter a battle-ready stance, increasing all damage dealt by 5% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 2, y: 0 }, type: "passive" },
      { id: "w2", name: "Shield Bash", description: "Bash an enemy with your shield, interrupting their spellcasting. Reduces cooldown by 2s per point.", maxPoints: 2, currentPoints: 0, prerequisites: [], position: { x: 4, y: 0 }, type: "active" },
      { id: "w3", name: "Iron Skin", description: "Hardens your skin, reducing all damage taken by 3% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["w1"], position: { x: 1, y: 1 }, type: "passive" },
      { id: "w4", name: "Mortal Strike", description: "A devastating blow that deals 150% weapon damage and reduces healing on target by 25% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["w1"], position: { x: 3, y: 1 }, type: "active" },
      { id: "w5", name: "Bladestorm", description: "Spin in a whirlwind of steel, hitting all nearby enemies. Duration increases 1s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["w2"], position: { x: 5, y: 1 }, type: "active" },
      { id: "w6", name: "Endurance", description: "Increases maximum health by 5% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["w3"], position: { x: 0, y: 2 }, type: "passive" },
      { id: "w7", name: "Titan's Grip", description: "Allows wielding two-handed weapons in one hand. Damage penalty reduced by 10% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["w4"], position: { x: 2, y: 2 }, type: "passive" },
      { id: "w8", name: "Rend", description: "Causes the target to bleed for heavy damage over 15 seconds. Damage increases 20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["w4"], position: { x: 4, y: 2 }, type: "active" },
      { id: "w9", name: "Avatar", description: "Transform into a colossus, increasing all damage dealt by 20% and immune to movement impairing effects. Duration 10s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["w5"], position: { x: 6, y: 2 }, type: "active" },
      { id: "w10", name: "Fortitude Aura", description: "Increases stamina of all nearby party members by 10% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["w6"], position: { x: 0, y: 3 }, type: "passive" },
      { id: "w11", name: "Colossus Smash", description: "Smash your opponent's armor, ignoring 20% armor per point for 10s.", maxPoints: 3, currentPoints: 0, prerequisites: ["w7"], position: { x: 2, y: 3 }, type: "active" },
      { id: "w12", name: "Deep Wounds", description: "Your critical strikes cause the target to bleed, dealing 30% of your weapon damage over 6s per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["w8"], position: { x: 4, y: 3 }, type: "passive" },
      { id: "w13", name: "Thunderclap", description: "Deals nature damage to all enemies within 10 yards and slows them. Radius +2yds per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["w7", "w8"], position: { x: 3, y: 4 }, type: "active" },
      { id: "w14", name: "Wrecking Ball", description: "Your Bladestorm now pulls enemies to you at the start. Range +5yds per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["w9"], position: { x: 6, y: 3 }, type: "passive" },
      { id: "w15", name: "Battle Cry", description: "Shout a war cry increasing all allies' attack power by 15% per point for 15s.", maxPoints: 2, currentPoints: 0, prerequisites: ["w10"], position: { x: 1, y: 4 }, type: "active" },
      { id: "w16", name: "Execute", description: "Attempt to kill a weakened enemy, causing massive damage to targets below 20% health. Damage +25% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["w11"], position: { x: 2, y: 5 }, type: "active" },
      { id: "w17", name: "Slam", description: "A powerful melee strike that ignores 10% armor per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["w12", "w13"], position: { x: 4, y: 5 }, type: "active" },
      { id: "w18", name: "Heroic Leap", description: "Leap through the air and land at a target location, dealing damage. Cooldown reduced 5s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["w13", "w14"], position: { x: 5, y: 4 }, type: "active" },
      { id: "w19", name: "Warbreaker", description: "A devastating cleave that hits all enemies in front of you. Applies Colossus Smash to all targets hit.", maxPoints: 1, currentPoints: 0, prerequisites: ["w16", "w17"], position: { x: 3, y: 6 }, type: "active" },
    ],
  };
}

function buildMageTree(): TalentTree {
  return {
    class: "Mage",
    classId: "mage",
    maxPoints: 61,
    color: "#69CCF0",
    nodes: [
      { id: "m1", name: "Arcane Intellect", description: "Infuses the caster with brilliance, increasing intellect by 8% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 2, y: 0 }, type: "passive" },
      { id: "m2", name: "Frost Armor", description: "Surrounds the caster in a layer of frost, slowing attackers by 10% per point.", maxPoints: 2, currentPoints: 0, prerequisites: [], position: { x: 4, y: 0 }, type: "passive" },
      { id: "m3", name: "Fireball", description: "Launches a ball of flame at the target, dealing fire damage. Damage +15% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["m1"], position: { x: 1, y: 1 }, type: "active" },
      { id: "m4", name: "Arcane Blast", description: "Blasts the target with energy, dealing arcane damage that increases with each cast. Damage +10% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["m1"], position: { x: 3, y: 1 }, type: "active" },
      { id: "m5", name: "Ice Lance", description: "Hurls a shard of ice at the target, dealing frost damage tripled on frozen targets. Damage +20% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["m2"], position: { x: 5, y: 1 }, type: "active" },
      { id: "m6", name: "Scorch", description: "Scorches the enemy for fire damage, with repeated casts adding a heat stack. Stacks +1 per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["m3"], position: { x: 0, y: 2 }, type: "active" },
      { id: "m7", name: "Presence of Mind", description: "Makes your next Arcane Blast instant cast and reduces its mana cost by 20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["m4"], position: { x: 2, y: 2 }, type: "active" },
      { id: "m8", name: "Frost Nova", description: "Blasts enemies near the caster with ice, immobilizing them for 8s. Duration +2s per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["m5"], position: { x: 4, y: 2 }, type: "active" },
      { id: "m9", name: "Blizzard", description: "Ice shards pelt all targets in the selected area for frost damage. Damage +25% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["m5"], position: { x: 6, y: 2 }, type: "active" },
      { id: "m10", name: "Hot Streak", description: "Two consecutive crits cause your next Pyroblast to be instant. Proc chance +10% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["m6", "m3"], position: { x: 1, y: 3 }, type: "passive" },
      { id: "m11", name: "Arcane Power", description: "Arcane Power instantly increases your damage and mana cost of spells by 20% per point for 10s.", maxPoints: 2, currentPoints: 0, prerequisites: ["m7"], position: { x: 3, y: 3 }, type: "active" },
      { id: "m12", name: "Shatter", description: "Increases the critical strike chance of all spells against frozen targets by 25% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["m8"], position: { x: 5, y: 3 }, type: "passive" },
      { id: "m13", name: "Pyroblast", description: "Hurls an enormous fireball that causes massive fire damage. Cast time -0.5s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["m10"], position: { x: 1, y: 4 }, type: "active" },
      { id: "m14", name: "Evocation", description: "Rapidly regenerates mana over 6s. Mana regained +10% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["m11"], position: { x: 3, y: 4 }, type: "active" },
      { id: "m15", name: "Frozen Orb", description: "Launches a frozen orb that travels forward dealing frost damage to all in its path. Damage +20% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["m12", "m9"], position: { x: 5, y: 4 }, type: "active" },
      { id: "m16", name: "Combustion", description: "Ignites a column of fire dealing massive damage and burning the ground. Duration +2s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["m13"], position: { x: 2, y: 5 }, type: "active" },
      { id: "m17", name: "Time Warp", description: "Activates time dilation, granting all party members 30% haste. Duration +5s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["m14"], position: { x: 3, y: 5 }, type: "active" },
      { id: "m18", name: "Glacial Spike", description: "Hurls a massive icicle dealing colossal frost damage. Damage +30% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["m15"], position: { x: 5, y: 5 }, type: "active" },
      { id: "m19", name: "Meteor", description: "Calls down a meteor that strikes the target area for fire damage after a 3s delay. Damage +25% per point.", maxPoints: 1, currentPoints: 0, prerequisites: ["m16", "m17"], position: { x: 3, y: 6 }, type: "active" },
    ],
  };
}

function buildDruidTree(): TalentTree {
  return {
    class: "Druid",
    classId: "druid",
    maxPoints: 61,
    color: "#FF7D0A",
    nodes: [
      { id: "d1", name: "Feral Swiftness", description: "Increases movement speed in Cat Form and Travel Form by 5% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 2, y: 0 }, type: "passive" },
      { id: "d2", name: "Rejuvenation", description: "Heals the target for a moderate amount over 12s. Healing +15% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 4, y: 0 }, type: "active" },
      { id: "d3", name: "Mangle", description: "Mangle the target, dealing physical damage and causing them to bleed. Damage +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["d1"], position: { x: 1, y: 1 }, type: "active" },
      { id: "d4", name: "Bear Form", description: "Transforms into a mighty bear. Armor +10% per point in Bear Form.", maxPoints: 2, currentPoints: 0, prerequisites: ["d1"], position: { x: 3, y: 1 }, type: "active" },
      { id: "d5", name: "Regrowth", description: "Heals a friendly target immediately and over 21s. Healing +12% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["d2"], position: { x: 5, y: 1 }, type: "active" },
      { id: "d6", name: "Rake", description: "Rake the target for bleed damage and cause them to bleed for 9s. Damage +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["d3"], position: { x: 0, y: 2 }, type: "active" },
      { id: "d7", name: "Shred", description: "Shred the target, dealing weapon damage plus extra. Only usable from behind. Damage +25% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["d3"], position: { x: 2, y: 2 }, type: "active" },
      { id: "d8", name: "Frenzied Regeneration", description: "Converts rage to health, healing the caster for 30% of converted rage per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["d4"], position: { x: 4, y: 2 }, type: "active" },
      { id: "d9", name: "Wild Growth", description: "Heals up to 5 injured friendly targets near the caster. Targets +1 per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["d5"], position: { x: 6, y: 2 }, type: "active" },
      { id: "d10", name: "Primal Fury", description: "Bleeds have a chance to critically strike, dealing 50% more damage. Crit chance +5% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["d6", "d7"], position: { x: 1, y: 3 }, type: "passive" },
      { id: "d11", name: "Rip", description: "Finishing move that causes damage over time. Lasts longer with more combo points. Damage +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["d7"], position: { x: 3, y: 3 }, type: "active" },
      { id: "d12", name: "Barkskin", description: "Reduces all damage taken by 20% for 12s. Duration +3s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["d8"], position: { x: 5, y: 3 }, type: "active" },
      { id: "d13", name: "Moonfire", description: "Burns the enemy with lunar fire, causing immediate and periodic damage. Damage +15% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["d10"], position: { x: 1, y: 4 }, type: "active" },
      { id: "d14", name: "Ferocious Bite", description: "Finishing move that causes damage per combo point. Excess energy extends Rip. Damage +25% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["d11"], position: { x: 3, y: 4 }, type: "active" },
      { id: "d15", name: "Tranquility", description: "Channeled heal that restores health to all nearby friendly targets every 2s. Healing +20% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["d12", "d9"], position: { x: 5, y: 4 }, type: "active" },
      { id: "d16", name: "Starlord", description: "Casting Moonfire extends the duration of Eclipse effects by 1s per point, stacking up to 3 times.", maxPoints: 3, currentPoints: 0, prerequisites: ["d13"], position: { x: 2, y: 5 }, type: "passive" },
      { id: "d17", name: "Tiger's Fury", description: "Instantly restores 60 energy and increases physical damage by 15% per point for 8s.", maxPoints: 2, currentPoints: 0, prerequisites: ["d14"], position: { x: 3, y: 5 }, type: "active" },
      { id: "d18", name: "Convoke the Spirits", description: "Call upon the spirits for 4s, channeling a barrage of nature spells. Spell count +2 per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["d15", "d16"], position: { x: 4, y: 5 }, type: "active" },
      { id: "d19", name: "Incarnation", description: "Shapeshift into your ultimate form for 30s, empowering all your abilities. Damage/healing +15% per point.", maxPoints: 1, currentPoints: 0, prerequisites: ["d17", "d18"], position: { x: 3, y: 6 }, type: "active" },
    ],
  };
}

function buildWarlockTree(): TalentTree {
  return {
    class: "Warlock",
    classId: "warlock",
    maxPoints: 61,
    color: "#9482C9",
    nodes: [
      { id: "wl1", name: "Shadow Mastery", description: "Increases the damage of all Shadow spells by 5% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 2, y: 0 }, type: "passive" },
      { id: "wl2", name: "Demonic Pact", description: "Increases damage and healing of all party members near your demon by 2% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 4, y: 0 }, type: "passive" },
      { id: "wl3", name: "Corruption", description: "Corrupts the target, causing them to take shadow damage over 18s. Damage +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["wl1"], position: { x: 1, y: 1 }, type: "active" },
      { id: "wl4", name: "Summon Felguard", description: "Summons a powerful Felguard demon under your command. Damage +15% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["wl2"], position: { x: 3, y: 1 }, type: "active" },
      { id: "wl5", name: "Drain Soul", description: "Channeled spell that causes shadow damage and restores a soul shard when target dies. Damage +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["wl1"], position: { x: 5, y: 1 }, type: "active" },
      { id: "wl6", name: "Haunt", description: "Sends a ghostly soul that haunts the target, dealing shadow damage and increasing your periodic damage on target by 25% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["wl3"], position: { x: 0, y: 2 }, type: "active" },
      { id: "wl7", name: "Unstable Affliction", description: "Shadow energy silences and deals damage over 14s. If dispelled, deals massive damage to the dispeller. Damage +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["wl3"], position: { x: 2, y: 2 }, type: "active" },
      { id: "wl8", name: "Chaos Bolt", description: "Sends a bolt of chaotic fire that is guaranteed to critically strike. Damage +15% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["wl4"], position: { x: 4, y: 2 }, type: "active" },
      { id: "wl9", name: "Soul Harvest", description: "Channels dark energy restoring soul shards and increasing damage done by 15% per point for 12s.", maxPoints: 2, currentPoints: 0, prerequisites: ["wl5"], position: { x: 6, y: 2 }, type: "active" },
      { id: "wl10", name: "Creeping Death", description: "Corruption, Agony, Unstable Affliction, and Phantom Singularity deal damage 15% faster per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["wl6", "wl7"], position: { x: 1, y: 3 }, type: "passive" },
      { id: "wl11", name: "Phantom Singularity", description: "Afflicts the target with a phantom singularity that deals shadow damage while healing you. Damage +20% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["wl7"], position: { x: 3, y: 3 }, type: "active" },
      { id: "wl12", name: "Rain of Fire", description: "Calls down a rain of fire over the target area for fire damage every 1s for 8s. Damage +15% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["wl8"], position: { x: 5, y: 3 }, type: "active" },
      { id: "wl13", name: "Dark Soul", description: "Empowers your soul for 20s, increasing haste or critical strike chance by 30% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["wl10"], position: { x: 1, y: 4 }, type: "active" },
      { id: "wl14", name: "Malefic Rapture", description: "Expunges corruption from the target, causing shadow damage per active periodic effect. Damage +25% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["wl11"], position: { x: 3, y: 4 }, type: "active" },
      { id: "wl15", name: "Infernal Combustion", description: "Summons an Infernal, dealing massive fire damage on impact. Damage +30% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["wl12", "wl9"], position: { x: 5, y: 4 }, type: "active" },
      { id: "wl16", name: "Wrath of Consumption", description: "When a target with your corruption dies, your remaining corruption spells gain 10% damage per stack per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["wl13"], position: { x: 2, y: 5 }, type: "passive" },
      { id: "wl17", name: "Seed of Corruption", description: "Imbeds a demon seed in the enemy, causing shadow damage and exploding to corrupt nearby enemies. Damage +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["wl14"], position: { x: 3, y: 5 }, type: "active" },
      { id: "wl18", name: "Soulfire", description: "Consumes a soul shard to blast the target for massive fire damage. Damage +25% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["wl15"], position: { x: 5, y: 5 }, type: "active" },
      { id: "wl19", name: "Summon Darkglare", description: "Summons a Darkglare from the Twisting Nether that blasts enemies for shadow damage and extends your DoT durations.", maxPoints: 1, currentPoints: 0, prerequisites: ["wl16", "wl17"], position: { x: 3, y: 6 }, type: "active" },
    ],
  };
}

function buildPaladinTree(): TalentTree {
  return {
    class: "Paladin",
    classId: "paladin",
    maxPoints: 61,
    color: "#F58CBA",
    nodes: [
      { id: "p1", name: "Divine Strength", description: "Increases your total Strength by 5% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 2, y: 0 }, type: "passive" },
      { id: "p2", name: "Holy Light", description: "Heals a friendly target for a large amount. Healing +15% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 4, y: 0 }, type: "active" },
      { id: "p3", name: "Consecration", description: "Consecrates the land beneath your feet, dealing holy damage to enemies for 8s. Damage +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["p1"], position: { x: 1, y: 1 }, type: "active" },
      { id: "p4", name: "Judgment", description: "Unleashes the energy of a Seal to deal holy damage. Damage +25% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["p1"], position: { x: 3, y: 1 }, type: "active" },
      { id: "p5", name: "Flash of Light", description: "Quick heal that restores a moderate amount of health. Healing +20% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["p2"], position: { x: 5, y: 1 }, type: "active" },
      { id: "p6", name: "Shield of the Righteous", description: "Hurls your shield at an enemy, dealing holy damage. Damage +20% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["p3"], position: { x: 0, y: 2 }, type: "active" },
      { id: "p7", name: "Crusader Strike", description: "An instant melee attack that causes 110% weapon damage. Damage +15% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["p4"], position: { x: 2, y: 2 }, type: "active" },
      { id: "p8", name: "Divine Purpose", description: "Holy Power spenders have a chance to make your next Holy Power spender free. Chance +5% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["p4"], position: { x: 4, y: 2 }, type: "passive" },
      { id: "p9", name: "Beacon of Light", description: "All healing you do is also applied to the Beacon target. Duration extended 30s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["p5"], position: { x: 6, y: 2 }, type: "active" },
      { id: "p10", name: "Avenger's Shield", description: "Flings a holy shield that ricochets to hit 3 enemies. Damage +20% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["p6", "p7"], position: { x: 1, y: 3 }, type: "active" },
      { id: "p11", name: "Divine Hammer", description: "Summons a hammer of divine light that strikes all nearby enemies for holy damage. Replaces Crusader Strike. Damage +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["p7"], position: { x: 3, y: 3 }, type: "active" },
      { id: "p12", name: "Holy Shock", description: "Launches a bolt of holy energy causing holy damage or healing. Damage/Healing +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["p8", "p5"], position: { x: 5, y: 3 }, type: "active" },
      { id: "p13", name: "Blessed Hammer", description: "Throws a blessed hammer that spirals outward. Damage +25% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["p10"], position: { x: 1, y: 4 }, type: "active" },
      { id: "p14", name: "Wake of Ashes", description: "Sweep a trail of holy fire that deals holy damage to all enemies. Damage +30% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["p11"], position: { x: 3, y: 4 }, type: "active" },
      { id: "p15", name: "Glimmer of Light", description: "Holy Shock leaves a Glimmer on the target. Glimmered allies receive bonus healing. Healing +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["p12"], position: { x: 5, y: 4 }, type: "passive" },
      { id: "p16", name: "Avenging Wrath", description: "Increases damage, healing, and critical strike chance by 20% for 20s. Duration +5s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["p13", "p14"], position: { x: 2, y: 5 }, type: "active" },
      { id: "p17", name: "Holy Prism", description: "Sends beams of holy light that damage enemies and heal allies. Radiance +1 target per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["p14"], position: { x: 4, y: 5 }, type: "active" },
      { id: "p18", name: "Sanctified Wrath", description: "During Avenging Wrath, your judgment deals additional damage and reduces its cooldown by 5s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["p15", "p16"], position: { x: 4, y: 6 }, type: "passive" },
      { id: "p19", name: "Hammer of Light", description: "Strikes all enemies in front of you for massive holy damage, consuming Holy Power. Ultimate finisher.", maxPoints: 1, currentPoints: 0, prerequisites: ["p17", "p18"], position: { x: 3, y: 6 }, type: "active" },
    ],
  };
}

function buildDeathKnightTree(): TalentTree {
  return {
    class: "Death Knight",
    classId: "deathknight",
    maxPoints: 61,
    color: "#C41E3A",
    nodes: [
      { id: "dk1", name: "Runic Power Mastery", description: "Increases maximum Runic Power by 10 per point.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 2, y: 0 }, type: "passive" },
      { id: "dk2", name: "Icy Talons", description: "Increases attack speed by 5% per point when Frost Fever is active.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 4, y: 0 }, type: "passive" },
      { id: "dk3", name: "Blood Strike", description: "Strikes the target for physical damage plus extra per disease on target. Damage +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["dk1"], position: { x: 1, y: 1 }, type: "active" },
      { id: "dk4", name: "Frost Strike", description: "A powerful frost attack consuming Runic Power. Damage +15% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["dk2"], position: { x: 3, y: 1 }, type: "active" },
      { id: "dk5", name: "Chains of Ice", description: "Roots the target in place for 8s. Applies Frost Fever. Duration +1s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["dk2"], position: { x: 5, y: 1 }, type: "active" },
      { id: "dk6", name: "Death Strike", description: "Heals yourself for 15% of max health and deals damage. Healing +5% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["dk3"], position: { x: 0, y: 2 }, type: "active" },
      { id: "dk7", name: "Obliterate", description: "A devastating strike dealing heavy physical damage. Damage +25% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["dk4"], position: { x: 2, y: 2 }, type: "active" },
      { id: "dk8", name: "Howling Blast", description: "Blasts all enemies within 10 yards for frost damage and applies Frost Fever. Damage +20% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["dk5"], position: { x: 4, y: 2 }, type: "active" },
      { id: "dk9", name: "Army of the Dead", description: "Summons an army of ghouls to fight by your side for 40s. Ghouls +2 per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["dk5"], position: { x: 6, y: 2 }, type: "active" },
      { id: "dk10", name: "Vampiric Blood", description: "Increases max health by 30% and drains 10% of damage dealt as health for 10s. Duration +3s per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["dk6"], position: { x: 0, y: 3 }, type: "active" },
      { id: "dk11", name: "Pillar of Frost", description: "Strengthens your body with frost, increasing Strength by 20% for 12s. Duration +3s per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["dk7"], position: { x: 2, y: 3 }, type: "active" },
      { id: "dk12", name: "Frostwyrm's Fury", description: "Summons a frostwyrm who deals massive frost damage in a line. Damage +25% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["dk8"], position: { x: 4, y: 3 }, type: "active" },
      { id: "dk13", name: "Crimson Scourge", description: "Raise Dead causes Death Coil to reduce Scourge Strike's cost by 1 Rune. Proc chance +15% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["dk10"], position: { x: 0, y: 4 }, type: "passive" },
      { id: "dk14", name: "Breath of Sindragosa", description: "Continuously deal frost damage in a cone. Damage +20% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["dk11"], position: { x: 2, y: 4 }, type: "active" },
      { id: "dk15", name: "Raise Abomination", description: "Raises a horrifying Abomination to fight for you that deals disease damage. Damage +30% per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["dk12", "dk9"], position: { x: 5, y: 4 }, type: "active" },
      { id: "dk16", name: "Rune Tap", description: "Instantly heals for 10% of max health and reduces all damage taken by 40% for 3s. Effect +5% per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["dk13"], position: { x: 1, y: 5 }, type: "active" },
      { id: "dk17", name: "Glacial Advance", description: "Advance a wave of icy spikes that deal frost damage. +1 spike per point.", maxPoints: 2, currentPoints: 0, prerequisites: ["dk14"], position: { x: 3, y: 5 }, type: "active" },
      { id: "dk18", name: "Epidemic", description: "Causes your diseases to leap to a nearby enemy. Jumps +1 per point.", maxPoints: 3, currentPoints: 0, prerequisites: ["dk15"], position: { x: 5, y: 5 }, type: "active" },
      { id: "dk19", name: "Apocalypse", description: "Burst all Festering Wounds on the target, summoning an Army ghoul for each burst. Duration 15s.", maxPoints: 1, currentPoints: 0, prerequisites: ["dk17", "dk18"], position: { x: 3, y: 6 }, type: "active" },
    ],
  };
}

function buildGenericTree(id: string, name: string, color: string, icon: string): TalentTree {
  return {
    class: name,
    classId: id,
    maxPoints: 61,
    color,
    nodes: [
      { id: `${id}_1`, name: "Power Strike", description: "Increases damage dealt by 5% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 2, y: 0 }, type: "passive" },
      { id: `${id}_2`, name: "Fortitude", description: "Increases maximum health by 4% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [], position: { x: 4, y: 0 }, type: "passive" },
      { id: `${id}_3`, name: "Swift Strike", description: "An instant attack for 120% weapon damage. Damage +15% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [`${id}_1`], position: { x: 1, y: 1 }, type: "active" },
      { id: `${id}_4`, name: "Resilience", description: "Reduces damage taken by 3% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [`${id}_1`], position: { x: 3, y: 1 }, type: "passive" },
      { id: `${id}_5`, name: "Mana Surge", description: "Increases spell power by 8% per point.", maxPoints: 2, currentPoints: 0, prerequisites: [`${id}_2`], position: { x: 5, y: 1 }, type: "passive" },
      { id: `${id}_6`, name: "Keen Eye", description: "Increases critical strike chance by 4% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [`${id}_3`], position: { x: 0, y: 2 }, type: "passive" },
      { id: `${id}_7`, name: "Relentless Assault", description: "Attacks have a chance to strike twice. Proc chance +5% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [`${id}_3`, `${id}_4`], position: { x: 2, y: 2 }, type: "passive" },
      { id: `${id}_8`, name: "Iron Will", description: "Increases resistance to stuns and debuffs by 10% per point.", maxPoints: 2, currentPoints: 0, prerequisites: [`${id}_4`], position: { x: 4, y: 2 }, type: "passive" },
      { id: `${id}_9`, name: "Arcane Torrent", description: "Channels arcane energy for massive damage. Damage +20% per point.", maxPoints: 2, currentPoints: 0, prerequisites: [`${id}_5`], position: { x: 6, y: 2 }, type: "active" },
      { id: `${id}_10`, name: "Deadly Momentum", description: "Kills refresh your cooldowns. Chance +15% per point.", maxPoints: 2, currentPoints: 0, prerequisites: [`${id}_6`], position: { x: 0, y: 3 }, type: "passive" },
      { id: `${id}_11`, name: "Killing Spree", description: "Teleport to a nearby enemy attacking them rapidly. Hits +1 per point.", maxPoints: 3, currentPoints: 0, prerequisites: [`${id}_7`], position: { x: 2, y: 3 }, type: "active" },
      { id: `${id}_12`, name: "Shield Wall", description: "Reduces all damage taken by 40% for 10s. Duration +3s per point.", maxPoints: 2, currentPoints: 0, prerequisites: [`${id}_8`], position: { x: 4, y: 3 }, type: "active" },
      { id: `${id}_13`, name: "Adrenaline Rush", description: "Doubles energy regeneration for 15s. Duration +3s per point.", maxPoints: 2, currentPoints: 0, prerequisites: [`${id}_10`, `${id}_11`], position: { x: 1, y: 4 }, type: "active" },
      { id: `${id}_14`, name: "Shadow Dance", description: "Enter the shadow, allowing stealth abilities outside of stealth for 8s. Duration +2s per point.", maxPoints: 2, currentPoints: 0, prerequisites: [`${id}_11`], position: { x: 3, y: 4 }, type: "active" },
      { id: `${id}_15`, name: "Arcane Ward", description: "Grants a magical shield absorbing 30% of incoming damage. Absorption +10% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [`${id}_12`, `${id}_9`], position: { x: 5, y: 4 }, type: "active" },
      { id: `${id}_16`, name: "Master Assassin", description: "Reduces cooldowns of major abilities by 10% per point.", maxPoints: 3, currentPoints: 0, prerequisites: [`${id}_13`], position: { x: 2, y: 5 }, type: "passive" },
      { id: `${id}_17`, name: "Coup de Grace", description: "A finishing strike dealing 200% weapon damage. Damage +25% per point.", maxPoints: 2, currentPoints: 0, prerequisites: [`${id}_14`], position: { x: 3, y: 5 }, type: "active" },
      { id: `${id}_18`, name: "Final Reckoning", description: "Calls down a bolt of energy dealing massive damage. Damage +30% per point.", maxPoints: 2, currentPoints: 0, prerequisites: [`${id}_15`], position: { x: 5, y: 5 }, type: "active" },
      { id: `${id}_19`, name: "Legendary Strike", description: "The pinnacle ability of this class. Combines all aspects into a single devastating strike.", maxPoints: 1, currentPoints: 0, prerequisites: [`${id}_16`, `${id}_17`], position: { x: 3, y: 6 }, type: "active" },
    ],
  };
}

const talentTrees: Map<string, TalentTree> = new Map([
  ["warrior", buildWarriorTree()],
  ["mage", buildMageTree()],
  ["druid", buildDruidTree()],
  ["warlock", buildWarlockTree()],
  ["paladin", buildPaladinTree()],
  ["deathknight", buildDeathKnightTree()],
]);

for (const meta of classMetas) {
  if (!talentTrees.has(meta.id)) {
    talentTrees.set(meta.id, buildGenericTree(meta.id, meta.name, meta.color, meta.icon));
  }
}

export function getClassTree(classId: string): TalentTree | undefined {
  return talentTrees.get(classId);
}
