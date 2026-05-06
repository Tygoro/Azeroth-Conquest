import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type LuaValue = string | number | boolean | null | LuaObject | LuaValue[];
type LuaObject = { [key: string]: LuaValue };

type NormalizedNode = {
  id: string;
  region?: 'classTree' | 'specTree' | 'sidebarTrack';
  sourceFrameName?: string;
  advancementId?: number;
  spellId?: number;
  name?: string;
  description?: string;
  icon?: string;
  rank?: string;
  nodeShape?: 'square' | 'circle' | 'octagon';
  nodeType?: 'active' | 'passive' | 'choice';
  autoGranted?: boolean;
  x?: number;
  y?: number;
  visible?: boolean;
  shown?: boolean;
  locked?: boolean;
  prerequisites: string[];
  source?: Record<string, unknown>;
};

type NormalizedConnection = {
  id: string;
  sourceNodeFrame?: string;
  targetNodeFrame?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  anchors?: unknown;
  position?: unknown;
  raw?: unknown;
};

class LuaSavedVariablesParser {
  private readonly text: string;
  private index = 0;

  constructor(input: string) {
    this.text = input.replace(/--.*$/gm, '');
  }

  parse(): LuaObject {
    this.skipWhitespace();
    const rootName = this.readIdentifier();
    this.skipWhitespace();
    this.expect('=');
    const value = this.readValue();
    if (!this.isObject(value) || Array.isArray(value)) {
      throw new Error(`Expected ${rootName} to be a Lua table object.`);
    }
    return value;
  }

  private readValue(): LuaValue {
    this.skipWhitespace();
    const char = this.peek();

    if (char === '{') return this.readTable();
    if (char === '"') return this.readString();
    if (char === '-' || this.isDigit(char)) return this.readNumber();

    const identifier = this.readIdentifier();
    if (identifier === 'true') return true;
    if (identifier === 'false') return false;
    if (identifier === 'nil') return null;
    return identifier;
  }

  private readTable(): LuaObject | LuaValue[] {
    this.expect('{');
    const arrayValues: LuaValue[] = [];
    const objectValues: LuaObject = {};
    let hasObjectKeys = false;

    while (true) {
      this.skipWhitespace();
      if (this.peek() === '}') {
        this.index++;
        break;
      }

      if (this.peek() === '[') {
        this.index++;
        this.skipWhitespace();
        const key = this.peek() === '"' ? this.readString() : String(this.readNumber());
        this.skipWhitespace();
        this.expect(']');
        this.skipWhitespace();
        this.expect('=');
        const value = this.readValue();
        objectValues[key] = value;
        hasObjectKeys = true;
      } else {
        const value = this.readValue();
        arrayValues.push(value);
      }

      this.skipWhitespace();
      if (this.peek() === ',' || this.peek() === ';') this.index++;
    }

    if (!hasObjectKeys) return arrayValues;
    for (let i = 0; i < arrayValues.length; i++) objectValues[String(i + 1)] = arrayValues[i];
    return objectValues;
  }

  private readString(): string {
    this.expect('"');
    let output = '';

    while (this.index < this.text.length) {
      const char = this.text[this.index++];
      if (char === '"') break;
      if (char === '\\') {
        const next = this.text[this.index++];
        if (next === 'n') output += '\n';
        else if (next === 'r') output += '\r';
        else if (next === 't') output += '\t';
        else output += next;
      } else {
        output += char;
      }
    }

    return output;
  }

  private readNumber(): number {
    const start = this.index;
    if (this.peek() === '-') this.index++;
    while (this.isDigit(this.peek())) this.index++;
    if (this.peek() === '.') {
      this.index++;
      while (this.isDigit(this.peek())) this.index++;
    }
    return Number(this.text.slice(start, this.index));
  }

  private readIdentifier(): string {
    const start = this.index;
    while (/[A-Za-z0-9_]/.test(this.peek())) this.index++;
    if (start === this.index) throw new Error(`Expected identifier at offset ${this.index}.`);
    return this.text.slice(start, this.index);
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek())) this.index++;
  }

  private expect(expected: string): void {
    this.skipWhitespace();
    if (this.text[this.index] !== expected) {
      throw new Error(`Expected "${expected}" at offset ${this.index}, got "${this.text[this.index]}".`);
    }
    this.index++;
  }

  private peek(): string {
    return this.text[this.index] ?? '';
  }

  private isDigit(value: string): boolean {
    return /[0-9]/.test(value);
  }

  private isObject(value: LuaValue): value is LuaObject {
    return typeof value === 'object' && value !== null;
  }
}

function objectValues(value: LuaValue | undefined): LuaObject[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.filter(isRecord) as LuaObject[];
  return Object.keys(value)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => (value as LuaObject)[key])
    .filter(isRecord) as LuaObject[];
}

function isRecord(value: LuaValue): value is LuaObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: LuaValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: LuaValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: LuaValue | undefined): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return undefined;
}

function normalizedNodeType(value: LuaValue | undefined): 'active' | 'passive' | 'choice' | undefined {
  if (typeof value !== 'string') return undefined;
  const lower = value.toLowerCase();
  if (lower.includes('choice') || lower.includes('split') || lower.includes('oct')) return 'choice';
  if (lower.includes('passive') || lower.includes('circle')) return 'passive';
  if (lower.includes('active') || lower.includes('square') || lower.includes('spell')) return 'active';
  return undefined;
}

function normalizedNodeShape(value: LuaValue | undefined): 'square' | 'circle' | 'octagon' | undefined {
  if (typeof value !== 'string') return undefined;
  const lower = value.toLowerCase();
  if (lower.includes('square')) return 'square';
  if (lower.includes('circle') || lower.includes('round')) return 'circle';
  if (lower.includes('oct') || lower.includes('choice') || lower.includes('split')) return 'octagon';
  return undefined;
}

function nodeTypeFromShape(shape: 'square' | 'circle' | 'octagon' | undefined): 'active' | 'passive' | 'choice' | undefined {
  if (shape === 'square') return 'active';
  if (shape === 'circle') return 'passive';
  if (shape === 'octagon') return 'choice';
  return undefined;
}

function stripWowMarkup(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/\|c[0-9a-fA-F]{8}/g, '')
    .replace(/\|r/g, '')
    .replace(/\|T[^|]+\|t/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function preserveTooltipFormatting(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/\|c[0-9a-fA-F]{8}/g, '')
    .replace(/\|r/g, '')
    .replace(/\|T([^:|]+)(?::[^|]*)?\|t/g, '[$1]')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function extractNumberAfter(label: string, text: string | undefined): number | undefined {
  if (!text) return undefined;
  const clean = stripWowMarkup(text) ?? '';
  const pattern = new RegExp(`${label}\\s*([0-9]+)`, 'i');
  const match = clean.match(pattern);
  return match ? Number(match[1]) : undefined;
}

function normalizeId(input: string | undefined, fallback: string): string {
  const source = input || fallback;
  const templateMatch = source.match(/CoATalentButtonSquareTemplate(\d+)/i);
  if (templateMatch) return `tinker_node_${templateMatch[1].padStart(2, '0')}`;
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
}

function tooltipText(node: LuaObject): string | undefined {
  const tooltip = node.tooltip;
  if (!isRecord(tooltip)) return undefined;
  const lines = objectValues(tooltip.lines);
  const text = lines
    .map((line) => asString(line.left))
    .filter(Boolean)
    .join('\n');
  return text || undefined;
}

function normalizedDescription(node: LuaObject): string | undefined {
  const explicit = asString(node.description);
  const fromTooltip = tooltipText(node);
  return preserveTooltipFormatting(explicit ?? fromTooltip);
}

function normalizeNode(node: LuaObject, index: number): NormalizedNode {
  const sourceFrameName = asString(node.frameName) ?? asString(node.id);
  const id = normalizeId(sourceFrameName, `tinker_node_${String(index + 1).padStart(2, '0')}`);
  const description = normalizedDescription(node);
  const primitiveFields = isRecord(node.primitiveFields) ? node.primitiveFields : {};
  const position = isRecord(node.position) ? node.position : undefined;
  const relativeToRoot = position && isRecord(position.relativeToRoot) ? position.relativeToRoot : undefined;
  const nodeShape = normalizedNodeShape(node.nodeShape) ?? normalizedNodeShape(primitiveFields.nodeShape) ?? normalizedNodeShape(primitiveFields.shape);

  const advancementId =
    asNumber(node.advancementId) ??
    asNumber(primitiveFields.CharacterAdvancementID) ??
    asNumber(primitiveFields.characterAdvancementID) ??
    asNumber(primitiveFields.characterAdvancementId) ??
    extractNumberAfter('CharacterAdvancement ID', description);

  const spellId =
    asNumber(node.spellId) ??
    asNumber(node.spellID) ??
    asNumber(primitiveFields.spellID) ??
    asNumber(primitiveFields.spellId) ??
    extractNumberAfter('ID', description);

  return {
    id,
    region: undefined,
    sourceFrameName,
    advancementId,
    spellId,
    name: asString(node.parsedName) ?? asString(node.name),
    description,
    icon: asString(node.iconTexture) ?? asString(node.icon),
    rank: asString(node.parsedRank) ?? asString(node.rank),
    nodeShape,
    nodeType: normalizedNodeType(node.nodeType) ?? normalizedNodeType(primitiveFields.nodeType) ?? normalizedNodeType(primitiveFields.type) ?? nodeTypeFromShape(nodeShape),
    autoGranted: asBoolean(node.autoGranted) ?? asBoolean(primitiveFields.autoGranted) ?? asBoolean(primitiveFields.isAutoGranted),
    x: asNumber(node.x) ?? asNumber(relativeToRoot?.x),
    y: asNumber(node.y) ?? asNumber(relativeToRoot?.y),
    visible: asBoolean(node.visible) ?? asBoolean(node.isVisible),
    shown: asBoolean(node.isShown),
    locked: asBoolean(node.locked) ?? description?.toLowerCase().includes('spend more points to unlock this talent'),
    prerequisites: [],
    source: {
      rawFrameName: sourceFrameName,
      anchors: node.anchors,
    },
  };
}

function normalizeConnection(connection: LuaObject, index: number, nodeByFrame: Map<string, string>): NormalizedConnection {
  const sourceNodeFrame = asString(connection.sourceNodeFrame);
  const targetNodeFrame = asString(connection.targetNodeFrame);
  return {
    id: `tinker_connection_${String(index + 1).padStart(2, '0')}`,
    sourceNodeFrame,
    targetNodeFrame,
    sourceNodeId: sourceNodeFrame ? nodeByFrame.get(sourceNodeFrame) : undefined,
    targetNodeId: targetNodeFrame ? nodeByFrame.get(targetNodeFrame) : undefined,
    anchors: connection.anchors,
    position: connection.position,
    raw: {
      frameName: connection.frameName,
      parentFrame: connection.parentFrame,
      isShown: connection.isShown,
      isVisible: connection.isVisible,
    },
  };
}

function classifyRegions(nodes: NormalizedNode[]): {
  classTree: NormalizedNode[];
  specTree: NormalizedNode[];
  sidebarTrack: NormalizedNode[];
} {
  const positioned = nodes.filter((node) => typeof node.x === 'number');
  if (positioned.length === 0) return { classTree: nodes, specTree: [], sidebarTrack: [] };

  const xs = positioned.map((node) => node.x as number).sort((a, b) => a - b);
  const minX = xs[0];
  const maxX = xs[xs.length - 1];
  const span = Math.max(1, maxX - minX);
  const classCutoff = minX + span * 0.38;
  const sidebarCutoff = minX + span * 0.82;

  const classTree: NormalizedNode[] = [];
  const specTree: NormalizedNode[] = [];
  const sidebarTrack: NormalizedNode[] = [];

  for (const node of nodes) {
    const x = node.x;
    const region = typeof x !== 'number'
      ? 'specTree'
      : x >= sidebarCutoff
        ? 'sidebarTrack'
        : x <= classCutoff
          ? 'classTree'
          : 'specTree';
    node.region = region;
    if (region === 'classTree') classTree.push(node);
    else if (region === 'sidebarTrack') sidebarTrack.push(node);
    else specTree.push(node);
  }

  const sortByPosition = (a: NormalizedNode, b: NormalizedNode) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0);
  classTree.sort(sortByPosition);
  specTree.sort(sortByPosition);
  sidebarTrack.sort(sortByPosition);

  return { classTree, specTree, sidebarTrack };
}

function latestCapture(db: LuaObject): LuaObject | undefined {
  const captures = objectValues(db.captures);
  return captures[captures.length - 1];
}

function sourceNodes(db: LuaObject, capture: LuaObject | undefined): LuaObject[] {
  const captureNodes = capture ? objectValues(capture.nodes) : [];
  if (captureNodes.length) return captureNodes;
  if (isRecord(db.export)) return objectValues(db.export.nodes);
  return [];
}

function increment(counts: Record<string, number>, key: string | undefined): void {
  counts[key ?? 'unknown'] = (counts[key ?? 'unknown'] ?? 0) + 1;
}

function duplicateValues(nodes: NormalizedNode[], key: keyof NormalizedNode): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of nodes) {
    const value = node[key];
    if (value === undefined || value === null) continue;
    increment(counts, String(value));
  }
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 1));
}

function buildDiagnostics(nodes: NormalizedNode[], connections: NormalizedConnection[], regions: {
  classTree: NormalizedNode[];
  specTree: NormalizedNode[];
  sidebarTrack: NormalizedNode[];
}) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodeShapeCounts: Record<string, number> = {};
  const nodeTypeCounts: Record<string, number> = {};
  for (const node of nodes) {
    increment(nodeShapeCounts, node.nodeShape);
    increment(nodeTypeCounts, node.nodeType);
  }

  const orphanConnections = connections.filter((connection) =>
    !connection.sourceNodeId ||
    !connection.targetNodeId ||
    !nodeIds.has(connection.sourceNodeId) ||
    !nodeIds.has(connection.targetNodeId) ||
    connection.sourceNodeId === connection.targetNodeId,
  );
  const missingConnectionNodeFrames = Array.from(new Set(orphanConnections.flatMap((connection) => [
    connection.sourceNodeFrame && !connection.sourceNodeId ? connection.sourceNodeFrame : undefined,
    connection.targetNodeFrame && !connection.targetNodeId ? connection.targetNodeFrame : undefined,
  ]).filter((value): value is string => Boolean(value)))).sort();
  const decorativeConnectionCount = orphanConnections.filter((connection) => !connection.sourceNodeFrame && !connection.targetNodeFrame).length;

  return {
    summary: {
      totalNodes: nodes.length,
      classNodes: regions.classTree.length,
      specNodes: regions.specTree.length,
      ascensionNodes: regions.sidebarTrack.length,
      connectionCount: connections.length,
      choiceNodeCount: nodes.filter((node) => node.nodeType === 'choice' || node.nodeShape === 'octagon').length,
      autoGrantedNodeCount: nodes.filter((node) => node.autoGranted === true).length,
      hiddenNodeCount: nodes.filter((node) => node.visible === false || node.shown === false).length,
      validConnectionCount: connections.length - orphanConnections.length,
      orphanConnectionCount: orphanConnections.length,
      decorativeConnectionCount,
      missingConnectionNodeFrameCount: missingConnectionNodeFrames.length,
    },
    nodeShapeCounts,
    nodeTypeCounts,
    duplicates: {
      ids: duplicateValues(nodes, 'id'),
      names: duplicateValues(nodes, 'name'),
      advancementIds: duplicateValues(nodes, 'advancementId'),
      spellIds: duplicateValues(nodes, 'spellId'),
    },
    missing: {
      names: nodes.filter((node) => !node.name).map((node) => node.id),
      descriptions: nodes.filter((node) => !node.description).map((node) => node.id),
      icons: nodes.filter((node) => !node.icon || node.icon.toLowerCase() === 'interface\\talentframe\\talents').map((node) => node.id),
      nodeShapes: nodes.filter((node) => !node.nodeShape).map((node) => node.id),
      advancementIds: nodes.filter((node) => node.advancementId === undefined).map((node) => node.id),
    },
    hiddenNodes: nodes.filter((node) => node.visible === false || node.shown === false).map((node) => node.id),
    missingConnectionNodeFrames,
    orphanConnections: orphanConnections.map((connection) => ({
      id: connection.id,
      sourceNodeFrame: connection.sourceNodeFrame,
      targetNodeFrame: connection.targetNodeFrame,
      sourceNodeId: connection.sourceNodeId,
      targetNodeId: connection.targetNodeId,
    })),
    separation: {
      classTreeSeparated: regions.classTree.length > 0,
      specTreeSeparated: regions.specTree.length > 0,
      ascensionTrackSeparated: regions.sidebarTrack.length > 0,
    },
    progressionModel: {
      pointPools: ['classTree', 'specTree'],
      allocationAfterLevel10: 'alternating_class_spec_unverified',
      autoGrantedLevel10: regions.sidebarTrack.length > 0 ? 'ascension_track_detected_unverified' : 'not_detected',
      ascensionMilestoneLevels: [10, 20, 30, 40, 50],
    },
  };
}

function normalizeExtractorDb(db: LuaObject) {
  const capture = latestCapture(db);
  const rawNodes = sourceNodes(db, capture);
  const nodes = rawNodes.map(normalizeNode);
  const nodeByFrame = new Map<string, string>();
  for (const node of nodes) {
    if (node.sourceFrameName) nodeByFrame.set(node.sourceFrameName, node.id);
  }

  const rawConnections = capture ? objectValues(capture.connections) : [];
  const connections = rawConnections.map((connection, index) => normalizeConnection(connection, index, nodeByFrame));
  const regions = classifyRegions(nodes);
  const diagnostics = buildDiagnostics(nodes, connections, regions);

  for (const connection of connections) {
    if (connection.sourceNodeId && connection.targetNodeId && connection.sourceNodeId !== connection.targetNodeId) {
      const target = nodes.find((node) => node.id === connection.targetNodeId);
      const source = nodes.find((node) => node.id === connection.sourceNodeId);
      if (target && source && target.region === source.region && !target.prerequisites.includes(connection.sourceNodeId)) {
        target.prerequisites.push(connection.sourceNodeId);
      }
    }
  }

  return {
    schemaVersion: 1,
    source: {
      type: 'CoATalentExtractorSavedVariables',
      capturedAt: asString(capture?.capturedAt),
      rootName: asString(capture?.rootName),
      nodesFound: asNumber(capture?.nodesFound) ?? nodes.length,
      connectionCount: asNumber(capture?.connectionCount) ?? connections.length,
    },
    classId: 'tinker',
    specId: 'extracted',
    classTree: regions.classTree,
    specTree: regions.specTree,
    sidebarTrack: regions.sidebarTrack,
    diagnostics,
    nodes,
    connections,
  };
}

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const resolveFromRepo = (path: string) => (isAbsolute(path) ? path : resolve(repoRoot, path));
  const inputPath = resolveFromRepo(process.argv[2] ?? 'C:/Program Files/Ascension Launcher/resources/ascension_ptr/WTF/Account/tygoro2/SavedVariables/CoATalentExtractor.lua');
  const outputPath = resolveFromRepo(process.argv[3] ?? 'artifacts/conquest-calculator/src/data/talents/tinker.json');

  const lua = readFileSync(inputPath, 'utf8');
  const parsed = new LuaSavedVariablesParser(lua).parse();
  const normalized = normalizeExtractorDb(parsed);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${normalized.nodes.length} nodes and ${normalized.connections.length} connections to ${outputPath}`);
}

main();
