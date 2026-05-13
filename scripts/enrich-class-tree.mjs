/**
 * enrich-class-tree.mjs
 *
 * Merges manifest talent data into addon-exported class tree nodes inside a
 * talent JSON file (e.g. tinker.json). The addon lattice export only contains
 * frame names as IDs and no talent metadata for class tree nodes. The manifest
 * has full names/descriptions/icons keyed by (classId, tabId=87, gridX, gridY).
 *
 * Matching strategy:
 *   manifest gridX  === addon canonicalCol - 1   (manifest is 0-based)
 *   manifest gridY  === addon canonicalRow - 1   (manifest is 0-based)
 *
 * For duplicate manifest slots (two manifest nodes at the same grid position),
 * the one with more content is preferred.
 *
 * Usage:
 *   node scripts/enrich-class-tree.mjs <talent-json-path> [--classId <id>] [--dry-run]
 *
 * Example:
 *   node scripts/enrich-class-tree.mjs artifacts/conquest-calculator/src/data/talents/tinker.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (!args.length || args[0].startsWith('-')) {
  console.error('Usage: node scripts/enrich-class-tree.mjs <talent-json-path> [--classId <id>] [--dry-run]');
  process.exit(1);
}
const talentJsonPath = path.resolve(args[0]);
const dryRun = args.includes('--dry-run');

// Allow explicit classId override (e.g. --classId 28)
let classIdOverride = null;
const ciIdx = args.indexOf('--classId');
if (ciIdx >= 0 && args[ciIdx + 1]) {
  classIdOverride = parseInt(args[ciIdx + 1], 10);
}

// ── Load talent JSON ──────────────────────────────────────────────────────────
if (!fs.existsSync(talentJsonPath)) {
  console.error('File not found:', talentJsonPath);
  process.exit(1);
}
const talentData = JSON.parse(fs.readFileSync(talentJsonPath, 'utf8'));
const classTree = talentData.classTree;
if (!Array.isArray(classTree) || classTree.length === 0) {
  console.error('No classTree array found in', talentJsonPath);
  process.exit(1);
}

// ── Determine classId ─────────────────────────────────────────────────────────
// Try to find it in the manifest output by matching the className to the classId
// field in the talent JSON, or via the --classId override.
const manifestClassesPath = path.join(ROOT, 'scripts/manifest-output/manifest-classes.json');
if (!fs.existsSync(manifestClassesPath)) {
  console.error('Manifest classes not found. Run: node scripts/parse-manifest.mjs <html-file>');
  process.exit(1);
}
const manifestMeta = JSON.parse(fs.readFileSync(manifestClassesPath, 'utf8'));
const classes = manifestMeta.classes;

let classId = classIdOverride;
if (!classId) {
  // Try to infer from the talent JSON classId field or filename
  const rawClassId = talentData.classId; // e.g. "tinker" or a number
  if (typeof rawClassId === 'number') {
    classId = rawClassId;
  } else if (typeof rawClassId === 'string') {
    // Match by className (case-insensitive)
    const match = classes.find(c => c.className.toLowerCase() === rawClassId.toLowerCase());
    if (match) classId = match.classId;
  }
}
if (!classId) {
  console.error(`Could not determine classId. Available classes:\n${classes.map(c => `  ${c.classId}: ${c.className}`).join('\n')}`);
  console.error('\nPass --classId <number> to specify explicitly.');
  process.exit(1);
}

const classEntry = classes.find(c => c.classId === classId);
console.log(`\nEnriching class tree for: ${classEntry?.className ?? 'unknown'} (classId=${classId})`);

// ── Load manifest class tree nodes ───────────────────────────────────────────
// Tab 87 is always the shared class tree.
const manifestFile = path.join(ROOT, `scripts/manifest-output/manifest-nodes-${classId}_87.json`);
if (!fs.existsSync(manifestFile)) {
  console.error(`Manifest class tree not found: ${manifestFile}`);
  console.error(`Available manifest files:\n${fs.readdirSync(path.join(ROOT,'scripts/manifest-output')).filter(f=>f.startsWith(`manifest-nodes-${classId}_`)).join('\n  ')}`);
  process.exit(1);
}
const manifestNodes = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
console.log(`Loaded ${manifestNodes.length} manifest class tree nodes from ${path.basename(manifestFile)}`);

// ── Build manifest lookup by grid position ────────────────────────────────────
// manifest gridX = column (0-based), gridY = row (0-based)
// When multiple manifest nodes share the same grid cell (e.g. pooled alts),
// prefer the one with a non-empty description.
const manifestByGrid = new Map();
for (const mn of manifestNodes) {
  const key = `${mn.gridY}_${mn.gridX}`;
  const existing = manifestByGrid.get(key);
  if (!existing) {
    manifestByGrid.set(key, mn);
  } else {
    // Prefer richer: longer description wins
    if ((mn.descriptionText?.length ?? 0) > (existing.descriptionText?.length ?? 0)) {
      manifestByGrid.set(key, mn);
    }
  }
}

// ── Enrich addon class tree nodes ─────────────────────────────────────────────
let enriched = 0, skipped = 0, missing = 0;

const enrichedClassTree = classTree.map(addonNode => {
  // Convert addon canonical (1-based) to manifest grid (0-based)
  const manifestRow = (addonNode.canonicalRow ?? 0) - 1;
  const manifestCol = (addonNode.canonicalCol ?? 0) - 1;

  if (manifestRow < 0 || manifestCol < 0) {
    skipped++;
    return addonNode;
  }

  const key = `${manifestRow}_${manifestCol}`;
  const mn = manifestByGrid.get(key);
  if (!mn) {
    missing++;
    console.warn(`  [WARN] No manifest match for addon node row=${addonNode.canonicalRow} col=${addonNode.canonicalCol} (id: ${addonNode.id.slice(-40)})`);
    return addonNode;
  }

  enriched++;

  // Normalize icon path: manifest uses backslashes and uppercase, normalizer
  // expects lowercase forward-slashes.
  const normalizedIcon = mn.iconPath
    ? mn.iconPath.replace(/\\/g, '/').toLowerCase()
    : addonNode.icon;

  // Derive rank string from maxPoints (e.g. "Rank 1/3")
  const rankStr = mn.maxPoints > 1 ? `Rank 1/${mn.maxPoints}` : 'Rank 1/1';

  // Keep addon-authoritative position fields; enrich only talent payload.
  // Also store manifestNodeId + connectedNodeIds so we can synthesize
  // class-tree connections in the next step.
  return {
    ...addonNode,
    name: mn.name,
    description: mn.descriptionText ?? mn.description ?? '',
    icon: normalizedIcon,
    rank: rankStr,
    manifestNodeId: mn.nodeId,
    manifestConnectedIds: mn.connectedNodeIds ?? [],
    // Keep the node shape from manifest if addon has only generic shape
    nodeShape: mn.nodeType?.includes('Circle') || mn.nodeType === 'SpendCircle' ? 'circle'
             : mn.nodeType?.includes('Hex')    || mn.nodeType === 'SpendHex'    ? 'octagon'
             : 'square',
    nodeType: mn.isPassive ? 'passive' : 'active',
  };
});

console.log(`\nEnrichment summary:`);
console.log(`  Enriched:  ${enriched}/${classTree.length}`);
console.log(`  Missing:   ${missing}`);
console.log(`  Skipped:   ${skipped} (no canonical coords)`);

if (enriched === 0) {
  console.error('\nERROR: No nodes matched. Check classId or canonical coord fields.');
  process.exit(1);
}

// ── Synthesize class-tree connections from manifestConnectedIds ───────────────
// Build a lookup: manifestNodeId → addonFrameId
const manifestIdToAddonId = new Map();
for (const n of enrichedClassTree) {
  if (n.manifestNodeId != null) {
    manifestIdToAddonId.set(n.manifestNodeId, n.id);
  }
}

// The manifest encodes undirected edges via connectedNodeIds on both sides.
// We deduplicate by always writing the pair with lower-id-string first.
const existingConnKeys = new Set((talentData.connections ?? []).map(c => {
  const src = c.sourceNodeId ?? c.sourceNodeFrame ?? '';
  const tgt = c.targetNodeId ?? c.targetNodeFrame ?? '';
  return [src,tgt].sort().join('||');
}));

const newConnections = [];
let connSynthesized = 0, connDuplicate = 0, connOrphan = 0;

for (const n of enrichedClassTree) {
  if (!n.manifestConnectedIds?.length) continue;
  for (const connectedManifestId of n.manifestConnectedIds) {
    const targetAddonId = manifestIdToAddonId.get(connectedManifestId);
    if (!targetAddonId) { connOrphan++; continue; }

    const key = [n.id, targetAddonId].sort().join('||');
    if (existingConnKeys.has(key)) { connDuplicate++; continue; }
    existingConnKeys.add(key);

    // Prefer source = lower canonicalRow (source is the upstream node)
    const srcNode = enrichedClassTree.find(x => x.id === n.id);
    const tgtNode = enrichedClassTree.find(x => x.id === targetAddonId);
    const [sourceId, targetId] = (srcNode?.canonicalRow ?? 0) <= (tgtNode?.canonicalRow ?? 0)
      ? [n.id, targetAddonId]
      : [targetAddonId, n.id];

    newConnections.push({
      id: `synthetic_cls_${connSynthesized}`,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      sourceNodeFrame: sourceId,
      targetNodeFrame: targetId,
      treeType: 'class',
    });
    connSynthesized++;
  }
}

console.log(`\nConnection synthesis:`);
console.log(`  New class-tree connections: ${connSynthesized}`);
console.log(`  Duplicates skipped:         ${connDuplicate}`);
console.log(`  Orphans (no addon match):   ${connOrphan}`);

// ── Sample output ─────────────────────────────────────────────────────────────
console.log('\nSample enriched nodes (first 3):');
enrichedClassTree.filter(n => n.name && !n.name.startsWith('CoA')).slice(0, 3).forEach(n => {
  console.log(`  row=${n.canonicalRow} col=${n.canonicalCol} | ${n.name} | ${n.description?.slice(0, 60)}...`);
});

// ── Write output ──────────────────────────────────────────────────────────────
if (dryRun) {
  console.log('\n[dry-run] Not writing. Pass without --dry-run to apply.');
  process.exit(0);
}

const mergedConnections = [...(talentData.connections ?? []), ...newConnections];
const output = { ...talentData, classTree: enrichedClassTree, connections: mergedConnections };
fs.writeFileSync(talentJsonPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`\nWrote enriched talent data to: ${talentJsonPath}`);
console.log(`Total connections: ${mergedConnections.length} (was ${(talentData.connections ?? []).length}, +${newConnections.length} class-tree)`);

