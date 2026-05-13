/**
 * parse-sprite-css.mjs
 *
 * Parses the official Ascension builder CSS bundle to extract class portrait
 * sprite background-position mappings from the coa-builder-icon.webp sprite sheet.
 *
 * Usage: node scripts/parse-sprite-css.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

const css = readFileSync('scripts/manifest-output/_next_static_chunks_0-j8j-f6dlgw1.css', 'utf8');

console.log(`CSS length: ${css.length} chars`);

// ── 1. Find all rules that reference coa-builder-icon ────────────────────────
const coaIconMatches = [...css.matchAll(/coa-builder-icon[^;}"']{0,400}/g)];
console.log(`\ncoa-builder-icon references: ${coaIconMatches.length}`);
coaIconMatches.slice(0, 5).forEach(m => console.log(' ', m[0].slice(0, 200)));

// ── 2. Find background-position rules near class names ────────────────────────
// CSS rules with class names in selectors
const classNames = [
  'barbarian', 'witchdoctor', 'witch-doctor', 'witch_doctor',
  'witchhunter', 'witch-hunter', 'witch_hunter',
  'guardian', 'templar', 'bloodmage', 'blood-mage',
  'ranger', 'chronomancer', 'necromancer', 'pyromancer',
  'cultist', 'starcaller', 'star-caller',
  'suncleric', 'sun-cleric', 'sun_cleric',
  'tinker', 'reaper', 'venomancer',
  'primalist', 'runemaster', 'stormbringer',
  'felsworn', 'knightofxoroth', 'knight-of-xoroth', 'knight_of_xoroth',
];

console.log('\n=== Class name matches in CSS ===');
for (const cls of classNames) {
  const pat = new RegExp(`[.#][^{}]*${cls}[^{}]*\\{[^{}]{0,300}\\}`, 'gi');
  const matches = [...css.matchAll(pat)];
  if (matches.length > 0) {
    console.log(`\n${cls} (${matches.length} rules):`);
    matches.slice(0, 3).forEach(m => console.log(' ', m[0].slice(0, 300)));
  }
}

// ── 3. Find ALL background-position rules with percentage values ──────────────
// Look for rules that set background-position with % values (sprite sheet positions)
const bgPosRules = [...css.matchAll(/\{[^{}]*background-position\s*:\s*(\d+(?:\.\d+)?%)\s+(\d+(?:\.\d+)?%)[^{}]*\}/g)];
console.log(`\n=== Background-position rules with % (${bgPosRules.length} total) ===`);

// Extract selector + position pairs
const selectorPosPattern = /([.#][^{]+)\s*\{[^{}]*background-position\s*:\s*(\d+(?:\.\d+)?%)\s+(\d+(?:\.\d+)?%)[^{}]*\}/g;
const selectorPosMatches = [...css.matchAll(selectorPosPattern)];
console.log(`\nSelector + background-position pairs: ${selectorPosMatches.length}`);
selectorPosMatches.slice(0, 30).forEach(m => {
  console.log(`  ${m[1].trim()} → ${m[2]} ${m[3]}`);
});

// ── 4. Look for background-size: 5500% 5500% rules ───────────────────────────
const spriteRules = [...css.matchAll(/([.#][^{]+)\s*\{[^{}]*background-size\s*:\s*5500%[^{}]*\}/g)];
console.log(`\n=== Rules with background-size: 5500% (${spriteRules.length} rules) ===`);
spriteRules.forEach(m => console.log(' ', m[0].slice(0, 400)));

// ── 5. Find rules referencing the specific sprite URL ────────────────────────
const spriteUrlRules = [...css.matchAll(/([.#][^{]+)\s*\{[^{}]*coa-builder-icon[^{}]*\}/g)];
console.log(`\n=== Rules with coa-builder-icon URL (${spriteUrlRules.length} rules) ===`);
spriteUrlRules.forEach(m => console.log(' ', m[0].slice(0, 500)));

// ── 6. Search for specific known sprite positions to verify ──────────────────
const knownPositions = [
  { cls: 'suncleric', x: '81.4815%', y: '100%' },
  { cls: 'necromancer', x: '64.8148%', y: '100%' },
  { cls: 'barbarian', x: '51.8519%', y: '100%' },
];
for (const { cls, x, y } of knownPositions) {
  const cleanX = x.replace('.', '\\.').replace('%', '%');
  const found = css.includes(x.replace('%',''));
  console.log(`\nKnown position ${cls} (${x} ${y}): found in CSS = ${found}`);
  if (found) {
    const idx = css.indexOf(x.replace('%',''));
    console.log('  Context:', css.slice(Math.max(0,idx-200), idx+100));
  }
}

// ── 7. Check the 09tvu3g2u93bl.css and 14~buxndcr6~f.css files too ──────────
for (const fname of ['09tvu3g2u93bl', '14~buxndcr6~f', '0tlgu6.g55gse']) {
  try {
    const altCss = readFileSync(`scripts/manifest-output/_next_static_chunks_${fname}.css`, 'utf8');
    const altSpriteRules = [...altCss.matchAll(/[.#][^{]+\{[^{}]*5500%[^{}]*\}/g)];
    const altCoaRefs = [...altCss.matchAll(/coa-builder-icon[^;}"']{0,200}/g)];
    console.log(`\n${fname}.css: ${altSpriteRules.length} 5500% rules, ${altCoaRefs.length} coa-builder-icon refs`);
    altCoaRefs.slice(0, 3).forEach(m => console.log(' ', m[0].slice(0, 200)));
  } catch (e) {
    console.log(`${fname}.css: could not read`);
  }
}

console.log('\nDone.');
