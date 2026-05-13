/**
 * parse-manifest.mjs
 *
 * Standalone parser for the Ascension Conquest of Azeroth official builder
 * frontend payload (Next.js RSC / __next_f stream format).
 *
 * Usage:
 *   node scripts/parse-manifest.mjs <path-to-payload-file> [--out <dir>]
 *
 * Input:
 *   The raw HTML file saved from the official Ascension builder page
 *   (e.g. the builder page for any hero/spec — all class talent manifests
 *   are shipped in a single payload regardless of which hero is viewed).
 *
 * Output (written to --out dir, default: scripts/manifest-output/):
 *   manifest-classes.json     — all class + tab metadata
 *   manifest-nodes-all.json   — all normalized nodes, flat array
 *   manifest-nodes-<tabKey>.json — per-tab node arrays
 *   examples/class-<classId>-tab<tabId>.json   — one sample class tab
 *   examples/spec-<classId>-tab<tabId>.json    — one sample spec tab
 *   examples/sidebar-<classId>-tab<tabId>.json — one sidebar/ascension tab (if found)
 *
 * Manifest data model (as extracted):
 *
 *   hero (page context):
 *     id, slug, name, max_level, schema_version
 *
 *   talents.meta:
 *     runtimeBuildProcess, runtimeDescriptionPreference
 *
 *   talents.classes[]:
 *     classId, className, tabs[{ tabId, tabName, sortOrder }]
 *
 *   talents.entriesByTab:
 *     { "<classId>:<tabId>": Node[] }
 *
 *   Node (raw manifest fields):
 *     id              — numeric node ID (matches connectedNodeIds references)
 *     classId         — owning class
 *     tabId           — owning tab
 *     name            — display name
 *     description     — pre-rendered HTML tooltip (rich, use as-is)
 *     iconPath        — "Interface\\Icons\\..." WoW icon path
 *     nodeType        — "SpendCircle" | "SpendSquare" | "SpendHex"
 *     entryType       — "Ability" | "Talent"
 *     isPassive       — 0 | 1
 *     maxPoints       — max rankable points (1–N)
 *     spellId         — primary spell ID
 *     spellIds        — all spell IDs (one per rank for multi-rank nodes)
 *     rankDescriptions — [{ rank, spellId, description }] per rank
 *     requiredIds     — [id, id, id] — prerequisite node IDs (0 = empty)
 *     connectedNodeIds — [id, ...] — connected neighbor nodes (0 = empty)
 *     requiredLevel   — minimum player level to unlock
 *     reqTabTE        — tree talent expenditure gate (points needed in this tab)
 *     reqTabAE        — ascension expenditure gate
 *     teCost          — talent expenditure cost (standard spec/class trees)
 *     aeCost          — ascension expenditure cost (sidebar/Path of Ascension)
 *     isStartingNode  — 0 | 1
 *     group           — choice node group ID (nodes sharing a group are mutually exclusive choices)
 *     x, y            — authored grid coordinates from the official builder
 *     flags, sortOrder — internal ordering/flag fields
 *
 * Normalized output schema (NormalizedNode):
 *   nodeId, classId, tabId, tabKey, name, description, iconPath,
 *   nodeType, entryType, isPassive, maxPoints,
 *   spellId, spellIds,
 *   requiredNodeIds, connectedNodeIds,
 *   requiredLevel, reqTabTE, reqTabAE, teCost, aeCost,
 *   isStartingNode, choiceGroupId,
 *   gridX, gridY,
 *   rankDescriptions: [{ rank, spellId, description }]
 *
 * NOTE: x/y coordinates in the manifest are the official authored layout
 * coordinates. Your addon remains the authoritative source for:
 *   - in-game anchor/pixel coordinates
 *   - canonicalRow/canonicalCol lattice
 *   - hidden/pooled node membership
 *   - actual connection topology from live client
 * Use requiredIds + connectedNodeIds from this manifest only as supplemental
 * metadata; prefer addon-extracted connection topology for layout.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const inputIdx = args.findIndex(a => !a.startsWith('--'));
if (inputIdx === -1) {
  console.error('Usage: node scripts/parse-manifest.mjs <payload-file> [--out <dir>]');
  process.exit(1);
}
const inputPath = args[inputIdx];
const outIdx = args.indexOf('--out');
const outDir = outIdx !== -1 ? args[outIdx + 1] : join(__dirname, 'manifest-output');

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'examples'), { recursive: true });

// ── Payload extraction ────────────────────────────────────────────────────────

/**
 * Extract the large RSC JSON payload from a Next.js SSR HTML file.
 *
 * Next.js App Router streams component data as:
 *   self.__next_f.push([1,"<json-string>"])
 *
 * The main talent manifest is embedded as the largest such block.
 * The JSON string is JS-escaped (\\", \u003e, etc.) and prefixed with
 * a React reference key ("5:...").
 */
function extractPayload(html) {
  const scriptRe = /<script[^>]*>([\s\S]+?)<\/script>/g;
  let best = null;
  for (const m of html.matchAll(scriptRe)) {
    const content = m[1];
    if (content.length > (best?.length ?? 0)) best = content;
  }
  if (!best) throw new Error('No script blocks found in payload');

  // Strip outer: self.__next_f.push([1,"..."])
  const inner = best
    .replace(/^self\.__next_f\.push\(\[1,"|"\]\)$/g, '')
    .replace(/^5:/, '');

  // Unescape JS string escapes
  let unescaped;
  try {
    // JSON.parse wrapping in quotes handles \uXXXX, \", \\, etc.
    unescaped = JSON.parse('"' + inner.replace(/"/g, '\\"').replace(/\\"/g, '"') + '"');
  } catch {
    // Fallback: use regex unescape
    unescaped = inner
      .replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
  }

  // Find the {"value":[...]} object
  const valueStart = unescaped.indexOf('{"value":[');
  if (valueStart === -1) throw new Error('{"value":[ not found in payload');

  const chunk = unescaped.slice(valueStart);
  let depth = 0, end = 0;
  for (let i = 0; i < chunk.length; i++) {
    if (chunk[i] === '{' || chunk[i] === '[') depth++;
    else if (chunk[i] === '}' || chunk[i] === ']') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (!end) throw new Error('Could not find balanced JSON end');

  return JSON.parse(chunk.slice(0, end));
}

// ── HTML description cleaner ──────────────────────────────────────────────────

/**
 * Convert pre-rendered builder HTML tooltip to plain text.
 * Preserves semantic meaning, strips tags, decodes HTML entities.
 *
 * The description field uses HTML markup (not WoW |c| tags), which is
 * directly renderable in a browser but needs stripping for plain-text use.
 */
function htmlToPlainText(html) {
  if (!html) return '';
  return html
    // Treat <br>, <hr>, block divs as newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n---\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([\da-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Icon path normalizer ──────────────────────────────────────────────────────

/**
 * Normalize a WoW iconPath to a consistent lowercase relative path.
 * "Interface\\Icons\\spell_fire_rune" → "interface/icons/spell_fire_rune"
 */
function normalizeIconPath(raw) {
  if (!raw) return null;
  return raw.replace(/\\/g, '/').toLowerCase();
}

// ── Node normalizer ───────────────────────────────────────────────────────────

/**
 * Normalize a raw manifest node to a clean NormalizedNode record.
 *
 * @param {object} raw - Raw node from entriesByTab
 * @param {string} tabKey - "<classId>:<tabId>" key
 * @param {Map<number,string>} tabNames - tabId → tabName
 * @param {Map<number,string>} classNames - classId → className
 * @returns {NormalizedNode}
 */
function normalizeNode(raw, tabKey, tabNames, classNames) {
  const requiredNodeIds = (raw.requiredIds ?? []).filter(id => id !== 0);
  const connectedNodeIds = (raw.connectedNodeIds ?? []).filter(id => id !== 0);

  return {
    nodeId:          raw.id,
    classId:         raw.classId,
    className:       classNames.get(raw.classId) ?? null,
    tabId:           raw.tabId,
    tabKey,
    tabName:         tabNames.get(raw.tabId) ?? null,

    name:            raw.name,
    description:     raw.description ?? '',       // pre-rendered HTML
    descriptionText: htmlToPlainText(raw.description ?? ''), // plain text
    iconPath:        normalizeIconPath(raw.iconPath),

    nodeType:        raw.nodeType,  // SpendCircle | SpendSquare | SpendHex
    entryType:       raw.entryType, // Ability | Talent
    isPassive:       raw.isPassive === 1,
    maxPoints:       raw.maxPoints ?? 1,

    spellId:         raw.spellId,
    spellIds:        raw.spellIds ?? [raw.spellId],

    requiredNodeIds,
    connectedNodeIds,
    requiredLevel:   raw.requiredLevel ?? 0,
    reqTabTE:        raw.reqTabTE ?? 0,   // talent expenditure gate
    reqTabAE:        raw.reqTabAE ?? 0,   // ascension expenditure gate
    teCost:          raw.teCost ?? 0,     // talent expenditure cost
    aeCost:          raw.aeCost ?? 0,     // ascension expenditure cost

    isStartingNode:  raw.isStartingNode === 1,
    choiceGroupId:   raw.group !== 0 ? raw.group : null,

    gridX:           raw.x,  // authored builder grid coordinates
    gridY:           raw.y,  // (NOT in-game pixel coords — use addon for those)

    rankDescriptions: (raw.rankDescriptions ?? []).map(rd => ({
      rank:        rd.rank,
      spellId:     rd.spellId,
      description: rd.description ?? '',
      descriptionText: htmlToPlainText(rd.description ?? ''),
    })),

    flags:     raw.flags ?? 0,
    sortOrder: raw.sortOrder ?? 0,
  };
}

// ── Tree type inference ───────────────────────────────────────────────────────

/**
 * Infer whether a tab is a class tree, spec tree, or sidebar/ascension tree.
 *
 * Rules derived from observed manifest data:
 *   - tabId 87 → always "Class" (shared class tree, sortOrder: 0)
 *   - tabId 1, tabName "None" → skip/empty tab
 *   - nodes with aeCost > 0 but teCost == 0 → ascension/sidebar tree
 *   - otherwise → spec tree
 *
 * @param {string} tabName
 * @param {number} tabId
 * @param {NormalizedNode[]} nodes
 * @returns {'class' | 'spec' | 'sidebar' | 'unknown'}
 */
function inferTreeType(tabName, tabId, nodes) {
  // Tab 87 is always the shared class tree (uses aeCost as its spend currency)
  if (tabId === 87) return 'class';
  if (tabName === 'None' || tabId === 1) return 'unknown';
  const hasAE = nodes.some(n => n.aeCost > 0);
  const hasTE = nodes.some(n => n.teCost > 0);
  // Pure aeCost tabs outside of tab 87 would be sidebar/ascension tracks
  if (hasAE && !hasTE) return 'sidebar';
  // Pure teCost or mixed = spec tree
  return 'spec';
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`[parse-manifest] Reading: ${inputPath}`);
const html = readFileSync(inputPath, 'utf8');

console.log(`[parse-manifest] Extracting RSC payload...`);
let payload;
try {
  payload = extractPayload(html);
} catch (e) {
  console.error('[parse-manifest] Extraction failed:', e.message);
  process.exit(1);
}

const hero = payload.value[0];
const { meta, classes, entriesByTab } = hero.talents;

console.log(`[parse-manifest] Hero: ${hero.name} (id=${hero.id}, slug=${hero.slug})`);
console.log(`[parse-manifest] Build process: ${meta.runtimeBuildProcess}`);
console.log(`[parse-manifest] Classes: ${classes.length}`);

// Build lookup maps
const tabNames = new Map();       // tabId → tabName
const tabToClass = new Map();     // tabId → classId
const classNames = new Map();     // classId → className
const classTabs = new Map();      // classId → tab[]

for (const cls of classes) {
  classNames.set(cls.classId, cls.className);
  classTabs.set(cls.classId, cls.tabs);
  for (const tab of cls.tabs) {
    tabNames.set(tab.tabId, tab.tabName);
    tabToClass.set(tab.tabId, cls.classId);
  }
}

// Normalize all nodes
const allNormalized = [];
const byTabKey = {};
const tabStats = [];

for (const [tabKey, rawNodes] of Object.entries(entriesByTab)) {
  const [classIdStr, tabIdStr] = tabKey.split(':');
  const classId = Number(classIdStr);
  const tabId = Number(tabIdStr);
  const tabName = tabNames.get(tabId) ?? `Tab${tabId}`;
  const className = classNames.get(classId) ?? `Class${classId}`;

  const normalized = rawNodes.map(n => normalizeNode(n, tabKey, tabNames, classNames));
  const treeType = inferTreeType(tabName, tabId, normalized);

  for (const n of normalized) n.treeType = treeType;

  allNormalized.push(...normalized);
  byTabKey[tabKey] = normalized;

  tabStats.push({
    tabKey, classId, className, tabId, tabName, treeType,
    nodeCount: normalized.length,
    multiRankCount: normalized.filter(n => n.maxPoints > 1).length,
    choiceNodeCount: normalized.filter(n => n.choiceGroupId !== null).length,
    hasConnections: normalized.some(n => n.connectedNodeIds.length > 0),
  });
}

console.log(`[parse-manifest] Total nodes: ${allNormalized.length}`);
console.log(`[parse-manifest] Tabs: ${tabStats.length} (class=${tabStats.filter(t=>t.treeType==='class').length}, spec=${tabStats.filter(t=>t.treeType==='spec').length}, sidebar=${tabStats.filter(t=>t.treeType==='sidebar').length})`);

// ── Write outputs ─────────────────────────────────────────────────────────────

function write(filename, data) {
  const path = join(outDir, filename);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[parse-manifest] Written: ${path} (${(JSON.stringify(data).length / 1024).toFixed(1)} KB)`);
}

// manifest-classes.json
write('manifest-classes.json', {
  hero: { id: hero.id, slug: hero.slug, name: hero.name, max_level: hero.max_level },
  meta,
  classes: classes.map(cls => ({
    classId: cls.classId,
    className: cls.className,
    tabs: cls.tabs.map(t => ({
      tabId: t.tabId,
      tabName: t.tabName,
      sortOrder: t.sortOrder,
      tabKey: `${cls.classId}:${t.tabId}`,
      treeType: inferTreeType(t.tabName, t.tabId, byTabKey[`${cls.classId}:${t.tabId}`] ?? []),
      nodeCount: (byTabKey[`${cls.classId}:${t.tabId}`] ?? []).length,
    })),
  })),
  tabStats,
});

// manifest-nodes-all.json
write('manifest-nodes-all.json', allNormalized);

// Per-tab files
for (const [tabKey, nodes] of Object.entries(byTabKey)) {
  write(`manifest-nodes-${tabKey.replace(':', '_')}.json`, nodes);
}

// ── Example outputs ───────────────────────────────────────────────────────────

/**
 * Find a good example tab of each tree type.
 * Prefer tabs with > 20 nodes and meaningful connections.
 */
function pickExampleTab(treeType) {
  return tabStats
    .filter(t => t.treeType === treeType && t.nodeCount > 15)
    .sort((a, b) => b.nodeCount - a.nodeCount)[0];
}

const exampleClass   = pickExampleTab('class');
const exampleSpec    = pickExampleTab('spec');
const exampleSidebar = pickExampleTab('sidebar');

function writeExample(label, stat) {
  if (!stat) { console.log(`[parse-manifest] No ${label} example found`); return; }
  const nodes = byTabKey[stat.tabKey];
  write(`examples/${label}-${stat.classId}-tab${stat.tabId}.json`, {
    meta: {
      classId: stat.classId, className: stat.className,
      tabId: stat.tabId, tabName: stat.tabName,
      tabKey: stat.tabKey, treeType: stat.treeType,
      nodeCount: nodes.length,
    },
    nodes,
  });
}

writeExample('class',   exampleClass);
writeExample('spec',    exampleSpec);
// Sidebar: in this payload, the ascension/class system lives in tab 87 (class trees).
// If a standalone sidebar tab is present, use it; otherwise use the first class tab.
const sidebarOrClass = exampleSidebar ?? pickExampleTab('class');
writeExample('sidebar', sidebarOrClass);

// ── Schema summary ────────────────────────────────────────────────────────────

const summary = {
  extractedFrom: inputPath,
  hero: { id: hero.id, slug: hero.slug, name: hero.name },
  totalNodes: allNormalized.length,
  totalTabs: tabStats.length,
  treeTypeCounts: {
    class:   tabStats.filter(t => t.treeType === 'class').length,
    spec:    tabStats.filter(t => t.treeType === 'spec').length,
    sidebar: tabStats.filter(t => t.treeType === 'sidebar').length,
    unknown: tabStats.filter(t => t.treeType === 'unknown').length,
  },
  nodeTypes: [...new Set(allNormalized.map(n => n.nodeType))],
  entryTypes: [...new Set(allNormalized.map(n => n.entryType))],
  multiRankNodes: allNormalized.filter(n => n.maxPoints > 1).length,
  choiceGroupNodes: allNormalized.filter(n => n.choiceGroupId !== null).length,
  nodesWithRequiredIds: allNormalized.filter(n => n.requiredNodeIds.length > 0).length,
  nodesWithConnections: allNormalized.filter(n => n.connectedNodeIds.length > 0).length,
  nodesWithRequiredLevel: allNormalized.filter(n => n.requiredLevel > 0).length,
  normalizedNodeSchema: {
    nodeId:           'number — unique node ID',
    classId:          'number — owning class',
    className:        'string',
    tabId:            'number — owning tab',
    tabKey:           'string — "<classId>:<tabId>"',
    tabName:          'string',
    treeType:         '"class" | "spec" | "sidebar" | "unknown"',
    name:             'string — talent display name',
    description:      'string — pre-rendered HTML tooltip (rich)',
    descriptionText:  'string — plain text tooltip (stripped HTML)',
    iconPath:         'string — "interface/icons/..." lowercase',
    nodeType:         '"SpendCircle" | "SpendSquare" | "SpendHex"',
    entryType:        '"Ability" | "Talent"',
    isPassive:        'boolean',
    maxPoints:        'number — max rank',
    spellId:          'number — primary spell ID',
    spellIds:         'number[] — one per rank for multi-rank nodes',
    requiredNodeIds:  'number[] — prerequisite node IDs (filtered zeros)',
    connectedNodeIds: 'number[] — adjacent connected nodes (filtered zeros)',
    requiredLevel:    'number — min player level',
    reqTabTE:         'number — talent expenditure gate (points needed in tab)',
    reqTabAE:         'number — ascension expenditure gate',
    teCost:           'number — talent expenditure cost of this node',
    aeCost:           'number — ascension expenditure cost of this node',
    isStartingNode:   'boolean',
    choiceGroupId:    'number | null — mutual-exclusion group (choice nodes)',
    gridX:            'number — authored builder x coordinate',
    gridY:            'number — authored builder y coordinate',
    rankDescriptions: '[{ rank, spellId, description, descriptionText }]',
    flags:            'number — internal flags',
    sortOrder:        'number — internal sort order',
  },
  addonResponsibility: {
    note: 'The addon remains authoritative for:',
    fields: [
      'anchorX / anchorY — in-game pixel coordinates',
      'canonicalRow / canonicalCol — deterministic lattice positions',
      'hidden / pooled node membership',
      'connection topology from live client frames',
      'treeType inference from relativeTo frame names',
    ],
  },
};

write('manifest-summary.json', summary);

console.log('\n[parse-manifest] Done.');
console.log(`[parse-manifest] Output directory: ${outDir}`);
