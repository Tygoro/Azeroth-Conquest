/**
 * find-class-sprite-map.mjs
 *
 * Searches the saved JS chunks for the class→sprite-name mapping used by
 * the official Ascension builder React components.
 *
 * Usage: node scripts/find-class-sprite-map.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { readdirSync } from 'fs';

// List all saved JS/CSS in manifest-output
const files = readdirSync('scripts/manifest-output').filter(f =>
  f.endsWith('.js') || f.endsWith('.css')
);
console.log(`Found ${files.length} saved bundle files in manifest-output`);

// Known sprite class names from CSS
const spriteNames = [
  'barbarian', 'chronomancer', 'cultist', 'demonhunter', 'fleshwarden',
  'guardian', 'monk', 'necromancer', 'prophet', 'pyromancer', 'ranger',
  'reaper', 'sonofarugal', 'spiritmage', 'starcaller', 'stormbringer',
  'suncleric', 'tinker', 'wildwalker', 'witchdoctor', 'witchhunter',
];

// CoA class names from manifest
const coaClasses = [
  'Barbarian', 'Witch Doctor', 'Felsworn', 'Witch Hunter', 'Stormbringer',
  'Knight of Xoroth', 'Guardian', 'Templar', 'Bloodmage', 'Ranger',
  'Chronomancer', 'Necromancer', 'Pyromancer', 'Cultist', 'Starcaller',
  'Sun Cleric', 'Tinker', 'Primalist', 'Reaper', 'Venomancer', 'Runemaster',
];

// Search JS chunks for class → sprite mapping patterns
for (const fname of files) {
  if (!fname.endsWith('.js')) continue;
  const content = readFileSync(`scripts/manifest-output/${fname}`, 'utf8');

  // Look for sprite name → class assignment patterns
  // e.g. "demonhunter" near "Felsworn" or classId 14
  const hasSpriteName = spriteNames.some(sn => content.includes(sn));
  const hasClassName = coaClasses.some(cn => content.includes(cn));

  if (hasSpriteName || hasClassName) {
    console.log(`\n=== ${fname} (${content.length} chars) ===`);

    // Show context around sprite names
    for (const sn of spriteNames) {
      const idx = content.indexOf(sn);
      if (idx !== -1) {
        console.log(`  "${sn}" at ${idx}: ...${content.slice(Math.max(0,idx-80), idx+120)}...`);
      }
    }
  }
}

// Also search the main CSS file for class-specific rules beyond the sprite sheet
const mainCss = readFileSync('scripts/manifest-output/_next_static_chunks_0-j8j-f6dlgw1.css', 'utf8');

// Extract ALL class-* rules with sprite positions
console.log('\n=== Official class-* sprite positions ===');
const classRules = [...mainCss.matchAll(/\.coa-builder-icon\.class-([a-z0-9-]+)\{background-position:([^;]+);background-size:([^}]+)\}/g)];
const officialSpriteMap = {};
for (const m of classRules) {
  const [, name, pos, size] = m;
  const [x, y] = pos.split(/\s+/);
  officialSpriteMap[name] = { x, y, size: size.replace('}','').trim() };
  console.log(`  class-${name}: x=${x} y=${y}`);
}

// Now determine what CoA class each sprite name maps to
// This requires searching the JS for the mapping
console.log('\n=== Looking for className → spriteName mapping in all JS ===');
const mapPatterns = [
  // "Venomancer": "venomancer" or classId: N, icon: "xxx"
  /["'](?:Venomancer|venomancer)["'][^:]{0,5}[:"']\s*["']([a-z-]+)["']/g,
  // className + class- pattern nearby
  /class-(?:barbarian|chronomancer|cultist|demonhunter|fleshwarden|guardian|monk|necromancer|prophet|pyromancer|ranger|reaper|sonofarugal|spiritmage|starcaller|stormbringer|suncleric|tinker|wildwalker|witchdoctor|witchhunter)[^,;{}'"]{0,100}/g,
];

// Now search the main saved HTML payload
const payload = readFileSync('C:/Users/tygoro/Downloads/voljin_payload.json', 'utf8');
console.log('\n=== Searching payload for class→icon mapping ===');

// Look for class icon field in the payload classes data
const classIconPattern = /["'](?:icon|classIcon|portrait|spriteClass|iconClass|iconName)['"]\s*:\s*["']([^"']+)["']/g;
const iconMatches = [...payload.matchAll(classIconPattern)];
console.log(`classIcon-like fields: ${iconMatches.length}`);
iconMatches.slice(0, 20).forEach(m => console.log(' ', m[0].slice(0, 100)));

// Search for the string "venomancer" in payload  
const venIdx = payload.toLowerCase().indexOf('venomancer');
if (venIdx !== -1) {
  console.log('\nVenomancer context in payload:', payload.slice(Math.max(0,venIdx-100), venIdx+200));
}

// Look for class data objects with id + name + icon fields together
const classObjectPattern = /classId['"]\s*:\s*(\d+)[^}]{0,200}className['"]\s*:\s*["']([^"']+)["'][^}]{0,200}/g;
const classObjects = [...payload.matchAll(classObjectPattern)];
console.log(`\nClass objects in payload: ${classObjects.length}`);
classObjects.slice(0, 5).forEach(m => console.log(' id:', m[1], 'name:', m[2], '...', m[0].slice(0,200)));

// Save the official sprite map
writeFileSync('scripts/manifest-output/official-class-sprite-map.json', JSON.stringify(officialSpriteMap, null, 2));
console.log('\nSaved official-class-sprite-map.json');
console.log(JSON.stringify(officialSpriteMap, null, 2));
