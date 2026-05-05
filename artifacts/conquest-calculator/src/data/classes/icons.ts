// Frontend-only icon + background system.
// Does NOT modify the API data structure — purely cosmetic.

const ZAMIMG = 'https://wow.zamimg.com/images/wow/icons/large';

// ── Class background gradients ────────────────────────────────────────────────
// Each value is a CSS background string applied behind the talent trees.
export const CLASS_BG_GRADIENT: Record<string, string> = {
  necromancer:      'radial-gradient(ellipse 90% 70% at 50% 0%, #071f13 0%, #020a07 100%)',
  pyromancer:       'radial-gradient(ellipse 90% 70% at 50% 0%, #1f0700 0%, #090200 100%)',
  cultist:          'radial-gradient(ellipse 90% 70% at 50% 0%, #120720 0%, #060309 100%)',
  starcaller:       'radial-gradient(ellipse 90% 70% at 50% 0%, #060e2a 0%, #020408 100%)',
  suncleric:        'radial-gradient(ellipse 90% 70% at 50% 0%, #1f1700 0%, #090700 100%)',
  tinker:           'radial-gradient(ellipse 90% 70% at 50% 0%, #1a1200 0%, #070500 100%)',
  runemaster:       'radial-gradient(ellipse 90% 70% at 50% 0%, #1f0005 0%, #090002 100%)',
  primalist:        'radial-gradient(ellipse 90% 70% at 50% 0%, #071a07 0%, #020602 100%)',
  chronomancer:     'radial-gradient(ellipse 90% 70% at 50% 0%, #001a1a 0%, #000808 100%)',
  reaper:           'radial-gradient(ellipse 90% 70% at 50% 0%, #0d0d14 0%, #050507 100%)',
  guardian:         'radial-gradient(ellipse 90% 70% at 50% 0%, #041020 0%, #020609 100%)',
  monk:             'radial-gradient(ellipse 90% 70% at 50% 0%, #001a0d 0%, #000805 100%)',
  demonhunter:      'radial-gradient(ellipse 90% 70% at 50% 0%, #1a0020 0%, #090009 100%)',
  stormbringer:     'radial-gradient(ellipse 90% 70% at 50% 0%, #001020 0%, #000409 100%)',
  witchhunter:      'radial-gradient(ellipse 90% 70% at 50% 0%, #1a1407 0%, #080603 100%)',
  knightofxoroth:   'radial-gradient(ellipse 90% 70% at 50% 0%, #1a0000 0%, #090000 100%)',
  barbarian:        'radial-gradient(ellipse 90% 70% at 50% 0%, #1a0505 0%, #080202 100%)',
  ranger:           'radial-gradient(ellipse 90% 70% at 50% 0%, #0a1400 0%, #040600 100%)',
  sonofarugal:      'radial-gradient(ellipse 90% 70% at 50% 0%, #14001a 0%, #060009 100%)',
  witchdoctor:      'radial-gradient(ellipse 90% 70% at 50% 0%, #001a1a 0%, #000909 100%)',
  discipleofshadra: 'radial-gradient(ellipse 90% 70% at 50% 0%, #1a1400 0%, #090600 100%)',
};

// ── Known node name → zamimg icon slug ───────────────────────────────────────
const NAMED_ICONS: Record<string, string> = {
  // Necromancer
  'Raise Dead':         'spell_shadow_animatedead',
  'Bone Shield':        'inv_chest_leather_raidbeastpandaria_n_01',
  'Death Coil':         'spell_shadow_deathcoil',
  'Corpse Explosion':   'spell_shadow_corpseexplosion',
  'Dark Pact':          'warlock_summon_darkglare',
  'Soul Harvest':       'spell_shadow_soulleech_3',
  'Skeletal Army':      'ability_rhonin_runicbarrier',
  'Undying Will':       'ability_warlock_eradicationpassive',
  'Siphon Life':        'spell_shadow_lifedrain',
  'Lich Form':          'spell_deathknight_lichborne',
  // Pyromancer
  'Fireball':           'spell_fire_fireball',
  'Ignite':             'spell_fire_flameshock',
  'Pyroblast':          'spell_fire_pyroblast',
  'Fire Ward':          'spell_fire_fireward',
  'Combustion':         'spell_fire_sealoffire',
  'Incinerate':         'spell_fire_incinerate',
  'Inferno':            'spell_fire_meteorstorm',
  'Flame Surge':        'ability_warrior_rampage',
  'Molten Armor':       'spell_fire_flamebolt',
  'Phoenix Form':       'ability_hunter_pet_phoenix',
  // Cultist
  'Shadow Bolt':        'spell_shadow_shadowbolt',
  'Dark Ritual':        'spell_shadow_gathershadows',
  'Void Touch':         'spell_shadow_possession',
  'Eldritch Ward':      'spell_shadow_antishadow',
  'Curse of Doom':      'spell_shadow_curseofmannoroth',
  'Void Form':          'spell_shadow_shadowform',
  'Ascendance':         'ability_racial_shadowmeld',
  'Soul Drain':         'spell_shadow_lifedrain02',
  'Wrath of the Old Gods': 'spell_shadow_shadowfury',
  'Hex':                'spell_shaman_hex',
  // Starcaller
  'Starfire':           'spell_arcane_starfire',
  'Moonfire':           'spell_nature_starfall',
  'Stardust':           'spell_arcane_arcane01',
  'Lunar Strike':       'spell_nature_moonsorrow',
  'Celestial Call':     'inv_misc_gem_diamond_03',
  'Astral Form':        'ability_druid_eclipse',
  'Nova':               'spell_arcane_prismaticcloak',
  // Sun Cleric
  'Holy Light':         'spell_holy_holybolt',
  'Barrier':            'spell_holy_holyprotection',
  'Radiance':           'spell_holy_divinespirit',
  'Smite':              'spell_holy_holysmite',
  'Consecration':       'spell_holy_innerfire',
  'Divine Form':        'spell_holy_divineshield',
  // Tinker
  'Rocket Boots':       'inv_boots_gunshots_d_01',
  'Deploy Turret':      'inv_engineering_90_cogwheel',
  'Clockwork Grenade':  'inv_misc_bomb_08',
  'Shield Generator':   'inv_shield_06',
  'Overcharge':         'spell_nature_lightningoverload',
  'Mech Suit':          'inv_misc_enggizmos_19',
  // Runemaster
  'Rune Strike':        'spell_frost_frozencore',
  'Runic Power':        'spell_arcane_arcanepotency',
  'Blood Rune':         'spell_deathknight_bloodboil',
  'Frost Rune':         'spell_deathknight_empowerruneblade2',
  'Unholy Rune':        'spell_deathknight_empowerruneblade',
  'Rune of Doom':       'ability_deathknight_runeweapon',
  // Primalist
  'Earth Shock':        'spell_nature_earthshock',
  'Lava Burst':         'spell_shaman_lavaflow',
  'Chain Lightning':    'spell_nature_chainlightning',
  'Primal Fury':        'ability_druid_primaltenacity',
  'Elemental Form':     'ability_shaman_elementalmastery',
  // Chronomancer
  'Time Warp':          'ability_mage_timewarp',
  'Haste':              'ability_mage_temporalrip',
  'Reverse':            'spell_arcane_massdispel',
  'Time Lock':          'ability_creature_cursed_02',
  'Chrono Form':        'ability_mage_timwarp',
  // Reaper
  'Shadow Step':        'ability_rogue_shadowstep',
  'Soul Rend':          'spell_shadow_shadowmend',
  'Mark of Death':      'ability_hunter_markedfordeath',
  'Grim Harvest':       'inv_misc_gravecandle_01',
  'Reap':               'achievement_halloween_witch_01',
  // Guardian
  'Shield Bash':        'ability_warrior_shieldbash',
  'Fortitude':          'spell_holy_devotionaura',
  'Iron Wall':          'inv_shield_06',
  'Last Stand':         'spell_holy_ashestoashes',
  'Guardian Form':      'ability_warrior_shieldmastery',
  // Monk
  'Tiger Strike':       'ability_warrior_tigersstrike',
  'Chi Wave':           'ability_monk_chiwave',
  'Jade Mist':          'ability_monk_touchofdeath',
  'Storm Roll':         'ability_monk_roll',
  'Ascension':          'ability_monk_risingsunkick',
  // Demon Hunter
  'Chaos Strike':       'ability_demonhunter_chaosstrike',
  'Fel Rush':           'ability_demonhunter_felrush',
  'Metamorphosis':      'ability_demonhunter_metamorphisys',
  'Soul Fragment':      'ability_demonhunter_consumemagic',
  // Stormbringer
  'Chain Lightning (Storm)': 'spell_nature_chainlightning',
  'Tempest':            'spell_nature_callstorm',
  'Storm Form':         'spell_nature_thunderstruck',
  // Witch Hunter
  'Silver Bullet':      'inv_ammo_bullet_03',
  'Hex (Witch)':        'spell_shaman_hex',
  'Holy Water':         'inv_potion_30',
  'Exorcism':           'spell_holy_excorcism',
  // Knight of Xoroth
  'Fel Blade':          'ability_warrior_swordandboard',
  'Dark Consecration':  'spell_shadow_shadowfury',
  'Xoroth Form':        'ability_warlock_demonicpower',
  // Barbarian
  'Rage':               'ability_warrior_warcry',
  'Whirlwind':          'ability_whirlwind',
  'Berserker Rage':     'spell_shadow_unholyfrenzy',
  'Recklessness':       'ability_warrior_recklessness',
  // Ranger
  'Multi-Shot':         'ability_upgrademoonglaive',
  'Aimed Shot':         'ability_hunter_aimedshot',
  'Camouflage':         'ability_stealth',
  'Track':              'ability_hunter_snipershot',
  // Son of Arugal
  'Worgen Form':        'ability_racial_worgenracial',
  'Howl':               'ability_druid_demoralizingroar',
  'Feral Lunge':        'ability_druid_feralcharge',
  'Scent of Blood':     'ability_warrior_bloodnova',
  // Witch Doctor
  'Fetish':             'ability_hunter_beasttaming',
  'Mojo':               'inv_potion_green_01',
  'Voodoo Doll':        'inv_voodoodoll_01',
  'Serpent Ward':       'ability_hunter_pet_serpent',
  // Disciple of Shadra
  'Web':                'ability_druid_shred',
  'Venom':              'ability_rogue_deadlybrew',
  'Spider Form':        'ability_druid_catform',
  'Brood Mother':       'ability_hunter_pet_spider',
};

// Fallback icon pools per node type
const FALLBACK_POOLS = {
  active: [
    'spell_fire_flamebolt', 'spell_arcane_blast', 'ability_warrior_punishingblow',
    'spell_shadow_shadowbolt', 'spell_nature_earthshock', 'ability_rogue_slicedice',
    'spell_holy_holysmite', 'spell_frost_frostbolt', 'ability_warrior_focusedrage',
    'ability_backstab', 'spell_shadow_shadowfury', 'spell_fire_firebolt02',
  ],
  passive: [
    'spell_shadow_manaburn', 'ability_warrior_savageblow', 'spell_nature_spiritarmor',
    'ability_warrior_armoredtotheteeth', 'spell_holy_devotionaura', 'inv_misc_gem_diamond_01',
    'ability_druid_primaltenacity', 'spell_arcane_arcanepotency', 'ability_warlock_eradicationpassive',
    'spell_holy_auramastery', 'ability_hunter_mastermarksman', 'inv_misc_gem_ruby_01',
  ],
  choice: [
    'ability_racial_shadowmeld', 'spell_holy_divineshield', 'ability_mage_timewarp',
    'ability_demonhunter_metamorphisys', 'ability_shaman_elementalmastery', 'ability_druid_eclipse',
  ],
};

// Simple deterministic hash — no crypto needed
function strHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getNodeIconUrl(nodeId: string, nodeName: string, nodeType: string): string {
  // 1. Check known names first
  const named = NAMED_ICONS[nodeName];
  if (named) return `${ZAMIMG}/${named}.jpg`;

  // 2. Fall back to type-based pool
  const pool =
    nodeType === 'choice'
      ? FALLBACK_POOLS.choice
      : nodeType === 'passive'
      ? FALLBACK_POOLS.passive
      : FALLBACK_POOLS.active;

  const idx = strHash(nodeId) % pool.length;
  return `${ZAMIMG}/${pool[idx]}.jpg`;
}
