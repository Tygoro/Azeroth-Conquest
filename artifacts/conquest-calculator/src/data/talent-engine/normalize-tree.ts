import type { ClassDetail, ClassMeta, SidebarNode, TalentNode, TalentTree } from '@workspace/api-client-react';
import {
  ClassManifestDataSchema,
  TalentTreeDataSchema,
  type ClassManifestData,
  type TalentNodeData,
  type TalentTreeData,
} from './talent-schema';

type ExtractedNodeData = {
  id?: string;
  advancementId?: number;
  spellId?: number;
  name?: string;
  description?: string;
  icon?: string;
  rank?: string;
  nodeShape?: 'square' | 'circle' | 'octagon';
  nodeType?: 'active' | 'passive' | 'choice';
  autoGranted?: boolean;
  unlockAt?: number;
  expandedDescription?: string;
  requiredLevel?: number;
  reqTabPoints?: number;
  x?: number;
  y?: number;
  gridRow?: number;
  gridColumn?: number;
  // Canonical fields from addon export (v5+)
  canonicalRow?: number;
  canonicalCol?: number;
  anchorX?: number;
  anchorY?: number;
  localTreeX?: number;
  localTreeY?: number;
  treeType?: string;
  visible?: boolean | number;
  shown?: boolean;
  locked?: boolean;
  prerequisites?: string[];
};

type ExtractedConnectionData = {
  id?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  // v5 export: frame names used as IDs when numeric IDs unavailable
  sourceNodeFrame?: string;
  targetNodeFrame?: string;
};

type ExtractedTreeData = {
  classId?: string;
  specId?: string;
  nodes?: ExtractedNodeData[];
  classTree?: ExtractedNodeData[];
  specTree?: ExtractedNodeData[];
  sidebarTrack?: ExtractedNodeData[];
  connections?: ExtractedConnectionData[];
};

function normalizeNode(node: TalentNodeData): TalentNode {
  return {
    ...node,
    currentPoints: node.currentPoints ?? 0,
  };
}

export function normalizeTalentTreeData(data: unknown): TalentTree | undefined {
  if (data === undefined || data === null) return undefined;

  const parsed = TalentTreeDataSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('Invalid JSON talent tree data:', parsed.error.flatten());
    return undefined;
  }

  const treeData: TalentTreeData = parsed.data;
  const tree = treeData.tree;

  if (tree.classId !== treeData.classId || tree.specId !== treeData.specId) {
    console.warn('Invalid JSON talent tree data: wrapper class/spec does not match tree class/spec.');
    return undefined;
  }

  return {
    ...tree,
    leftTree: tree.leftTree.map(normalizeNode),
    rightTree: tree.rightTree.map(normalizeNode),
    sidebarTrack: tree.sidebarTrack ?? [],
  };
}

export function normalizeClassManifestData(data: unknown): ClassDetail | undefined {
  if (data === undefined || data === null) return undefined;

  const parsed = ClassManifestDataSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('Invalid JSON class manifest data:', parsed.error.flatten());
    return undefined;
  }

  const manifest: ClassManifestData = parsed.data;
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    icon: manifest.icon,
    color: manifest.color,
    specs: manifest.specs,
  };
}

export function normalizeClassMetaData(data: unknown): ClassMeta | undefined {
  const detail = normalizeClassManifestData(data);
  if (!detail) return undefined;
  return {
    id: detail.id,
    name: detail.name,
    description: detail.description,
    icon: detail.icon,
    color: detail.color,
  };
}

function maxPointsFromRank(rank: string | undefined): number {
  const match = rank?.match(/\/(\d+)/);
  return match ? Math.max(1, Number(match[1])) : 1;
}

// ── Canonical node type: trust addon export directly ─────────────────────────
function nodeTypeFromExtracted(node: ExtractedNodeData): TalentNode['type'] {
  if (node.nodeShape === 'octagon' || node.nodeType === 'choice') return 'choice';
  if (node.nodeShape === 'circle' || node.nodeType === 'passive') return 'passive';
  if (node.nodeShape === 'square' || node.nodeType === 'active') return 'active';
  return 'active';
}

// ── Adaptive coordinate normalization ─────────────────────────────────────────
// Per-tree target canvas dimensions. The normalizer computes a uniform scale
// factor that preserves the authored aspect ratio while fitting within these
// targets. Comparable to Dragonflight talent tree panel sizing.
const TREE_TARGETS: Record<'left' | 'right', { width: number; height: number }> = {
  left:  { width: 620, height: 760 },   // class tree — wider, taller for stable spacing
  right: { width: 720, height: 760 },   // spec tree — wider, taller for stable spacing
};
// Padding added around the normalized tree so nodes aren't flush with edges.
const TREE_PAD_X = 48;
const TREE_PAD_Y = 64; // must exceed NODE_HALF=26px so top-row nodes don't clip above the canvas
// Minimum distance between adjacent node centers (px) — prevents overlap.
const MIN_NODE_SPACING_X = 72;
const MIN_NODE_SPACING_Y = 68;

// ── Canonical extracted node normalization ────────────────────────────────────
// Trusts the addon export's canonicalRow/canonicalCol and connection graph
// directly. No heuristic lattice assignment, no placeholder injection, no
// geometric prerequisite fabrication.

function normalizeExtractedNodes(
  nodes: ExtractedNodeData[],
  prereqsByTarget: Map<string, Set<string>>,
  side: 'left' | 'right',
): TalentNode[] {
  const nodeIds = new Set(nodes.map((n) => n.id).filter(Boolean));
  const occupancy = new Map<string, string>();
  let missingCoordCount = 0;

  const result = nodes
    .filter((node): node is ExtractedNodeData & { id: string; name: string } =>
      Boolean(node.id && node.name),
    )
    .map<TalentNode>((node) => {
      // Resolve canonical grid coordinates: prefer canonicalRow/Col, fall back
      // to gridRow/gridColumn if already set (e.g. from a pre-processed JSON).
      const gridRow = node.canonicalRow ?? node.gridRow;
      const gridColumn = node.canonicalCol ?? node.gridColumn;

      if (!gridRow || !gridColumn) {
        missingCoordCount++;
        console.warn(
          `[talents] ${side} node "${node.name}" (${node.id}) missing canonical coords:`,
          { canonicalRow: node.canonicalRow, canonicalCol: node.canonicalCol, gridRow: node.gridRow, gridColumn: node.gridColumn },
        );
      }

      // Duplicate occupancy check
      if (gridRow && gridColumn) {
        const cellKey = `${gridRow},${gridColumn}`;
        const existing = occupancy.get(cellKey);
        if (existing) {
          console.warn(
            `[talents] ${side} duplicate cell [${cellKey}]: "${node.name}" collides with "${existing}"`,
          );
        } else {
          occupancy.set(cellKey, node.name);
        }
      }

      // Use exported connections directly — no geometric prerequisite fabrication.
      const exportedPrereqs = prereqsByTarget.get(node.id) ?? new Set<string>();
      // Filter to only prereqs that exist in this tree's node set.
      const allPrereqs = Array.from(exportedPrereqs).filter((pid) => nodeIds.has(pid));
      const orphanedPrereqs = Array.from(exportedPrereqs).filter((pid) => !nodeIds.has(pid));
      if (orphanedPrereqs.length > 0) {
        console.warn(
          `[talents] ${side} node "${node.name}" has prereqs referencing missing nodes:`,
          orphanedPrereqs,
        );
      }

      // Row-1 nodes are unconditional roots — strip any inferred prerequisites.
      // The row-comparison logic is correct for all mid/deep nodes, but a connection
      // that exits the row-1 boundary can still produce a false prereq assignment
      // if two row-1 nodes are connected or if coordinate data is imprecise.
      const validPrereqs = gridRow === 1 ? [] : allPrereqs;
      if (gridRow === 1 && allPrereqs.length > 0) {
        console.warn(
          `[talents] ${side} row-1 node "${node.name}" (${node.id}) had ${allPrereqs.length} prereqs stripped (guaranteed root)`,
        );
      }

      // Pixel position: use anchor coords when available, fall back to raw x/y.
      const px = node.anchorX ?? node.localTreeX ?? node.x ?? 0;
      const py = node.anchorY ?? node.localTreeY ?? node.y ?? 0;

      return {
        id: node.id,
        name: node.name,
        description: node.description ?? '',
        maxPoints: maxPointsFromRank(node.rank),
        currentPoints: 0,
        prerequisites: validPrereqs,
        position: {
          x: px,
          y: py,
          gridRow,
          gridColumn,
        },
        icon: node.icon,
        type: nodeTypeFromExtracted(node),
        autoGranted: node.autoGranted === true || (node.autoGranted as unknown) === 1 ? true : undefined,
        unlockAt: node.unlockAt,
        expandedDescription: node.expandedDescription,
        requiredLevel: node.requiredLevel != null && node.requiredLevel > 0 ? node.requiredLevel : undefined,
        reqTabPoints: node.reqTabPoints != null && node.reqTabPoints > 0 ? node.reqTabPoints : undefined,
      };
    });

  if (missingCoordCount > 0) {
    console.warn(`[talents] ${side} tree: ${missingCoordCount}/${nodes.length} nodes missing canonical coordinates`);
  }

  // ── Adaptive tree-local coordinate normalization ─────────────────────────
  // Compute bounds from raw authored anchor positions, derive a uniform
  // aspect-ratio-preserving scale that fits the target canvas, enforce
  // minimum spacing guards, then apply.
  if (result.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of result) {
      if (n.position.x < minX) minX = n.position.x;
      if (n.position.x > maxX) maxX = n.position.x;
      if (n.position.y < minY) minY = n.position.y;
      if (n.position.y > maxY) maxY = n.position.y;
    }

    const rawW = maxX - minX || 1;
    const rawH = maxY - minY || 1;

    // Target dimensions for this side (minus padding on each edge).
    const target = TREE_TARGETS[side];
    const availW = target.width - TREE_PAD_X * 2;
    const availH = target.height - TREE_PAD_Y * 2;

    // Aspect-ratio-preserving uniform scale.
    const scaleX = availW / rawW;
    const scaleY = availH / rawH;
    let scale = Math.min(scaleX, scaleY);

    // ── Minimum spacing guard ─────────────────────────────────────────────
    // Collect unique sorted X and Y values to compute the tightest gaps
    // in the authored data. If scaling would collapse those gaps below the
    // minimum readable spacing, clamp the scale upward.
    const uniqueX = [...new Set(result.map((n) => n.position.x))].sort((a, b) => a - b);
    const uniqueY = [...new Set(result.map((n) => n.position.y))].sort((a, b) => a - b);

    let minGapX = Infinity;
    for (let i = 1; i < uniqueX.length; i++) {
      const gap = uniqueX[i] - uniqueX[i - 1];
      if (gap > 0 && gap < minGapX) minGapX = gap;
    }
    let minGapY = Infinity;
    for (let i = 1; i < uniqueY.length; i++) {
      const gap = uniqueY[i] - uniqueY[i - 1];
      if (gap > 0 && gap < minGapY) minGapY = gap;
    }

    // If the smallest authored gap, when scaled, falls below the minimum
    // readable node spacing, increase the scale so it just meets the minimum.
    if (isFinite(minGapX) && minGapX * scale < MIN_NODE_SPACING_X) {
      scale = Math.max(scale, MIN_NODE_SPACING_X / minGapX);
    }
    if (isFinite(minGapY) && minGapY * scale < MIN_NODE_SPACING_Y) {
      scale = Math.max(scale, MIN_NODE_SPACING_Y / minGapY);
    }

    const finalW = rawW * scale;
    const finalH = rawH * scale;
    const canvasW = finalW + TREE_PAD_X * 2;
    const canvasH = finalH + TREE_PAD_Y * 2;

    // DEV logging: adaptive scaling metrics
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[talents] ${side} tree adaptive scaling:`, {
        rawBounds: { minX, maxX, minY, maxY },
        rawSize: { width: rawW, height: rawH },
        target: { width: target.width, height: target.height },
        scaleFactors: { scaleX: +scaleX.toFixed(4), scaleY: +scaleY.toFixed(4), chosen: +scale.toFixed(4) },
        minAuthoredGaps: { x: isFinite(minGapX) ? minGapX : 'n/a', y: isFinite(minGapY) ? minGapY : 'n/a' },
        scaledMinGaps: { x: isFinite(minGapX) ? +(minGapX * scale).toFixed(1) : 'n/a', y: isFinite(minGapY) ? +(minGapY * scale).toFixed(1) : 'n/a' },
        finalCanvasSize: { width: +canvasW.toFixed(1), height: +canvasH.toFixed(1) },
        nodeCount: result.length,
      });
    }

    // Apply: normalize to tree-local origin, scale uniformly, add padding.
    for (const n of result) {
      n.position.x = (n.position.x - minX) * scale + TREE_PAD_X;
      n.position.y = (n.position.y - minY) * scale + TREE_PAD_Y;
    }
  }

  return result;
}

function normalizeExtractedSidebar(nodes: ExtractedNodeData[]): SidebarNode[] {
  return nodes
    .filter((node): node is ExtractedNodeData & { id: string; name: string; description: string } =>
      Boolean(node.id && node.name && node.description),
    )
    .map<SidebarNode>((node, index) => ({
      id: node.id,
      name: node.name,
      description: node.description,
      icon: node.icon,
      unlockPointsRequired: 10 + index * 10,
    }));
}

export function normalizeExtractedTalentTreeData(
  data: unknown,
  meta: ClassMeta,
  specId: string,
  specName: string,
): TalentTree | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const extracted = data as ExtractedTreeData;
  const flatNodes = extracted.nodes ?? [];
  const classTreeSource = extracted.classTree ?? [];
  const specTreeSource = extracted.specTree ?? flatNodes;
  const sidebarSource = extracted.sidebarTrack ?? [];
  if (extracted.classId !== meta.id || (!flatNodes.length && !classTreeSource.length && !specTreeSource.length)) return undefined;

  const nodeRegion = new Map<string, 'classTree' | 'specTree' | 'sidebarTrack'>();
  for (const node of classTreeSource) if (node.id) nodeRegion.set(node.id, 'classTree');
  for (const node of specTreeSource) if (node.id) nodeRegion.set(node.id, 'specTree');
  for (const node of sidebarSource) if (node.id) nodeRegion.set(node.id, 'sidebarTrack');
  const nodeIds = new Set([...classTreeSource, ...specTreeSource, ...sidebarSource, ...flatNodes].map((node) => node.id).filter(Boolean));

  // Row lookup for direction-independent edge resolution.
  // The node with the HIGHER canonicalRow is always the child (dependent).
  // This is universally true for both class tree (root=row1, flows down) and
  // spec tree (root=row1, flows up) — confirmed by auditing all 90 connections.
  const nodeRowMap = new Map<string, number>();
  for (const node of [...classTreeSource, ...specTreeSource, ...sidebarSource, ...flatNodes]) {
    if (node.id) {
      const row = node.canonicalRow ?? node.gridRow ?? 0;
      nodeRowMap.set(node.id, row);
    }
  }

  let orphanConnectionCount = 0;
  const prereqsByTarget = new Map<string, Set<string>>();

  for (const connection of extracted.connections ?? []) {
    // Resolve source/target: prefer sourceNodeId, fall back to sourceNodeFrame (v5 export)
    const src = connection.sourceNodeId ?? connection.sourceNodeFrame;
    const tgt = connection.targetNodeId ?? connection.targetNodeFrame;
    if (!src || !tgt) {
      orphanConnectionCount++;
      continue;
    }
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) {
      orphanConnectionCount++;
      continue;
    }
    if (src === tgt) {
      orphanConnectionCount++;
      continue;
    }
    if (nodeRegion.get(src) !== nodeRegion.get(tgt)) {
      orphanConnectionCount++;
      continue;
    }
    // Determine child/parent by row: higher canonicalRow = child (dependent).
    // This is direction-independent — works for both class and spec trees.
    const srcRow = nodeRowMap.get(src) ?? 0;
    const tgtRow = nodeRowMap.get(tgt) ?? 0;
    const child  = srcRow >= tgtRow ? src : tgt;
    const parent = srcRow >= tgtRow ? tgt : src;

    if (!prereqsByTarget.has(child)) {
      prereqsByTarget.set(child, new Set());
    }
    prereqsByTarget.get(child)!.add(parent);
  }

  const leftTree = normalizeExtractedNodes(classTreeSource, prereqsByTarget, 'left');
  const rightTree = normalizeExtractedNodes(specTreeSource, prereqsByTarget, 'right');
  const sidebarTrack = normalizeExtractedSidebar(sidebarSource);
  const renderedNodes = [...leftTree, ...rightTree];
  const missingIconCount = renderedNodes.filter((node) => !node.icon || node.icon.toLowerCase() === 'interface\\talentframe\\talents').length;

  // ── DEV-ONLY Topology Validation Report ──────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const buildTreeReport = (
      label: string,
      source: ExtractedNodeData[],
      normalized: TalentNode[],
      expectedTreeType: string,
    ) => {
      const withCanonical = source.filter((n) => n.canonicalRow != null && n.canonicalCol != null);
      const withoutCanonical = source.filter((n) => n.canonicalRow == null || n.canonicalCol == null);
      const withAnchors = source.filter((n) => n.anchorX != null && n.anchorY != null);
      const withoutAnchors = source.filter((n) => n.anchorX == null || n.anchorY == null);
      const visible = source.filter((n) => n.visible === true || n.visible === 1);
      const hidden = source.filter((n) => n.visible === false || n.visible === 0);
      const wrongTreeType = source.filter((n) => n.treeType && n.treeType !== expectedTreeType);

      // Unique row/col counts from canonical data
      const uniqueRows = new Set(withCanonical.map((n) => n.canonicalRow));
      const uniqueCols = new Set(withCanonical.map((n) => n.canonicalCol));

      // Duplicate cell detection
      const cellMap = new Map<string, string[]>();
      for (const n of withCanonical) {
        const key = `${n.canonicalRow},${n.canonicalCol}`;
        if (!cellMap.has(key)) cellMap.set(key, []);
        cellMap.get(key)!.push(n.name ?? n.id ?? 'unknown');
      }
      const duplicateCells = Array.from(cellMap.entries()).filter(([, names]) => names.length > 1);

      // Missing prerequisite targets
      const nodeIdSet = new Set(source.map((n) => n.id).filter(Boolean));
      let missingPrereqTargets = 0;
      for (const n of normalized) {
        for (const pid of n.prerequisites) {
          if (!nodeIdSet.has(pid)) missingPrereqTargets++;
        }
      }

      // Cross-tree connection count (from prereqsByTarget)
      let crossTreeConnections = 0;
      for (const n of source) {
        if (!n.id) continue;
        const prereqs = prereqsByTarget.get(n.id);
        if (!prereqs) continue;
        for (const pid of prereqs) {
          if (!nodeIdSet.has(pid)) crossTreeConnections++;
        }
      }

      return {
        label,
        sourceNodes: source.length,
        renderedNodes: normalized.length,
        visibleNodes: visible.length,
        hiddenNodes: hidden.length,
        withCanonicalCoords: withCanonical.length,
        withoutCanonicalCoords: withoutCanonical.length,
        withAnchors: withAnchors.length,
        withoutAnchors: withoutAnchors.length,
        uniqueRows: uniqueRows.size,
        uniqueCols: uniqueCols.size,
        duplicateCells: duplicateCells.map(([cell, names]) => `[${cell}]: ${names.join(', ')}`),
        missingPrereqTargets,
        crossTreeConnections,
        wrongTreeType: wrongTreeType.map((n) => `${n.name} (${n.id}) treeType="${n.treeType}"`),
      };
    };

    const classReport = buildTreeReport('Class Tree', classTreeSource, leftTree, 'class');
    const specReport = buildTreeReport('Spec Tree', specTreeSource, rightTree, 'spec');

    console.group(`[talents] ── Topology Validation: ${meta.name} ──`);
    console.info('Class tree (left):', classReport);
    console.info('Spec tree (right):', specReport);
    console.info('Sidebar:', { sourceNodes: sidebarSource.length, renderedNodes: sidebarTrack.length });
    console.info('Connections:', {
      totalExported: (extracted.connections ?? []).length,
      orphanedOrDropped: orphanConnectionCount,
      resolved: (extracted.connections ?? []).length - orphanConnectionCount,
    });
    console.info('Icons:', {
      missingCount: missingIconCount,
      totalRendered: renderedNodes.length,
    });

    // Flag critical issues
    if (classReport.withoutCanonicalCoords > 0) {
      console.warn(`[talents] ⚠ Class tree: ${classReport.withoutCanonicalCoords} nodes missing canonicalRow/canonicalCol`);
    }
    if (specReport.withoutCanonicalCoords > 0) {
      console.warn(`[talents] ⚠ Spec tree: ${specReport.withoutCanonicalCoords} nodes missing canonicalRow/canonicalCol`);
    }
    if (classReport.duplicateCells.length > 0) {
      console.warn(`[talents] ⚠ Class tree duplicate cells:`, classReport.duplicateCells);
    }
    if (specReport.duplicateCells.length > 0) {
      console.warn(`[talents] ⚠ Spec tree duplicate cells:`, specReport.duplicateCells);
    }
    if (classReport.wrongTreeType.length > 0) {
      console.warn(`[talents] ⚠ Class tree treeType mismatches:`, classReport.wrongTreeType);
    }
    if (specReport.wrongTreeType.length > 0) {
      console.warn(`[talents] ⚠ Spec tree treeType mismatches:`, specReport.wrongTreeType);
    }
    if (orphanConnectionCount > 0) {
      console.warn(`[talents] ⚠ ${orphanConnectionCount} orphan/cross-tree connections dropped`);
    }
    console.groupEnd();
  }

  return {
    class: meta.name,
    classId: meta.id,
    specId,
    specName,
    leftTreeName: `Path of ${meta.name}`,
    rightTreeName: `Path of ${specName}`,
    maxPoints: 61,
    color: meta.color,
    leftTree,
    rightTree,
    sidebarTrack,
  };
}
