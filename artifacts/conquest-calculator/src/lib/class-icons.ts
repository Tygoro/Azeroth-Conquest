/**
 * Centralized class icon system for Conquest of Azeroth.
 *
 * Sprite positions extracted verbatim from the official Ascension CoA builder CSS
 * (/_next/static/chunks/0-j8j-f6dlgw1.css) served at ascension.gg.
 *
 * The official CSS defines a `.coa-builder-icon.class-{codename}` rule for each
 * class. The 21 sprite codenames are mapped below to the 21 CoA classIds.
 * Every mapping is derived directly from the official CSS — no thematic guessing.
 *
 * Sprite sheet: https://ascension.gg/icon/coa-builder-icon.webp
 * background-size: 5500% 5500%  (55×55 grid)
 *
 * Official CSS codename → CoA className mapping:
 *   barbarian    → Barbarian     (classId 12)
 *   witchdoctor  → Witch Doctor  (classId 13)
 *   demonhunter  → Felsworn      (classId 14)
 *   witchhunter  → Witch Hunter  (classId 15)
 *   stormbringer → Stormbringer  (classId 16)
 *   sonofarugal  → Knight of Xoroth (classId 17)
 *   guardian     → Guardian      (classId 18)
 *   monk         → Templar       (classId 19)
 *   spiritmage   → Bloodmage     (classId 20)
 *   ranger       → Ranger        (classId 21)
 *   chronomancer → Chronomancer  (classId 22)
 *   necromancer  → Necromancer   (classId 23)
 *   pyromancer   → Pyromancer    (classId 24)
 *   cultist      → Cultist       (classId 25)
 *   starcaller   → Starcaller    (classId 26)
 *   suncleric    → Sun Cleric    (classId 27)
 *   tinker       → Tinker        (classId 28)
 *   fleshwarden  → Venomancer    (classId 29)
 *   reaper       → Reaper        (classId 30)
 *   wildwalker   → Primalist     (classId 31)
 *   prophet      → Runemaster    (classId 32)
 */

/** URL of the official CoA icon sprite sheet (Ascension CDN). */
export const COA_SPRITE_URL = 'https://ascension.gg/icon/coa-builder-icon.webp';

/**
 * Sprite entry: background-position percentages for the official sprite.
 * background-size is always "5500% 5500%" per the official CSS.
 */
export interface ClassSpriteEntry {
  /** CSS background-position X value (e.g. "81.4815%") */
  x: string;
  /** CSS background-position Y value (e.g. "100%") */
  y: string;
}

/**
 * Official sprite positions — extracted verbatim from Ascension builder CSS.
 * Maps our internal classId key → official sprite coordinates.
 * ALL 21 entries are authoritative; none are guessed or thematically substituted.
 */
export const CLASS_SPRITE_MAP: Record<string, ClassSpriteEntry> = {
  // classId 12
  barbarian:      { x: '51.8519%', y: '100%' },
  // classId 13
  witchdoctor:    { x: '87.037%',  y: '100%' },
  // classId 14 — official CSS codename: demonhunter
  felsworn:       { x: '57.4074%', y: '100%' },
  // classId 15
  witchhunter:    { x: '88.8889%', y: '100%' },
  // classId 16
  stormbringer:   { x: '79.6296%', y: '100%' },
  // classId 17 — official CSS codename: sonofarugal
  knightofxoroth: { x: '59.2593%', y: '100%' },
  // classId 18
  guardian:       { x: '61.1111%', y: '100%' },
  // classId 19 — official CSS codename: monk
  templar:        { x: '62.963%',  y: '100%' },
  // classId 20 — official CSS codename: spiritmage
  bloodmage:      { x: '74.0741%', y: '100%' },
  // classId 21
  ranger:         { x: '70.3704%', y: '100%' },
  // classId 22
  chronomancer:   { x: '53.7037%', y: '100%' },
  // classId 23
  necromancer:    { x: '64.8148%', y: '100%' },
  // classId 24
  pyromancer:     { x: '68.5185%', y: '100%' },
  // classId 25
  cultist:        { x: '55.5556%', y: '100%' },
  // classId 26
  starcaller:     { x: '77.7778%', y: '100%' },
  // classId 27
  suncleric:      { x: '81.4815%', y: '100%' },
  // classId 28
  tinker:         { x: '83.3333%', y: '100%' },
  // classId 29 — official CSS codename: fleshwarden
  venomancer:     { x: '66.6667%', y: '100%' },
  // classId 30
  reaper:         { x: '72.2222%', y: '100%' },
  // classId 31 — official CSS codename: wildwalker
  primalist:      { x: '85.1852%', y: '100%' },
  // classId 32 — official CSS codename: prophet
  runemaster:     { x: '75.9259%', y: '100%' },
};

/**
 * Returns an inline CSS style object that renders the class icon from the
 * official Ascension CoA sprite sheet.
 */
export function getClassSpriteStyle(classId: string): Record<string, string> | null {
  const entry = CLASS_SPRITE_MAP[classId];
  if (!entry) return null;
  return {
    backgroundImage: `url(${COA_SPRITE_URL})`,
    backgroundPosition: `${entry.x} ${entry.y}`,
    backgroundSize: '5500% 5500%',
    backgroundRepeat: 'no-repeat',
  };
}

/**
 * Preload the sprite sheet once at app start to prevent initial render flash.
 * Call from App root useEffect.
 */
export function preloadClassIcons(): void {
  const img = new Image();
  img.src = COA_SPRITE_URL;
}
