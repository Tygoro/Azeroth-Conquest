import { useState, useCallback, useMemo } from 'react';
import type { TalentTree, TalentNode } from '@workspace/api-client-react';

export type BuildState = Record<string, number>;

// ─── TIER GATING ────────────────────────────────────────────────────────────
// Mirror of the server-side row Y values. Each tree has 8 tiers gated
// by the number of points spent **in that tree**. Gates unlock progression
// down the tree the same way Dragonflight does.
const TIER_Y_VALUES = [40, 110, 180, 250, 320, 390, 460, 540];
export const TIER_POINT_GATES = [0, 0, 3, 8, 14, 20, 28, 35];

function getTierIndex(y: number): number {
  // Snap to nearest tier (tolerate small float deltas)
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < TIER_Y_VALUES.length; i++) {
    const d = Math.abs(TIER_Y_VALUES[i] - y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export interface NodeState {
  status: 'locked' | 'available' | 'active' | 'maxed';
  currentPoints: number;
  /** Why a node is locked (only set when status === 'locked') */
  lockReason?: 'prereq' | 'tier' | 'budget';
  /** When lockReason === 'tier', the # of points required in this tree */
  tierGateRequired?: number;
  /** Current # of points spent in the same tree as this node */
  sideSpent?: number;
}

interface UseTalentTreeProps {
  treeData: TalentTree | undefined;
}

export function useTalentTree({ treeData }: UseTalentTreeProps) {
  const [points, setPoints] = useState<BuildState>({});

  const maxPoints = treeData?.maxPoints ?? 61;

  const leftNodes = useMemo(() => treeData?.leftTree ?? [], [treeData]);
  const rightNodes = useMemo(() => treeData?.rightTree ?? [], [treeData]);
  const allNodes = useMemo(() => [...leftNodes, ...rightNodes], [leftNodes, rightNodes]);

  // Each node ID is namespaced like `${classId}_${specId}_l_${n}` or `_r_${n}`.
  // Map node ID → side ('left' | 'right').
  const nodeSide = useMemo(() => {
    const m = new Map<string, 'left' | 'right'>();
    for (const n of leftNodes) m.set(n.id, 'left');
    for (const n of rightNodes) m.set(n.id, 'right');
    return m;
  }, [leftNodes, rightNodes]);

  // Per-side spent points (only counts nodes in current tree — sanitizes
  // any stale points from a different spec).
  const leftSpent = useMemo(
    () => leftNodes.reduce((s, n) => s + (points[n.id] ?? 0), 0),
    [leftNodes, points],
  );
  const rightSpent = useMemo(
    () => rightNodes.reduce((s, n) => s + (points[n.id] ?? 0), 0),
    [rightNodes, points],
  );
  const totalPointsSpent = leftSpent + rightSpent;
  const canAllocateMore = totalPointsSpent < maxPoints;

  // Determine node state with tier gating + OR-prereq logic
  const getNodeState = useCallback(
    (nodeId: string): NodeState => {
      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return { status: 'locked', currentPoints: 0 };

      const currentPoints = points[nodeId] ?? 0;
      const isMaxed = currentPoints >= node.maxPoints;
      const side = nodeSide.get(nodeId) ?? 'left';
      const sideSpent = side === 'left' ? leftSpent : rightSpent;

      // Tier gate check
      const tierIdx = getTierIndex(node.position.y);
      const tierGate = TIER_POINT_GATES[tierIdx] ?? 0;
      const tierGateMet = sideSpent >= tierGate;

      // Prereq check: ANY prereq maxed (Dragonflight-style branching).
      // Roots (no prereqs) always satisfy.
      const prereqsMet =
        node.prerequisites.length === 0 ||
        node.prerequisites.some(prereqId => {
          const prereq = allNodes.find(n => n.id === prereqId);
          if (!prereq) return false;
          return (points[prereqId] ?? 0) >= prereq.maxPoints;
        });

      // If already allocated, never lock — it's always interactable for refund
      if (isMaxed) return { status: 'maxed', currentPoints, sideSpent };
      if (currentPoints > 0) return { status: 'active', currentPoints, sideSpent };

      if (!tierGateMet) {
        return {
          status: 'locked',
          currentPoints,
          lockReason: 'tier',
          tierGateRequired: tierGate,
          sideSpent,
        };
      }
      if (!prereqsMet) {
        return { status: 'locked', currentPoints, lockReason: 'prereq', sideSpent };
      }
      return { status: 'available', currentPoints, sideSpent };
    },
    [allNodes, nodeSide, points, leftSpent, rightSpent],
  );

  const addPoint = useCallback(
    (nodeId: string) => {
      if (!treeData) return;
      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return;
      const state = getNodeState(nodeId);
      if (state.status === 'locked' || state.status === 'maxed' || !canAllocateMore) return;
      setPoints(prev => ({ ...prev, [nodeId]: (prev[nodeId] ?? 0) + 1 }));
    },
    [treeData, allNodes, getNodeState, canAllocateMore],
  );

  const canRemovePoint = useCallback(
    (nodeId: string): boolean => {
      const currentPoints = points[nodeId] ?? 0;
      if (currentPoints === 0) return false;

      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return false;

      const side = nodeSide.get(nodeId) ?? 'left';
      const sideSpent = side === 'left' ? leftSpent : rightSpent;
      const newSideSpent = sideSpent - 1;
      const wouldBeUnMaxed = currentPoints === node.maxPoints;

      // Sibling-OR prereq check: a dependent stays unlocked if it has at
      // least one OTHER maxed prereq besides this one.
      if (wouldBeUnMaxed) {
        const blocked = allNodes.some(dep => {
          if (!dep.prerequisites.includes(nodeId)) return false;
          if ((points[dep.id] ?? 0) === 0) return false; // dep not allocated → safe
          // Does dep have another maxed prereq besides nodeId?
          const otherMaxed = dep.prerequisites.some(pid => {
            if (pid === nodeId) return false;
            const p = allNodes.find(n => n.id === pid);
            return p ? (points[pid] ?? 0) >= p.maxPoints : false;
          });
          return !otherMaxed;
        });
        if (blocked) return false;
      }

      // Tier-gate cascade check: removing this point must not cause any
      // currently-allocated node on the same side to fall below its tier
      // gate. We check ALL allocated nodes (including the one being
      // decremented, if it remains > 0 points after the removal).
      const sameSideNodes = side === 'left' ? leftNodes : rightNodes;
      const cascadeBlocked = sameSideNodes.some(other => {
        const ptsBefore = points[other.id] ?? 0;
        const ptsAfter = other.id === nodeId ? ptsBefore - 1 : ptsBefore;
        if (ptsAfter <= 0) return false;
        const otherTier = getTierIndex(other.position.y);
        const otherGate = TIER_POINT_GATES[otherTier] ?? 0;
        return newSideSpent < otherGate;
      });
      if (cascadeBlocked) return false;

      return true;
    },
    [allNodes, nodeSide, points, leftSpent, rightSpent, leftNodes, rightNodes],
  );

  const removePoint = useCallback(
    (nodeId: string) => {
      if (!treeData || !canRemovePoint(nodeId)) return;
      setPoints(prev => {
        const cur = prev[nodeId] ?? 0;
        if (cur <= 1) {
          const next = { ...prev };
          delete next[nodeId];
          return next;
        }
        return { ...prev, [nodeId]: cur - 1 };
      });
    },
    [treeData, canRemovePoint],
  );

  const reset = useCallback(() => setPoints({}), []);

  const serializeBuild = useCallback((): string => {
    if (!treeData) return '';
    return btoa(
      JSON.stringify({
        classId: treeData.classId,
        specId: treeData.specId ?? null,
        points,
      }),
    );
  }, [treeData, points]);

  const loadBuild = useCallback(
    (encoded: string): { classId?: string; specId?: string } | undefined => {
      try {
        const decoded = JSON.parse(atob(encoded));
        if (decoded?.points && typeof decoded.points === 'object') {
          const safe: BuildState = {};
          for (const [k, v] of Object.entries(decoded.points)) {
            if (typeof k === 'string' && typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 99) {
              safe[k] = Math.floor(v);
            }
          }
          setPoints(safe);
        }
        return {
          classId: typeof decoded?.classId === 'string' ? decoded.classId : undefined,
          specId: typeof decoded?.specId === 'string' ? decoded.specId : undefined,
        };
      } catch {
        return undefined;
      }
    },
    [],
  );

  return {
    points,
    setPoints,
    totalPointsSpent,
    leftSpent,
    rightSpent,
    maxPoints,
    canAllocateMore,
    getNodeState,
    addPoint,
    removePoint,
    reset,
    serializeBuild,
    loadBuild,
  };
}
