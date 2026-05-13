// Frontend-only icon + background system.
// Does NOT modify the API data structure — purely cosmetic.

const COA_BG_SIZE = '5500% 5500%';

// ── Class background gradients ────────────────────────────────────────────────
// Each value is a CSS background string applied behind the talent trees.
export const CLASS_BG_GRADIENT: Record<string, string> = {
  suncleric:        'radial-gradient(ellipse 100% 80% at 50% 0%, #3d2e00 0%, #1a1200 55%, #0c0900 100%)',
  necromancer:      'radial-gradient(ellipse 100% 80% at 50% 0%, #0d3d26 0%, #051a10 55%, #020a06 100%)',
  pyromancer:       'radial-gradient(ellipse 100% 80% at 50% 0%, #3d1200 0%, #1a0700 55%, #090200 100%)',
  cultist:          'radial-gradient(ellipse 100% 80% at 50% 0%, #240e3d 0%, #110620 55%, #060309 100%)',
  starcaller:       'radial-gradient(ellipse 100% 80% at 50% 0%, #0c1a4d 0%, #060e2a 55%, #020408 100%)',
  tinker:           'radial-gradient(ellipse 100% 80% at 50% 0%, #332500 0%, #1a1200 55%, #080600 100%)',
  runemaster:       'radial-gradient(ellipse 100% 80% at 50% 0%, #3d000c 0%, #1f0005 55%, #090002 100%)',
  primalist:        'radial-gradient(ellipse 100% 80% at 50% 0%, #0d3314 0%, #071a07 55%, #020602 100%)',
  reaper:           'radial-gradient(ellipse 100% 80% at 50% 0%, #1a1a26 0%, #0d0d14 55%, #050507 100%)',
  venomancer:       'radial-gradient(ellipse 100% 80% at 50% 0%, #270d33 0%, #14071a 55%, #060209 100%)',
  chronomancer:     'radial-gradient(ellipse 100% 80% at 50% 0%, #003333 0%, #001a1a 55%, #000808 100%)',
  bloodmage:        'radial-gradient(ellipse 100% 80% at 50% 0%, #3d0a10 0%, #1f0508 55%, #080203 100%)',
  guardian:         'radial-gradient(ellipse 100% 80% at 50% 0%, #082040 0%, #041020 55%, #020609 100%)',
  stormbringer:     'radial-gradient(ellipse 100% 80% at 50% 0%, #00203d 0%, #001020 55%, #000409 100%)',
  felsworn:         'radial-gradient(ellipse 100% 80% at 50% 0%, #133d13 0%, #0a1f0a 55%, #030803 100%)',
  barbarian:        'radial-gradient(ellipse 100% 80% at 50% 0%, #330a0a 0%, #1a0505 55%, #080202 100%)',
  witchdoctor:      'radial-gradient(ellipse 100% 80% at 50% 0%, #003333 0%, #001a1a 55%, #000909 100%)',
  witchhunter:      'radial-gradient(ellipse 100% 80% at 50% 0%, #332a0d 0%, #1a1407 55%, #080603 100%)',
  knightofxoroth:   'radial-gradient(ellipse 100% 80% at 50% 0%, #330000 0%, #1a0000 55%, #090000 100%)',
  ranger:           'radial-gradient(ellipse 100% 80% at 50% 0%, #142800 0%, #0a1400 55%, #040600 100%)',
  templar:          'radial-gradient(ellipse 100% 80% at 50% 0%, #2e2e2c 0%, #1a1a18 55%, #08080a 100%)',
};

/**
 * Icon data returned by getNodeIconStyle.
 * Use `type` to decide how to render:
 *   'sprite'      — render a div/span with backgroundImage + backgroundPosition
 *   'placeholder' — no sprite match; render a muted colored square
 */
export type NodeIconData =
  | { type: 'sprite'; backgroundImage: string; backgroundPosition: string; backgroundSize: string }
  | { type: 'placeholder' };

/**
 * Slug-to-position map built from the official Ascension CSS sprite sheet.
 * Populated lazily on first call from the pre-built talent-icon-manifest.json
 * that is copied to public/ at build time.
 *
 * Keys are lowercase iconPath leaf names after CSS normalisation
 * (leading _ prepended when the name starts with a digit or hyphen).
 */
let _slugMap: Record<string, { x: string; y: string }> | null = null;
let _loadPromise: Promise<void> | null = null;

/** Kick off manifest load — called once at module init. */
export function loadIconManifest(): void {
  if (_slugMap !== null || _loadPromise !== null) return;
  _loadPromise = fetch('/talent-icon-manifest.json')
    .then(r => r.json())
    .then((data: { slugMap: Record<string, { x: string; y: string }> }) => {
      _slugMap = data.slugMap ?? {};
    })
    .catch(() => {
      _slugMap = {};
      if (typeof console !== 'undefined') {
        console.warn('[icons] Failed to load talent-icon-manifest.json — all icons will show placeholder');
      }
    });
}

/**
 * Returns sprite style data for a talent node icon, or a placeholder signal.
 *
 * Priority:
 *   1. extractedIcon (iconPath from manifest/addon) → CSS slug → sprite position
 *   2. placeholder (warn once per missing slug)
 *
 * The caller is responsible for rendering a sprite div or placeholder accordingly.
 */
const _warned = new Set<string>();

export function getNodeIconStyle(
  nodeId: string,
  nodeName: string,
  nodeType: string,
  extractedIcon?: string,
): NodeIconData {
  const slugMap = _slugMap;

  if (extractedIcon && slugMap !== null) {
    const lower = extractedIcon.toLowerCase();
    const isIconsPath =
      lower.startsWith('interface\\icons\\') || lower.startsWith('interface/icons/');
    if (isIconsPath) {
      const raw = lower.replace(/\\/g, '/').split('/').pop() ?? '';
      if (raw && raw !== 'talents') {
        // Try slug as-is, then with leading _
        const slug = /^[0-9-]/.test(raw) ? '_' + raw : raw;
        const entry = slugMap[slug] ?? slugMap[raw];
        if (entry) {
          return {
            type: 'sprite',
            backgroundImage: `url('https://ascension.gg/icon/coa-builder-icon.webp')`,
            backgroundPosition: `${entry.x} ${entry.y}`,
            backgroundSize: COA_BG_SIZE,
          };
        }
        if (!_warned.has(slug)) {
          _warned.add(slug);
          console.warn(`[icons] No sprite entry for "${slug}" (node: ${nodeName})`);
        }
      }
    }
  }

  return { type: 'placeholder' };
}

/** Legacy shim — returns a CSS background-image data URL for the sprite, or empty string.
 *  Prefer getNodeIconStyle for new code. */
export function getNodeIconUrl(
  nodeId: string,
  nodeName: string,
  nodeType: string,
  extractedIcon?: string,
): string {
  const data = getNodeIconStyle(nodeId, nodeName, nodeType, extractedIcon);
  if (data.type === 'sprite') return data.backgroundImage.slice(5, -2);
  return '';
}
