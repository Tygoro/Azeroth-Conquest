import { useState, useCallback, useMemo, useEffect } from 'react';
import type { TalentTree, TalentNode } from '@workspace/api-client-react';

export type BuildState = Record<string, number>;

interface UseTalentTreeProps {
  treeData: TalentTree | undefined;
  initialBuildState?: BuildState;
}

export function useTalentTree({ treeData, initialBuildState = {} }: UseTalentTreeProps) {
  const [points, setPoints] = useState<BuildState>(initialBuildState);

  useEffect(() => {
    if (Object.keys(initialBuildState).length > 0) {
      setPoints(initialBuildState);
    }
  }, [initialBuildState]);

  const maxPoints = treeData?.maxPoints || 61;

  const totalPointsSpent = useMemo(() => {
    return Object.values(points).reduce((sum, current) => sum + current, 0);
  }, [points]);

  const canAllocateMore = totalPointsSpent < maxPoints;

  const getNodeState = useCallback((nodeId: string, tree: TalentTree) => {
    const node = tree.nodes.find(n => n.id === nodeId);
    if (!node) return { status: 'locked', currentPoints: 0 };

    const currentPoints = points[nodeId] || 0;
    const isMaxed = currentPoints === node.maxPoints;

    // Check prerequisites
    const prereqsMet = node.prerequisites.every(prereqId => {
      const prereqNode = tree.nodes.find(n => n.id === prereqId);
      if (!prereqNode) return true;
      return (points[prereqId] || 0) === prereqNode.maxPoints;
    });

    if (!prereqsMet) {
      return { status: 'locked', currentPoints };
    }

    if (currentPoints > 0) {
      return { status: isMaxed ? 'maxed' : 'active', currentPoints };
    }

    return { status: 'available', currentPoints };
  }, [points]);

  const addPoint = useCallback((nodeId: string) => {
    if (!treeData) return;
    const node = treeData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const { status, currentPoints } = getNodeState(nodeId, treeData);
    
    if (status === 'locked' || status === 'maxed' || !canAllocateMore) {
      return;
    }

    setPoints(prev => ({
      ...prev,
      [nodeId]: currentPoints + 1
    }));
  }, [treeData, getNodeState, canAllocateMore]);

  const canRemovePoint = useCallback((nodeId: string, tree: TalentTree) => {
    const currentPoints = points[nodeId] || 0;
    if (currentPoints === 0) return false;

    // Check if removing a point would break any dependent nodes
    // A dependent node is any node that has THIS node as a prerequisite
    const dependentNodes = tree.nodes.filter(n => n.prerequisites.includes(nodeId));
    
    const hasActiveDependents = dependentNodes.some(dep => (points[dep.id] || 0) > 0);
    
    // If it's maxed and has active dependents, we can't remove a point
    // because prerequisites require the node to be maxed.
    if (currentPoints === tree.nodes.find(n => n.id === nodeId)?.maxPoints && hasActiveDependents) {
      return false;
    }

    return true;
  }, [points]);

  const removePoint = useCallback((nodeId: string) => {
    if (!treeData) return;
    
    if (!canRemovePoint(nodeId, treeData)) return;

    setPoints(prev => {
      const currentPoints = prev[nodeId] || 0;
      if (currentPoints <= 1) {
        const newPoints = { ...prev };
        delete newPoints[nodeId];
        return newPoints;
      }
      return {
        ...prev,
        [nodeId]: currentPoints - 1
      };
    });
  }, [treeData, canRemovePoint]);

  const reset = useCallback(() => {
    setPoints({});
  }, []);

  const serializeBuild = useCallback(() => {
    if (!treeData) return '';
    const buildData = {
      classId: treeData.classId,
      points
    };
    return btoa(JSON.stringify(buildData));
  }, [treeData, points]);

  return {
    points,
    totalPointsSpent,
    maxPoints,
    canAllocateMore,
    getNodeState,
    addPoint,
    removePoint,
    reset,
    serializeBuild,
    setPoints
  };
}
