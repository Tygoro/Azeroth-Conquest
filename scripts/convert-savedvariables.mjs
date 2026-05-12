#!/usr/bin/env node
/**
 * Convert CoATalentExtractor SavedVariables (v5) to tinker.json for the renderer.
 *
 * Usage:
 *   node scripts/convert-savedvariables.mjs [path-to-savedvariables.lua] [output-path]
 *
 * Defaults:
 *   input:  C:\Program Files\Ascension Launcher\resources\ascension_ptr\WTF\Account\tygoro2\SavedVariables\CoATalentExtractor.lua
 *   output: artifacts/conquest-calculator/src/data/talents/tinker.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_INPUT = String.raw`C:\Program Files\Ascension Launcher\resources\ascension_ptr\WTF\Account\tygoro2\SavedVariables\CoATalentExtractor.lua`;
const DEFAULT_OUTPUT = resolve(__dirname, '..', 'artifacts', 'conquest-calculator', 'src', 'data', 'talents', 'tinker.json');

const inputPath = process.argv[2] || DEFAULT_INPUT;
const outputPath = process.argv[3] || DEFAULT_OUTPUT;

console.log(`Reading: ${inputPath}`);
const raw = readFileSync(inputPath, 'utf8');

// ─── Minimal Lua table parser ────────────────────────────────────────────────
// Handles the subset of Lua table syntax found in WoW SavedVariables files.

function parseLuaValue(src, pos) {
  pos = skipWS(src, pos);
  if (pos >= src.length) return [undefined, pos];

  const ch = src[pos];

  // String
  if (ch === '"') return parseLuaString(src, pos);

  // Table
  if (ch === '{') return parseLuaTable(src, pos);

  // Boolean / nil
  if (src.startsWith('true', pos)) return [true, pos + 4];
  if (src.startsWith('false', pos)) return [false, pos + 5];
  if (src.startsWith('nil', pos)) return [null, pos + 3];

  // Number (including negative)
  if (ch === '-' || (ch >= '0' && ch <= '9')) return parseLuaNumber(src, pos);

  return [undefined, pos];
}

function skipWS(src, pos) {
  while (pos < src.length) {
    if (src[pos] === ' ' || src[pos] === '\t' || src[pos] === '\n' || src[pos] === '\r') { pos++; continue; }
    // Lua single-line comment
    if (src[pos] === '-' && src[pos + 1] === '-') {
      // Check for block comment
      if (src[pos + 2] === '[' && src[pos + 3] === '[') {
        const end = src.indexOf(']]', pos + 4);
        pos = end >= 0 ? end + 2 : src.length;
        continue;
      }
      while (pos < src.length && src[pos] !== '\n') pos++;
      continue;
    }
    break;
  }
  return pos;
}

function parseLuaString(src, pos) {
  // pos points to opening "
  let result = '';
  pos++; // skip "
  while (pos < src.length && src[pos] !== '"') {
    if (src[pos] === '\\') {
      pos++;
      if (src[pos] === 'n') { result += '\n'; pos++; }
      else if (src[pos] === 'r') { result += '\r'; pos++; }
      else if (src[pos] === 't') { result += '\t'; pos++; }
      else if (src[pos] === '"') { result += '"'; pos++; }
      else if (src[pos] === '\\') { result += '\\'; pos++; }
      else { result += src[pos]; pos++; }
    } else {
      result += src[pos];
      pos++;
    }
  }
  if (pos < src.length) pos++; // skip closing "
  return [result, pos];
}

function parseLuaNumber(src, pos) {
  let end = pos;
  if (src[end] === '-') end++;
  while (end < src.length && ((src[end] >= '0' && src[end] <= '9') || src[end] === '.' || src[end] === 'e' || src[end] === 'E' || src[end] === '+' || src[end] === '-')) {
    if ((src[end] === '+' || src[end] === '-') && src[end - 1] !== 'e' && src[end - 1] !== 'E') break;
    end++;
  }
  const num = Number(src.slice(pos, end));
  return [num, end];
}

function parseLuaTable(src, pos) {
  // pos points to {
  pos++; // skip {
  pos = skipWS(src, pos);

  // Detect if it's an array or a dict
  const result = [];
  const dict = {};
  let isArray = true;
  let arrayIndex = 1;

  while (pos < src.length && src[pos] !== '}') {
    pos = skipWS(src, pos);
    if (src[pos] === '}') break;

    // Key-value pair: ["key"] = value  or  key = value
    if (src[pos] === '[') {
      isArray = false;
      pos++; // skip [
      let key;
      pos = skipWS(src, pos);
      [key, pos] = parseLuaValue(src, pos);
      pos = skipWS(src, pos);
      if (src[pos] === ']') pos++; // skip ]
      pos = skipWS(src, pos);
      if (src[pos] === '=') pos++; // skip =
      pos = skipWS(src, pos);
      let value;
      [value, pos] = parseLuaValue(src, pos);
      dict[key] = value;
    } else if (/[a-zA-Z_]/.test(src[pos])) {
      // Bareword key: key = value
      let keyEnd = pos;
      while (keyEnd < src.length && /[a-zA-Z0-9_]/.test(src[keyEnd])) keyEnd++;
      const key = src.slice(pos, keyEnd);
      pos = keyEnd;
      pos = skipWS(src, pos);
      if (src[pos] === '=') {
        isArray = false;
        pos++; // skip =
        pos = skipWS(src, pos);
        let value;
        [value, pos] = parseLuaValue(src, pos);
        dict[key] = value;
      } else {
        // It's a value (boolean/nil that looks like bareword)
        if (key === 'true') result.push(true);
        else if (key === 'false') result.push(false);
        else if (key === 'nil') result.push(null);
      }
    } else {
      // Array element
      let value;
      [value, pos] = parseLuaValue(src, pos);
      result.push(value);
    }

    pos = skipWS(src, pos);
    if (src[pos] === ',') pos++;
    pos = skipWS(src, pos);
  }

  if (pos < src.length) pos++; // skip }
  return [isArray && Object.keys(dict).length === 0 ? result : (result.length > 0 ? { ...dict, _array: result } : dict), pos];
}

// ─── Parse the SavedVariables ────────────────────────────────────────────────

// Find the main assignment: CoATalentExtractorDB = { ... }
const assignStart = raw.indexOf('CoATalentExtractorDB');
if (assignStart < 0) {
  console.error('Could not find CoATalentExtractorDB in file');
  process.exit(1);
}
const eqPos = raw.indexOf('=', assignStart);
const tableStart = raw.indexOf('{', eqPos);

const [db, _] = parseLuaTable(raw, tableStart);

const exportData = db.export;
if (!exportData) {
  console.error('No export section found in SavedVariables');
  process.exit(1);
}

// ─── Extract nodes and connections ───────────────────────────────────────────

const exportNodes = exportData.nodes || exportData.visibleNodes || [];
const hiddenNodes = exportData.hiddenNodes || [];
const connections = exportData.connections || [];

// Lattice data for class tree canonical coords
const latticeRecords = db.lattice || [];
const lattice = Array.isArray(latticeRecords) ? latticeRecords[latticeRecords.length - 1] : latticeRecords;
const latticeClassGrid = lattice?.trees?.class?.grid || [];
const latticeSpecGrid = lattice?.trees?.spec?.grid || [];

console.log(`Export nodes: ${exportNodes.length}`);
console.log(`Hidden nodes: ${hiddenNodes.length}`);
console.log(`Connections: ${connections.length}`);
console.log(`Lattice class grid: ${latticeClassGrid.length}`);
console.log(`Lattice spec grid: ${latticeSpecGrid.length}`);

// Build lookup from frameName -> export node (for name/description/icon/rank)
const exportNodeIndex = new Map();
for (const n of exportNodes) {
  if (n.id) exportNodeIndex.set(n.id, n);
}
// Also index capture nodes if available
const captures = db.captures || [];
const latestCapture = Array.isArray(captures) ? captures[captures.length - 1] : null;
if (latestCapture?.nodes) {
  for (const n of latestCapture.nodes) {
    if (n.frameName && !exportNodeIndex.has(n.frameName)) {
      exportNodeIndex.set(n.frameName, {
        id: n.frameName,
        name: n.parsedName,
        description: n.parsedDescription,
        icon: n.iconTexture,
        rank: n.parsedRank,
        nodeType: n.nodeType,
        nodeShape: n.nodeShape,
        treeType: n.treeType,
        visible: n.isVisible,
      });
    }
  }
}

function buildNode(source, latticeNode) {
  const lat = latticeNode || {};
  const exp = exportNodeIndex.get(source.frameName || source.id) || {};

  return {
    id: source.frameName || source.id || lat.frameName,
    name: source.name || exp.name || exp.parsedName || lat.frameName || 'Unknown',
    description: source.description || exp.description || exp.parsedDescription || '',
    icon: source.icon || exp.icon || exp.iconTexture || 'interface\\talentframe\\talents',
    rank: source.rank || exp.rank || exp.parsedRank,
    nodeType: source.nodeType || lat.nodeType || exp.nodeType,
    nodeShape: source.nodeShape || lat.nodeShape || exp.nodeShape,
    treeType: source.treeType || lat.treeType || exp.treeType,
    visible: source.visible ?? exp.visible ?? 1,
    canonicalRow: source.canonicalRow ?? lat.canonicalRow,
    canonicalCol: source.canonicalCol ?? lat.canonicalCol,
    anchorX: source.anchorX ?? lat.anchorX,
    anchorY: source.anchorY ?? lat.anchorY,
    localTreeX: source.localTreeX ?? lat.localTreeX,
    localTreeY: source.localTreeY ?? lat.localTreeY,
    x: source.x,
    y: source.y,
  };
}

// Build class tree nodes from lattice grid (export is missing them)
const classTreeNodes = [];
for (const lat of latticeClassGrid) {
  const node = buildNode(lat, lat);
  classTreeNodes.push(node);
}

// Build spec tree nodes from export (which has full metadata + canonical)
const specTreeNodes = [];
for (const exp of exportNodes) {
  if (exp.treeType === 'spec') {
    specTreeNodes.push(buildNode(exp, null));
  } else if (exp.treeType === 'class') {
    // If somehow class nodes snuck into export, add them to class tree
    classTreeNodes.push(buildNode(exp, null));
  }
}

// Build connection list
const connectionList = [];
for (const conn of connections) {
  if (!conn.sourceNodeFrame && !conn.sourceNodeId) continue;
  if (!conn.targetNodeFrame && !conn.targetNodeId) continue;

  connectionList.push({
    id: conn.id,
    sourceNodeId: conn.sourceNodeId || conn.sourceNodeFrame,
    targetNodeId: conn.targetNodeId || conn.targetNodeFrame,
    sourceNodeFrame: conn.sourceNodeFrame,
    targetNodeFrame: conn.targetNodeFrame,
    treeType: conn.treeType,
  });
}

// Hidden nodes for reference
const hiddenNodeList = hiddenNodes.map(n => ({
  id: n.id,
  name: n.name || 'Unknown Hidden',
  treeType: n.treeType,
  nodeType: n.nodeType,
  nodeShape: n.nodeShape,
}));

// ─── Build output ────────────────────────────────────────────────────────────

const output = {
  schemaVersion: 5,
  source: {
    type: 'CoATalentExtractorSavedVariables',
    capturedAt: exportData.exportedAt || exportData.sourceCaptureAt || 'unknown',
    convertedAt: new Date().toISOString(),
    hasLattice: exportData.hasLattice ?? true,
    classTreeSource: 'lattice.trees.class.grid',
    specTreeSource: 'export.nodes',
    nodesFound: classTreeNodes.length + specTreeNodes.length,
    connectionCount: connectionList.length,
  },
  classId: 'tinker',
  specId: 'extracted',
  classTree: classTreeNodes,
  specTree: specTreeNodes,
  connections: connectionList,
  hiddenNodes: hiddenNodeList,
};

// ─── Report ──────────────────────────────────────────────────────────────────

console.log('\n── Topology Report ──');
console.log(`Class tree: ${classTreeNodes.length} nodes`);
const classWithCanonical = classTreeNodes.filter(n => n.canonicalRow != null && n.canonicalCol != null);
console.log(`  with canonical coords: ${classWithCanonical.length}`);
console.log(`  without canonical: ${classTreeNodes.length - classWithCanonical.length}`);
console.log(`  with names: ${classTreeNodes.filter(n => n.name && n.name !== 'Unknown' && !n.name.startsWith('CoATalent')).length}`);
const classRows = new Set(classWithCanonical.map(n => n.canonicalRow));
const classCols = new Set(classWithCanonical.map(n => n.canonicalCol));
console.log(`  unique rows: ${classRows.size} (${[...classRows].sort((a,b)=>a-b).join(',')})`);
console.log(`  unique cols: ${classCols.size} (${[...classCols].sort((a,b)=>a-b).join(',')})`);

console.log(`Spec tree: ${specTreeNodes.length} nodes`);
const specWithCanonical = specTreeNodes.filter(n => n.canonicalRow != null && n.canonicalCol != null);
console.log(`  with canonical coords: ${specWithCanonical.length}`);
console.log(`  without canonical: ${specTreeNodes.length - specWithCanonical.length}`);
console.log(`  with names: ${specTreeNodes.filter(n => n.name && n.name !== 'Unknown').length}`);
const specRows = new Set(specWithCanonical.map(n => n.canonicalRow));
const specCols = new Set(specWithCanonical.map(n => n.canonicalCol));
console.log(`  unique rows: ${specRows.size} (${[...specRows].sort((a,b)=>a-b).join(',')})`);
console.log(`  unique cols: ${specCols.size} (${[...specCols].sort((a,b)=>a-b).join(',')})`);

console.log(`Connections: ${connectionList.length} total`);
const specConns = connectionList.filter(c => c.treeType === 'spec');
const classConns = connectionList.filter(c => c.treeType === 'class');
console.log(`  spec: ${specConns.length}, class: ${classConns.length}, other: ${connectionList.length - specConns.length - classConns.length}`);

console.log(`Hidden nodes: ${hiddenNodeList.length}`);

// Check for duplicate cells
for (const [label, nodes] of [['Class', classTreeNodes], ['Spec', specTreeNodes]]) {
  const cellMap = new Map();
  for (const n of nodes) {
    if (n.canonicalRow == null || n.canonicalCol == null) continue;
    const key = `${n.canonicalRow},${n.canonicalCol}`;
    if (cellMap.has(key)) {
      console.warn(`  ⚠ ${label} duplicate cell [${key}]: "${n.name}" collides with "${cellMap.get(key)}"`);
    } else {
      cellMap.set(key, n.name);
    }
  }
}

// ─── Write output ────────────────────────────────────────────────────────────

writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`\nWritten: ${outputPath}`);
