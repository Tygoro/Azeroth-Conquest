/**
 * generate-icon-manifest.mjs
 *
 * Extracts the complete icon → sprite position mapping from the official CSS
 * and cross-references with manifest-nodes-all.json to build a talent icon manifest.
 *
 * Output: scripts/manifest-output/talent-icon-manifest.json
 */

import { readFileSync, writeFileSync } from 'fs';

const css = readFileSync('scripts/manifest-output/_next_static_chunks_0-j8j-f6dlgw1.css', 'utf8');
const nodes = JSON.parse(readFileSync('scripts/manifest-output/manifest-nodes-all.json', 'utf8'));

// ── Extract ALL sprite position entries from CSS ──────────────────────────────
// Pattern: .coa-builder-icon.{slug}{background-position:X Y;background-size:...}
const spriteEntries = {};
const re = /\.coa-builder-icon\.([a-z0-9_()\-]+)\{background-position:([0-9.]+%|0)\s+([0-9.]+%|0);background-size:([^}]+)\}/gi;
for (const m of css.matchAll(re)) {
  const [, slug, x, y] = m;
  spriteEntries[slug] = { x, y };
}

console.log(`Total sprite entries in CSS: ${Object.keys(spriteEntries).length}`);

// ── Map nodeId → official sprite position via iconPath ────────────────────────
let matched = 0;
let unmatched = 0;
const unmatchedIcons = new Set();

const nodeIconMap = {}; // nodeId → { x, y, slug }

for (const node of nodes) {
  if (!node.iconPath) continue;
  const slug = node.iconPath.toLowerCase().replace(/\\/g, '/').split('/').pop();
  const entry = spriteEntries[slug];
  if (entry) {
    nodeIconMap[node.nodeId] = { slug, x: entry.x, y: entry.y };
    matched++;
  } else {
    unmatched++;
    unmatchedIcons.add(slug);
  }
}

console.log(`Matched: ${matched}, Unmatched: ${unmatched}`);
console.log(`Unmatched slugs (${unmatchedIcons.size}):`);
[...unmatchedIcons].slice(0, 30).forEach(s => console.log(' ', s));

// ── Build talent name → sprite position map (for easy lookup by name) ─────────
const nameIconMap = {};
for (const node of nodes) {
  if (!node.iconPath) continue;
  const slug = node.iconPath.toLowerCase().replace(/\\/g, '/').split('/').pop();
  const entry = spriteEntries[slug];
  if (entry && node.name) {
    // Only store if not already set (avoid overwriting with different class version)
    if (!nameIconMap[node.name]) {
      nameIconMap[node.name] = { slug, x: entry.x, y: entry.y, nodeId: node.nodeId };
    }
  }
}

console.log(`Unique talent names with icons: ${Object.keys(nameIconMap).length}`);

// ── Build class portrait sprite map ──────────────────────────────────────────
const classPortraitEntries = {};
for (const [slug, pos] of Object.entries(spriteEntries)) {
  if (slug.startsWith('class-')) {
    classPortraitEntries[slug.replace('class-', '')] = pos;
  }
}

console.log('\nClass portrait entries:');
for (const [name, pos] of Object.entries(classPortraitEntries)) {
  console.log(`  ${name}: x=${pos.x} y=${pos.y}`);
}

// ── Write manifest ────────────────────────────────────────────────────────────
const manifest = {
  meta: {
    source: 'official Ascension CoA builder CSS (0-j8j-f6dlgw1.css)',
    spriteUrl: 'https://ascension.gg/icon/coa-builder-icon.webp',
    backgroundSize: '5500% 5500%',
    totalSpriteEntries: Object.keys(spriteEntries).length,
    matchedNodes: matched,
    unmatchedNodes: unmatched,
  },
  classPortraits: classPortraitEntries,
  nodeIcons: nodeIconMap,       // nodeId → {slug, x, y}
  nameIcons: nameIconMap,       // talentName → {slug, x, y, nodeId}
  slugMap: spriteEntries,       // iconSlug → {x, y}  (all CSS entries)
};

writeFileSync('scripts/manifest-output/talent-icon-manifest.json', JSON.stringify(manifest, null, 2));
console.log('\nSaved talent-icon-manifest.json');
