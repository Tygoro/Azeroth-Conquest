import { useState, useCallback, useMemo } from 'react';
import type { TalentTree, TalentNode } from '@workspace/api-client-react';

export type BuildState = Record<string, number>;
/** Choice node id → selected option id (one of the 2 ChoiceOption.id values) */
export type ChoiceSelections = Record<string, string>;

// ─── TIER GATING ────────────────────────────────────────────────────────────
// Per Ascension CoA rules: 10 tiers (0–9), tier-4 (row 5 in 1-indexed UI)
// is the first gated row at 8 points. Gates count points spent in THAT tree.
export const TIER_Y_VALUES = [40, 110, 180, 250, 320, 390, 460, 530, 600, 670];
export const TIER_POINT_GATES = [0, 0, 0, 0, 8, 8, 20, 20, 30, 40];

function getTierIndex(y: number): number {
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
  const [choices, setChoices] = useState<ChoiceSelections>({});

  const maxPoints = treeData?.maxPoints ?? 61;

  const leftNodes = useMemo(() => treeData?.leftTree ?? [], [treeData]);
  const rightNodes = useMemo(() => treeData?.rightTree ?? [], [treeData]);
  const sidebarNodes = useMemo(() => treeData?.sidebarTrack ?? [], [treeData]);
  const allNodes = useMemo(() => [...leftNodes, ...rightNodes], [leftNodes, rightNodes]);

  const nodeSide = useMemo(() => {
    const m = new Map<string, 'left' | 'right'>();
    for (const n of leftNodes) m.set(n.id, 'left');
    for (const n of rightNodes) m.set(n.id, 'right');
    return m;
  }, [leftNodes, rightNodes]);

  // Per-side spent points (only counts nodes in current tree).
  const leftSpent = useMemo(
    () => leftNodes.reduce((s, n) => s + (points[n.id] ?? 0), 0),
    [leftNodes, points],
  );
  const rightSpent = useMemo(
    () => rightNodes.reduce((s, n) => s + (points[n.id] ?? 0), 0),
    [rightNodes, points],
  );
  // Sidebar nodes are AUTO-unlock — they don't cost points. So the sidebar
  // contributes 0 to totalPointsSpent.
  const treeSpent = leftSpent + rightSpent;
  const totalPointsSpent = treeSpent;
  const canAllocateMore = totalPointsSpent < maxPoints;

  // Determine node state with tier gating + AND-prereq logic
  const getNodeState = useCallback(
    (nodeId: string): NodeState => {
      // Sidebar node? Auto-unlock based on treeSpent. Not clickable.
      const sb = sidebarNodes.find(n => n.id === nodeId);
      if (sb) {
        if (treeSpent >= sb.unlockPointsRequired) {
          return { status: 'maxed', currentPoints: 1 };
        }
        return {
          status: 'locked',
          currentPoints: 0,
          lockReason: 'tier',
          tierGateRequired: sb.unlockPointsRequired,
          sideSpent: treeSpent,
        };
      }

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

      // Prereq check: ALL prereqs must have at least 1 point.
      const prereqsMet =
        node.prerequisites.length === 0 ||
        node.prerequisites.every(prereqId => (points[prereqId] ?? 0) > 0);

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
    [allNodes, sidebarNodes, nodeSide, points, leftSpent, rightSpent, treeSpent],
  );

  /** Get the currently-selected choice option for a choice node (if any). */
  const getChoiceSelection = useCallback(
    (nodeId: string): string | undefined => choices[nodeId],
    [choices],
  );

  const addPoint = useCallback(
    (nodeId: string) => {
      if (!treeData) return;
      // Sidebar nodes are not interactive
      if (sidebarNodes.some(n => n.id === nodeId)) return;

      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return;
      const state = getNodeState(nodeId);

      // Choice node: if already selected, cycle to other option (no point change).
      if (node.type === 'choice' && node.options && node.options.length === 2) {
        if (state.currentPoints >= 1) {
          const cur = choices[nodeId];
          const next = cur === node.options[0].id ? node.options[1].id : node.options[0].id;
          setChoices(prev => ({ ...prev, [nodeId]: next }));
          return;
        }
        // Not yet selected — must be available + budget OK
        if (state.status === 'locked' || !canAllocateMore) return;
        setPoints(prev => ({ ...prev, [nodeId]: 1 }));
        setChoices(prev => ({ ...prev, [nodeId]: node.options![0].id }));
        return;
      }

      // Normal node
      if (state.status === 'locked' || state.status === 'maxed' || !canAllocateMore) return;
      setPoints(prev => ({ ...prev, [nodeId]: (prev[nodeId] ?? 0) + 1 }));
    },
    [treeData, allNodes, sidebarNodes, getNodeState, canAllocateMore, choices],
  );

  const canRemovePoint = useCallback(
    (nodeId: string): boolean => {
      // Sidebar nodes auto-unlock; nothing to refund.
      if (sidebarNodes.some(n => n.id === nodeId)) return false;

      const currentPoints = points[nodeId] ?? 0;
      if (currentPoints === 0) return false;

      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return false;

      const side = nodeSide.get(nodeId) ?? 'left';
      const sideSpent = side === 'left' ? leftSpent : rightSpent;
      const newSideSpent = sideSpent - 1;
      const willUnsatisfy = currentPoints === 1; // dropping to 0 → un-satisfies prereq for dependents

      // AND-prereq cascade: removing the last point orphans any direct
      // dependent that has points allocated (since ALL prereqs are required).
      if (willUnsatisfy) {
        const orphaned = allNodes.some(dep => {
          if (!dep.prerequisites.includes(nodeId)) return false;
          return (points[dep.id] ?? 0) > 0;
        });
        if (orphaned) return false;
      }

      // Tier-gate cascade: removal must not drop allocated higher-tier nodes
      // below their gate.
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
    [allNodes, sidebarNodes, nodeSide, points, leftSpent, rightSpent, leftNodes, rightNodes],
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
      // If this was a choice node and it's now empty, clear the selection too.
      const node = allNodes.find(n => n.id === nodeId);
      if (node?.type === 'choice' && (points[nodeId] ?? 0) <= 1) {
        setChoices(prev => {
          const next = { ...prev };
          delete next[nodeId];
          return next;
        });
      }
    },
    [treeData, canRemovePoint, allNodes, points],
  );

  const reset = useCallback(() => {
    setPoints({});
    setChoices({});
  }, []);

  const serializeBuild = useCallback((): string => {
    if (!treeData) return '';
    return btoa(
      JSON.stringify({
        classId: treeData.classId,
        specId: treeData.specId ?? null,
        points,
        choices,
      }),
    );
  }, [treeData, points, choices]);

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
        if (decoded?.choices && typeof decoded.choices === 'object') {
          const safe: ChoiceSelections = {};
          for (const [k, v] of Object.entries(decoded.choices)) {
            if (typeof k === 'string' && typeof v === 'string' && v.length < 200) {
              safe[k] = v;
            }
          }
          setChoices(safe);
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
    choices,
    setChoices,
    totalPointsSpent,
    treeSpent,
    leftSpent,
    rightSpent,
    maxPoints,
    canAllocateMore,
    getNodeState,
    getChoiceSelection,
    addPoint,
    removePoint,
    reset,
    serializeBuild,
    loadBuild,
  };
}
