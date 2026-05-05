import { useState, useCallback, useMemo } from 'react';
import type { TalentTree, TalentNode } from '@workspace/api-client-react';

export type BuildState = Record<string, number>;

interface UseTalentTreeProps {
  treeData: TalentTree | undefined;
}

// Get all nodes from both trees combined
function getAllNodes(treeData: TalentTree | undefined): TalentNode[] {
  if (!treeData) return [];
  return [...(treeData.leftTree ?? []), ...(treeData.rightTree ?? [])];
}

export function useTalentTree({ treeData }: UseTalentTreeProps) {
  const [points, setPoints] = useState<BuildState>({});

  const maxPoints = treeData?.maxPoints ?? 61;
  const allNodes = useMemo(() => getAllNodes(treeData), [treeData]);

  // Only count points for nodes that exist in the *current* tree.
  // Prevents stale/imported points (from a different spec) from silently
  // eating into the 61-point budget.
  const totalPointsSpent = useMemo(() => {
    if (!allNodes.length) return 0;
    let sum = 0;
    for (const n of allNodes) {
      sum += points[n.id] ?? 0;
    }
    return sum;
  }, [allNodes, points]);

  const canAllocateMore = totalPointsSpent < maxPoints;

  // Determine the visual/interactive state of a node
  const getNodeState = useCallback(
    (nodeId: string): { status: 'locked' | 'available' | 'active' | 'maxed'; currentPoints: number } => {
      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return { status: 'locked', currentPoints: 0 };

      const currentPoints = points[nodeId] ?? 0;
      const isMaxed = currentPoints >= node.maxPoints;

      const prereqsMet = node.prerequisites.every(prereqId => {
        const prereq = allNodes.find(n => n.id === prereqId);
        if (!prereq) return true;
        return (points[prereqId] ?? 0) >= prereq.maxPoints;
      });

      if (!prereqsMet) return { status: 'locked', currentPoints };
      if (isMaxed) return { status: 'maxed', currentPoints };
      if (currentPoints > 0) return { status: 'active', currentPoints };
      return { status: 'available', currentPoints };
    },
    [allNodes, points]
  );

  const addPoint = useCallback(
    (nodeId: string) => {
      if (!treeData) return;
      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return;
      const { status, currentPoints } = getNodeState(nodeId);
      if (status === 'locked' || status === 'maxed' || !canAllocateMore) return;
      setPoints(prev => ({ ...prev, [nodeId]: currentPoints + 1 }));
    },
    [treeData, allNodes, getNodeState, canAllocateMore]
  );

  const canRemovePoint = useCallback(
    (nodeId: string): boolean => {
      const currentPoints = points[nodeId] ?? 0;
      if (currentPoints === 0) return false;

      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return false;

      // If removing would un-max this node, check if any dependents rely on it being maxed
      const wouldBeUnMaxed = currentPoints === node.maxPoints;
      if (wouldBeUnMaxed) {
        const hasDependentsAllocated = allNodes
          .filter(n => n.prerequisites.includes(nodeId))
          .some(dep => (points[dep.id] ?? 0) > 0);
        if (hasDependentsAllocated) return false;
      }
      return true;
    },
    [allNodes, points]
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
    [treeData, canRemovePoint]
  );

  const reset = useCallback(() => setPoints({}), []);

  // Serialize includes specId so the build link can restore both class and spec
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
        // Sanitize: ensure points is a string→number map with safe values.
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
