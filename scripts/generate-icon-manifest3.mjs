/**
 * generate-icon-manifest3.mjs
 * Fixed: normalizes iconPath slug → CSS slug (prepend _ for digit-starting names)
 */
import { readFileSync, writeFileSync } from 'fs';

const css = readFileSync('scripts/manifest-output/_next_static_chunks_0-j8j-f6dlgw1.css', 'utf8');
const nodes = JSON.parse(readFileSync('scripts/manifest-output/manifest-nodes-all.json', 'utf8'));

// Parse all sprite entries
const spriteEntries = {};
const blocks = css.split('.coa-builder-icon.');
for (const block of blocks.slice(1)) {
  const braceIdx = block.indexOf('{');
  if (braceIdx === -1) continue;
  const slug = block.slice(0, braceIdx).trim();
  const posMatch = block.match(/background-position:([0-9.]+%|0)\s+([0-9.]+%|0)/);
  if (!posMatch) continue;
  spriteEntries[slug] = { x: posMatch[1], y: posMatch[2] };
}

console.log(`Total sprite entries: ${Object.keys(spriteEntries).length}`);

// Normalize iconPath → CSS slug
// CSS class names can't start with a digit or hyphen, so the builder prepends _
function iconPathToSlug(iconPath) {
  const base = iconPath.toLowerCase().replace(/\\/g, '/').split('/').pop();
  // If starts with digit or hyphen, CSS class has leading _
  if (/^[0-9-]/.test(base)) return '_' + base;
  return base;
}

// Map nodes
let matched = 0, unmatched = 0;
const nodeIconMap = {};
const nameIconMap = {};
const unmatchedSlugs = new Set();

for (const node of nodes) {
  if (!node.iconPath) { unmatched++; continue; }
  const slug = iconPathToSlug(node.iconPath);
  const entry = spriteEntries[slug];
  if (entry) {
    nodeIconMap[node.nodeId] = { slug, x: entry.x, y: entry.y };
    if (node.name && !nameIconMap[node.name]) {
      nameIconMap[node.name] = { slug, x: entry.x, y: entry.y, nodeId: node.nodeId };
    }
    matched++;
  } else {
    // Try without leading _
    const altSlug = slug.startsWith('_') ? slug.slice(1) : '_' + slug;
    const altEntry = spriteEntries[altSlug];
    if (altEntry) {
      nodeIconMap[node.nodeId] = { slug: altSlug, x: altEntry.x, y: altEntry.y };
      if (node.name && !nameIconMap[node.name]) {
        nameIconMap[node.name] = { slug: altSlug, x: altEntry.x, y: altEntry.y, nodeId: node.nodeId };
      }
      matched++;
    } else {
      unmatched++;
      unmatchedSlugs.add(slug);
    }
  }
}

console.log(`Matched: ${matched} / ${nodes.length}`);
console.log(`Unmatched: ${unmatched}`);
if (unmatchedSlugs.size > 0) {
  console.log(`Unmatched slugs (${unmatchedSlugs.size}), first 10:`);
  [...unmatchedSlugs].slice(0, 10).forEach(s => console.log('  ', s));
}

// Class portrait map
const classPortraits = {};
for (const [slug, pos] of Object.entries(spriteEntries)) {
  if (slug.startsWith('class-')) {
    classPortraits[slug.slice(6)] = pos;
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
    totalNodes: nodes.length,
  },
  classPortraits,
  nodeIcons: nodeIconMap,
  nameIcons: nameIconMap,
  slugMap: spriteEntries,
};

writeFileSync('scripts/manifest-output/talent-icon-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`\nSaved talent-icon-manifest.json`);
console.log(`  classPortraits: ${Object.keys(classPortraits).length}`);
console.log(`  nodeIcons: ${Object.keys(nodeIconMap).length}`);
console.log(`  nameIcons: ${Object.keys(nameIconMap).length}`);
console.log(`  slugMap: ${Object.keys(spriteEntries).length}`);
