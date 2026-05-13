/**
 * generate-icon-manifest2.mjs — fixed regex to capture all CSS icon entries
 */
import { readFileSync, writeFileSync } from 'fs';

const css = readFileSync('scripts/manifest-output/_next_static_chunks_0-j8j-f6dlgw1.css', 'utf8');
const nodes = JSON.parse(readFileSync('scripts/manifest-output/manifest-nodes-all.json', 'utf8'));

// More permissive: capture ANY selector segment after .coa-builder-icon.
// CSS class names can't have spaces but can have underscores, hyphens, parens, numbers
const spriteEntries = {};

// Split on .coa-builder-icon. and parse each block
const blocks = css.split('.coa-builder-icon.');
for (const block of blocks.slice(1)) {
  // Find the CSS class name (up to the first {)
  const braceIdx = block.indexOf('{');
  if (braceIdx === -1) continue;
  const slug = block.slice(0, braceIdx).trim();

  // Extract background-position
  const posMatch = block.match(/background-position:([0-9.]+%|0)\s+([0-9.]+%|0)/);
  if (!posMatch) continue;

  spriteEntries[slug] = { x: posMatch[1], y: posMatch[2] };
}

console.log(`Total sprite entries: ${Object.keys(spriteEntries).length}`);
console.log('Sample entries:', Object.entries(spriteEntries).slice(0, 5));

// Check known problematic slugs
const testSlugs = ['5_archerskill48_border', 'novart_passivemastery_(11)_border', '_silence_bloodelf', '_d3revenge'];
for (const s of testSlugs) {
  console.log(`  "${s}": ${JSON.stringify(spriteEntries[s])}`);
}

// Map nodes
let matched = 0, unmatched = 0;
const nodeIconMap = {};
const nameIconMap = {};
const unmatchedSlugs = new Set();

for (const node of nodes) {
  if (!node.iconPath) { unmatched++; continue; }
  const slug = node.iconPath.toLowerCase().replace(/\\/g, '/').split('/').pop();
  const entry = spriteEntries[slug];
  if (entry) {
    nodeIconMap[node.nodeId] = { slug, x: entry.x, y: entry.y };
    if (node.name && !nameIconMap[node.name]) {
      nameIconMap[node.name] = { slug, x: entry.x, y: entry.y, nodeId: node.nodeId };
    }
    matched++;
  } else {
    unmatched++;
    unmatchedSlugs.add(slug);
  }
}

console.log(`\nMatched: ${matched}, Unmatched: ${unmatched}`);
if (unmatchedSlugs.size > 0) {
  console.log(`Unmatched slugs (${unmatchedSlugs.size}):`);
  [...unmatchedSlugs].slice(0, 20).forEach(s => console.log('  ', s));
}

// Class portrait map
const classPortraitEntries = {};
for (const [slug, pos] of Object.entries(spriteEntries)) {
  if (slug.startsWith('class-')) {
    classPortraitEntries[slug.slice(6)] = pos;
  }
}

const manifest = {
  meta: {
    source: 'Ascension CoA builder CSS 0-j8j-f6dlgw1.css',
    spriteUrl: 'https://ascension.gg/icon/coa-builder-icon.webp',
    backgroundSize: '5500% 5500%',
    totalSpriteEntries: Object.keys(spriteEntries).length,
    matchedNodes: matched,
    unmatchedNodes: unmatched,
  },
  classPortraits: classPortraitEntries,
  nodeIcons: nodeIconMap,
  nameIcons: nameIconMap,
  slugMap: spriteEntries,
};

writeFileSync('scripts/manifest-output/talent-icon-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`\nSaved talent-icon-manifest.json`);
console.log(`  nodeIcons: ${Object.keys(nodeIconMap).length}`);
console.log(`  nameIcons: ${Object.keys(nameIconMap).length}`);
console.log(`  slugMap: ${Object.keys(spriteEntries).length}`);
console.log(`  classPortraits: ${Object.keys(classPortraitEntries).length}`);
