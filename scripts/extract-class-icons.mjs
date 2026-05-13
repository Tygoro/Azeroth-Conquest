/**
 * extract-class-icons.mjs
 *
 * Searches the voljin RSC payload and HTML for class portrait / icon mappings.
 * Also extracts talent node iconPath values from manifest-nodes-all.json
 * and derives the correct URL pattern for the official icon CDN.
 *
 * Usage: node scripts/extract-class-icons.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const OUT_DIR = 'scripts/manifest-output';

// ── 1. Search voljin HTML for CSS bundle URLs and sprite references ──────────
console.log('\n=== Searching voljin HTML ===');
let html = '';
try {
  html = readFileSync('C:/Users/tygoro/Downloads/voljin', 'utf8');
  console.log(`Loaded voljin HTML (${html.length} chars)`);
} catch (e) {
  console.error('Could not read voljin HTML:', e.message);
}

// CSS bundle URLs
const cssBundles = [...html.matchAll(/_next\/static\/css\/[^"'<>\s]+/g)].map(m => m[0]);
console.log('CSS bundles found:', [...new Set(cssBundles)]);

// JS chunk URLs (look for main app chunks)
const jsChunks = [...html.matchAll(/_next\/static\/chunks\/[^"'<>\s]+\.js/g)].map(m => m[0]);
console.log('JS chunks (first 10):', [...new Set(jsChunks)].slice(0, 10));

// coa-builder-icon references
const iconRefs = [...html.matchAll(/coa-builder-icon[^;}"]{0,300}/g)].map(m => m[0].slice(0, 200));
console.log('\ncoa-builder-icon refs:', iconRefs.slice(0, 5));

// background-position in inline styles
const bgPos = [...html.matchAll(/background-position\s*:\s*[^;}"]{3,80}/g)].map(m => m[0]);
console.log('background-position values (first 20):', [...new Set(bgPos)].slice(0, 20));

// ── 2. Search voljin_payload.json for class icon data ───────────────────────
console.log('\n=== Searching voljin_payload.json ===');
let payload = '';
try {
  payload = readFileSync('C:/Users/tygoro/Downloads/voljin_payload.json', 'utf8');
  console.log(`Loaded payload JSON (${payload.length} chars)`);
} catch (e) {
  console.error('Could not read payload:', e.message);
}

// Look for class icon / portrait data patterns
const iconPatterns = [
  /classIcon\s*["':]\s*["']([^"']+)["']/g,
  /portrait\s*["':]\s*["']([^"']+)["']/gi,
  /"icon"\s*:\s*["']([^"']+)["']/g,
  /class_icon[^"',]{0,100}/gi,
  /builder-class[^"',\s]{0,60}/gi,
  /coa-class[^"',\s]{0,60}/gi,
];

for (const pat of iconPatterns) {
  const found = [...payload.matchAll(pat)].map(m => m[0].slice(0, 120));
  if (found.length > 0) {
    console.log(`\nPattern ${pat.source} (${found.length} hits, first 5):`);
    found.slice(0, 5).forEach(f => console.log(' ', f));
  }
}

// ── 3. Extract iconPath from manifest-nodes-all.json and build URL map ───────
console.log('\n=== Analyzing manifest-nodes-all.json iconPath values ===');
let nodes = [];
try {
  nodes = JSON.parse(readFileSync('scripts/manifest-output/manifest-nodes-all.json', 'utf8'));
  console.log(`Loaded ${nodes.length} nodes`);
} catch (e) {
  console.error('Could not read manifest-nodes-all.json:', e.message);
}

// Collect all unique iconPaths
const allIconPaths = [...new Set(nodes.map(n => n.iconPath).filter(Boolean))];
console.log(`Total unique iconPaths: ${allIconPaths.length}`);
console.log('First 10 iconPaths:', allIconPaths.slice(0, 10));

// Show sample iconPaths per class
const classSamples = {};
for (const node of nodes) {
  if (!node.iconPath) continue;
  if (!classSamples[node.className]) classSamples[node.className] = [];
  if (classSamples[node.className].length < 3) classSamples[node.className].push(node.iconPath);
}
console.log('\nSample iconPaths per class:');
for (const [cls, paths] of Object.entries(classSamples)) {
  console.log(`  ${cls}: ${paths.join(', ')}`);
}

// ── 4. Find class-level icon/portrait data specifically ──────────────────────
// Look for nodes that might be class header icons or spec tab header icons
console.log('\n=== Looking for class portrait / tab icon data ===');

// Check if any class-level manifest data has an icon field
// (classes.json doesn't have icons but maybe there's another source)
// Look in voljin_payload for className + icon co-occurrence
const classNames = ['Barbarian','Witch Doctor','Felsworn','Witch Hunter','Stormbringer',
  'Knight of Xoroth','Guardian','Templar','Bloodmage','Ranger','Chronomancer',
  'Necromancer','Pyromancer','Cultist','Starcaller','Sun Cleric','Tinker',
  'Primalist','Reaper','Venomancer','Runemaster'];

for (const cls of classNames) {
  const escapedCls = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`"${escapedCls}"[\\s\\S]{0,200}?icon[\\s\\S]{0,100}`, 'i');
  const match = payload.match(pattern);
  if (match) {
    console.log(`${cls}: ${match[0].slice(0, 150)}`);
  }
}

// ── 5. Also check for the builder CSS in embedded style tags ────────────────
console.log('\n=== Checking for embedded CSS in HTML ===');
const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]{0,5000}?)<\/style>/gi)].map(m => m[1]);
console.log(`Found ${styleBlocks.length} <style> blocks`);
styleBlocks.forEach((block, i) => {
  if (block.includes('background') || block.includes('icon')) {
    console.log(`Style block ${i} (${block.length} chars):`, block.slice(0, 300));
  }
});

// ── 6. Look for the CSS with Tailwind/background-image patterns ──────────────
const bgImage = [...html.matchAll(/background-image\s*:\s*url\([^)]+\)/g)].map(m => m[0]);
console.log('\nbackground-image URLs in HTML:', [...new Set(bgImage)].slice(0, 20));

console.log('\nDone.');
