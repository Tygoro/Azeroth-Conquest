/**
 * enrich-spec-tree.mjs
 *
 * Injects manifest iconPath (and optionally description) into addon-exported
 * spec tree nodes inside a talent JSON file (e.g. tinker.json).
 *
 * The addon lattice export stores spec node icons as the WoW placeholder
 * "interface\talentframe\talents". The manifest has the real iconPath for
 * every spec node, keyed by name (35/35 match for Tinker).
 *
 * Matching strategy (in priority order):
 *   1. Exact name match (case-insensitive)
 *   2. Grid coord match: manifest (gridX+1)==canonicalCol, (gridY+1)==canonicalRow
 *
 * Usage:
 *   node scripts/enrich-spec-tree.mjs <talent-json-path> [--classId <id>] [--dry-run]
 *
 * Example:
 *   node scripts/enrich-spec-tree.mjs artifacts/conquest-calculator/src/data/talents/tinker.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
if (!args.length || args[0].startsWith('-')) {
  console.error('Usage: node scripts/enrich-spec-tree.mjs <talent-json-path> [--classId <id>] [--dry-run]');
  process.exit(1);
}
const talentJsonPath = path.resolve(args[0]);
const dryRun = args.includes('--dry-run');

let classIdOverride = null;
const ciIdx = args.indexOf('--classId');
if (ciIdx >= 0 && args[ciIdx + 1]) classIdOverride = parseInt(args[ciIdx + 1], 10);

if (!fs.existsSync(talentJsonPath)) {
  console.error('File not found:', talentJsonPath);
  process.exit(1);
}

const talent = JSON.parse(fs.readFileSync(talentJsonPath, 'utf8'));
const classId = classIdOverride ?? talent.classId;
if (!classId) { console.error('No classId found in talent JSON and none provided via --classId'); process.exit(1); }

// ── Load manifest ─────────────────────────────────────────────────────────────
const manifestPath = path.join(ROOT, 'scripts/manifest-output/manifest-nodes-all.json');
if (!fs.existsSync(manifestPath)) {
  console.error('manifest-nodes-all.json not found at:', manifestPath);
  console.error('Run: node scripts/parse-manifest.mjs <html-file> first');
  process.exit(1);
}
const manifestAll = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Filter to spec nodes for this class only.
// classId in the talent JSON may be a string slug ("tinker") while the manifest
// uses a numeric classId (28). Try numeric match first, then fall back to
// className slug comparison.
let manifestSpec = manifestAll.filter(
  n => String(n.classId) === String(classId) && n.treeType === 'spec'
);
if (manifestSpec.length === 0) {
  // Fall back: match by className slug (lowercased, spaces stripped)
  const slug = String(classId).toLowerCase().replace(/\s+/g, '');
  manifestSpec = manifestAll.filter(
    n => n.className?.toLowerCase().replace(/\s+/g, '') === slug && n.treeType === 'spec'
  );
}
console.log(`Manifest spec nodes for classId=${classId}: ${manifestSpec.length}`);
if (manifestSpec.length === 0) {
  console.error('No manifest spec nodes found for classId:', classId);
  console.error('Available classIds:', [...new Set(manifestAll.map(n => `${n.classId}/${n.className}`))].slice(0, 10));
  process.exit(1);
}

// Build lookup indexes
const byName = new Map();
for (const mn of manifestSpec) {
  const key = mn.name?.toLowerCase().trim();
  if (!key) continue;
  // Prefer entries with iconPath; don't overwrite a good entry with a worse one
  if (!byName.has(key) || (!byName.get(key).iconPath && mn.iconPath)) {
    byName.set(key, mn);
  }
}

const byGrid = new Map();
for (const mn of manifestSpec) {
  if (mn.gridX != null && mn.gridY != null) {
    // manifest is 0-based; addon is 1-based
    const key = `${mn.gridX + 1},${mn.gridY + 1}`;
    if (!byGrid.has(key) || (!byGrid.get(key).iconPath && mn.iconPath)) {
      byGrid.set(key, mn);
    }
  }
}

// ── Constant: placeholder icon that needs replacing ───────────────────────────
const PLACEHOLDER_RE = /interface[\\/]talentframe[\\/]talents/i;

function needsIcon(iconVal) {
  return !iconVal || PLACEHOLDER_RE.test(iconVal);
}

// ── Enrich spec tree nodes ────────────────────────────────────────────────────
const specNodes = talent.specTree ?? talent.nodes ?? [];
let matched = 0, unmatched = 0, skipped = 0;

for (const node of specNodes) {
  // Skip nodes that already have a real icon
  if (!needsIcon(node.icon)) { skipped++; continue; }

  // 1. Try name match
  let mn = byName.get(node.name?.toLowerCase().trim());

  // 2. Fall back to grid coord match
  if (!mn && node.canonicalCol != null && node.canonicalRow != null) {
    mn = byGrid.get(`${node.canonicalCol},${node.canonicalRow}`);
  }

  if (mn) {
    if (mn.iconPath) {
      node.icon = mn.iconPath;
    }
    // Also backfill description if missing
    if ((!node.description || node.description.trim() === '') && mn.descriptionText) {
      node.description = mn.descriptionText;
    }
    matched++;
  } else {
    console.warn(`  [unmatched] "${node.name}" (col=${node.canonicalCol}, row=${node.canonicalRow})`);
    unmatched++;
  }
}

console.log(`\nEnrichment result: ${matched} matched, ${unmatched} unmatched, ${skipped} skipped (already had icon)`);

if (dryRun) {
  console.log('[dry-run] No file written.');
} else {
  fs.writeFileSync(talentJsonPath, JSON.stringify(talent, null, 2), 'utf8');
  console.log('Written:', talentJsonPath);
}
