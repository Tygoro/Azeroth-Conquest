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
  x?: number;
  y?: number;
  gridRow?: number;
  gridColumn?: number;
  visible?: boolean;
  shown?: boolean;
  locked?: boolean;
  prerequisites?: string[];
};

type ExtractedConnectionData = {
  id?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
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

function nodeTypeFromExtracted(node: ExtractedNodeData, maxY: number): TalentNode['type'] {
  if (node.nodeShape === 'octagon' || node.nodeType === 'choice') return 'choice';
  if (node.nodeShape === 'circle' || node.nodeType === 'passive') return 'passive';
  if (node.nodeShape === 'square' || node.nodeType === 'active') return 'active';
  if ((node.y ?? 0) >= maxY) return 'capstone';
  if (node.description?.toLowerCase().includes('passive')) return 'passive';
  return 'active';
}

type TreeSide = 'left' | 'right';

type LatticeSlot = {
  row: number;
  column: number;
  type: TalentNode['type'];
};

const LATTICE_X = [48, 124, 200, 276, 352];
const LATTICE_Y = [40, 110, 180, 250, 320, 390, 460, 530, 600, 670];

const CLASS_LATTICE: LatticeSlot[] = [
  { row: 0, column: 1, type: 'active' },
  { row: 0, column: 3, type: 'active' },
  { row: 1, column: 0, type: 'passive' },
  { row: 1, column: 2, type: 'passive' },
  { row: 1, column: 4, type: 'passive' },
  { row: 2, column: 0, type: 'active' },
  { row: 2, column: 2, type: 'passive' },
  { row: 2, column: 4, type: 'passive' },
  { row: 3, column: 1, type: 'passive' },
  { row: 3, column: 2, type: 'passive' },
  { row: 3, column: 3, type: 'active' },
  { row: 4, column: 0, type: 'passive' },
  { row: 4, column: 1, type: 'passive' },
  { row: 4, column: 3, type: 'passive' },
  { row: 4, column: 4, type: 'passive' },
  { row: 5, column: 0, type: 'active' },
  { row: 5, column: 2, type: 'passive' },
  { row: 5, column: 4, type: 'active' },
  { row: 6, column: 1, type: 'passive' },
  { row: 6, column: 3, type: 'passive' },
  { row: 7, column: 0, type: 'passive' },
  { row: 7, column: 2, type: 'active' },
  { row: 7, column: 4, type: 'passive' },
  { row: 8, column: 1, type: 'passive' },
  { row: 8, column: 3, type: 'passive' },
  { row: 9, column: 2, type: 'active' },
];

const SPEC_LATTICE: LatticeSlot[] = [
  { row: 0, column: 1, type: 'active' },
  { row: 0, column: 3, type: 'active' },
  { row: 1, column: 0, type: 'passive' },
  { row: 1, column: 2, type: 'passive' },
  { row: 1, column: 4, type: 'passive' },
  { row: 2, column: 0, type: 'active' },
  { row: 2, column: 1, type: 'passive' },
  { row: 2, column: 3, type: 'passive' },
  { row: 2, column: 4, type: 'active' },
  { row: 3, column: 0, type: 'passive' },
  { row: 3, column: 2, type: 'passive' },
  { row: 3, column: 4, type: 'passive' },
  { row: 4, column: 1, type: 'choice' },
  { row: 4, column: 2, type: 'passive' },
  { row: 4, column: 3, type: 'choice' },
  { row: 5, column: 0, type: 'passive' },
  { row: 5, column: 1, type: 'passive' },
  { row: 5, column: 3, type: 'active' },
  { row: 5, column: 4, type: 'passive' },
  { row: 6, column: 1, type: 'passive' },
  { row: 6, column: 2, type: 'active' },
  { row: 6, column: 3, type: 'passive' },
  { row: 7, column: 0, type: 'passive' },
  { row: 7, column: 2, type: 'active' },
  { row: 7, column: 4, type: 'passive' },
  { row: 8, column: 1, type: 'passive' },
  { row: 8, column: 3, type: 'passive' },
  { row: 9, column: 2, type: 'active' },
];

function assignLatticeSlots(nodes: ExtractedNodeData[], side: TreeSide): ExtractedNodeData[] {
  const lattice = side === 'left' ? CLASS_LATTICE : SPEC_LATTICE;
  const sortedNodes = [...nodes].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
  if (side === 'right' && !sortedNodes.some((node) => node.nodeType === 'choice' || node.nodeShape === 'octagon')) {
    sortedNodes.splice(12, 0, {
      id: 'tinker_right_choice_placeholder_1',
      name: 'Unresolved Choice Talent',
      description: 'Placeholder socket for an unresolved CoA choice talent node.',
      rank: 'Rank 0/1',
      nodeShape: 'octagon',
      nodeType: 'choice',
      prerequisites: [],
    });
    sortedNodes.splice(14, 0, {
      id: 'tinker_right_choice_placeholder_2',
      name: 'Unresolved Choice Talent',
      description: 'Placeholder socket for an unresolved CoA choice talent node.',
      rank: 'Rank 0/1',
      nodeShape: 'octagon',
      nodeType: 'choice',
      prerequisites: [],
    });
  }
  const assigned = sortedNodes.map((node, index) => {
    const slot = lattice[index] ?? lattice[lattice.length - 1];
    return {
      ...node,
      x: LATTICE_X[slot.column],
      y: LATTICE_Y[slot.row],
      gridRow: slot.row + 1,
      gridColumn: slot.column + 1,
      nodeType: node.nodeType ?? (slot.type === 'choice' ? 'choice' : slot.type === 'passive' ? 'passive' : 'active'),
    };
  });

  for (let index = assigned.length; index < lattice.length; index++) {
    const slot = lattice[index];
    assigned.push({
      id: `tinker_${side}_placeholder_${index + 1}`,
      name: 'Unresolved Talent',
      description: 'Placeholder socket for an unresolved CoA talent node.',
      rank: 'Rank 0/1',
      nodeShape: slot.type === 'choice' ? 'octagon' : slot.type === 'passive' ? 'circle' : 'square',
      nodeType: slot.type === 'choice' ? 'choice' : slot.type === 'passive' ? 'passive' : 'active',
      x: LATTICE_X[slot.column],
      y: LATTICE_Y[slot.row],
      gridRow: slot.row + 1,
      gridColumn: slot.column + 1,
      prerequisites: [],
    });
  }

  return assigned;
}

function latticePrerequisiteIds(latticeNodes: ExtractedNodeData[], side: TreeSide, index: number): string[] {
  const lattice = side === 'left' ? CLASS_LATTICE : SPEC_LATTICE;
  const slot = lattice[index];
  if (!slot || slot.row === 0) return [];
  const previousRowSlots = lattice
    .map((previousSlot, previousIndex) => ({ previousSlot, previousIndex }))
    .filter(({ previousSlot, previousIndex }) =>
      previousIndex < index &&
      previousSlot.row === slot.row - 1 &&
      Math.abs(previousSlot.column - slot.column) <= 1,
    );
  const nearestSlots = previousRowSlots.length
    ? previousRowSlots
    : lattice
      .map((previousSlot, previousIndex) => ({ previousSlot, previousIndex }))
      .filter(({ previousSlot, previousIndex }) => previousIndex < index && previousSlot.row < slot.row)
      .sort((a, b) =>
        Math.abs(a.previousSlot.row - slot.row) - Math.abs(b.previousSlot.row - slot.row) ||
        Math.abs(a.previousSlot.column - slot.column) - Math.abs(b.previousSlot.column - slot.column),
      )
      .slice(0, 1);
  return nearestSlots
    .map(({ previousIndex }) => latticeNodes[previousIndex]?.id)
    .filter((id): id is string => Boolean(id));
}

function normalizeExtractedNodes(nodes: ExtractedNodeData[], prereqsByTarget: Map<string, Set<string>>, side: TreeSide): TalentNode[] {
  const latticeNodes = assignLatticeSlots(nodes, side);
  const nodeIds = new Set(latticeNodes.map((node) => node.id).filter(Boolean));
  const maxY = Math.max(...latticeNodes.map((node) => node.y ?? 0), 0);

  return latticeNodes
    .filter((node): node is ExtractedNodeData & { id: string; name: string; description: string; x: number; y: number } =>
      Boolean(node.id && node.name && node.description && typeof node.x === 'number' && typeof node.y === 'number'),
    )
    .map<TalentNode>((node, index) => {
      const mergedPrereqs = new Set<string>(latticePrerequisiteIds(latticeNodes, side, index));
      for (const prereq of prereqsByTarget.get(node.id) ?? []) {
        if (!mergedPrereqs.size) mergedPrereqs.add(prereq);
      }
      for (const prereq of Array.from(mergedPrereqs)) {
        if (!nodeIds.has(prereq)) mergedPrereqs.delete(prereq);
      }

      return {
        id: node.id,
        name: node.name,
        description: node.description,
        maxPoints: maxPointsFromRank(node.rank),
        currentPoints: 0,
        prerequisites: Array.from(mergedPrereqs),
        position: {
          x: node.x,
          y: node.y,
          gridRow: node.gridRow,
          gridColumn: node.gridColumn,
        },
        icon: node.icon,
        type: nodeTypeFromExtracted(node, maxY),
      };
    });
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
  let orphanConnectionCount = 0;
  const prereqsByTarget = new Map<string, Set<string>>();

  for (const connection of extracted.connections ?? []) {
    if (!connection.sourceNodeId || !connection.targetNodeId) {
      orphanConnectionCount++;
      continue;
    }
    if (!nodeIds.has(connection.sourceNodeId) || !nodeIds.has(connection.targetNodeId)) {
      orphanConnectionCount++;
      continue;
    }
    if (connection.sourceNodeId === connection.targetNodeId) {
      orphanConnectionCount++;
      continue;
    }
    if (nodeRegion.get(connection.sourceNodeId) !== nodeRegion.get(connection.targetNodeId)) {
      orphanConnectionCount++;
      continue;
    }
    if (!prereqsByTarget.has(connection.targetNodeId)) {
      prereqsByTarget.set(connection.targetNodeId, new Set());
    }
    prereqsByTarget.get(connection.targetNodeId)?.add(connection.sourceNodeId);
  }

  const leftTree = normalizeExtractedNodes(classTreeSource, prereqsByTarget, 'left');
  const rightTree = normalizeExtractedNodes(specTreeSource, prereqsByTarget, 'right');
  const sidebarTrack = normalizeExtractedSidebar(sidebarSource);
  const renderedNodes = [...leftTree, ...rightTree];
  const missingIconCount = renderedNodes.filter((node) => !node.icon || node.icon.toLowerCase() === 'interface\\talentframe\\talents').length;

  console.info('[talents] extracted Tinker tree', {
    nodeRenderCount: renderedNodes.length,
    classTreeCount: leftTree.length,
    specTreeCount: rightTree.length,
    sidebarTrackCount: sidebarTrack.length,
    missingIconCount,
    orphanConnectionCount,
  });

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
