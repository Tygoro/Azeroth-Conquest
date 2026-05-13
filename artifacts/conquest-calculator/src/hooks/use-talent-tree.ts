import { useState, useCallback, useMemo } from 'react';
import type { TalentTree, TalentNode } from '@workspace/api-client-react';

export type BuildState = Record<string, number>;
/** Choice node id → selected option id (one of the 2 ChoiceOption.id values) */
export type ChoiceSelections = Record<string, string>;

// ─── OFFICIAL ROW LEVEL REQUIREMENTS ─────────────────────────────────────────
// Rows are gated by CHARACTER LEVEL, not points spent.
// Keyed by 1-based row index.
//
// TIER_Y_VALUES is kept for pixel-layout positioning only, not for gating.
export const TIER_Y_VALUES = [40, 110, 180, 250, 320, 390, 460, 530, 600, 670];

/** Minimum character level required to access each row of the CLASS tree. */
export const CLASS_TREE_ROW_LEVELS: Record<number, number> = {
   1: 10,  2: 12,  3: 14,  4: 16,
   5: 26,  6: 28,  7: 30,  8: 32,
   9: 58, 10: 60,
};

/** Minimum character level required to access each row of the SPEC tree. */
export const SPEC_TREE_ROW_LEVELS: Record<number, number> = {
   1: 11,  2: 13,  3: 15,  4: 17,
   5: 27,  6: 29,  7: 31,  8: 33,
   9: 57, 10: 59,
};

/**
 * Return the minimum character level required to access a given tree row.
 * Falls back to 1 (always accessible) for any row not in the table.
 */
export function getRowLevelReq(rowIndex1Based: number, side: 'class' | 'spec'): number {
  const table = side === 'class' ? CLASS_TREE_ROW_LEVELS : SPEC_TREE_ROW_LEVELS;
  return table[rowIndex1Based] ?? 1;
}

/** Available talent points for a given character level. WoW-style: level - 9. */
export function getAvailablePoints(level: number): number {
  return Math.max(0, level - 9);
}

// ─── AE / TE HARD CAPS ─────────────────────────────────────────────────────
// Official Conquest of Azeroth caps — enforced per-side independent of level.
export const AE_CAP = 26;  // Ability Essence: class tree hard cap
export const TE_CAP = 25;  // Talent Essence:  spec tree hard cap

// Conquest of Azeroth level system — clamped to the in-game range. Level 10 is
// the earliest a character can spend points (1 point); level 60 is the cap and
// yields 60 - 9 = 51 spendable points (the official Ascension max).
export const MIN_LEVEL = 10;
export const MAX_LEVEL = 60;
export const DEFAULT_LEVEL = MAX_LEVEL;

/** Clamp a level value into the legal in-game range [MIN_LEVEL, MAX_LEVEL]. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return DEFAULT_LEVEL;
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.floor(level)));
}

/** Resolve 0-indexed tier for a node. Uses gridRow (canonical) when present;
 *  falls back to nearest-Y matching for generated trees that lack gridRow. */
function getTierIndex(node: TalentNode): number {
  const pos = node.position as { x: number; y: number; gridRow?: number };
  if (pos.gridRow && pos.gridRow >= 1) {
    return Math.min(pos.gridRow - 1, TIER_Y_VALUES.length - 1);
  }
  // Fallback for generated (non-extracted) trees without gridRow.
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < TIER_Y_VALUES.length; i++) {
    const d = Math.abs(TIER_Y_VALUES[i] - node.position.y);
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
  lockReason?: 'prereq' | 'level' | 'points' | 'budget';
  /** When lockReason === 'level', the character level required for this node or row */
  levelRequired?: number;
  /** When lockReason === 'points', the AE/TE points-spent threshold required */
  pointsRequired?: number;
  /** Current # of points spent in the same tree as this node */
  sideSpent?: number;
}

interface UseTalentTreeProps {
  treeData: TalentTree | undefined;
  /** Character level. Defaults to 60 (= 51 available points, Ascension max). */
  level?: number;
}

export function useTalentTree({ treeData, level = DEFAULT_LEVEL }: UseTalentTreeProps) {
  const [points, setPoints] = useState<BuildState>({});
  const [choices, setChoices] = useState<ChoiceSelections>({});

  // Available points are derived from the level (level - 9), capped by what
  // the tree itself can hold (defensive — currently always >= 61).
  const availablePoints = getAvailablePoints(level);
  const treeMaxPoints = treeData?.maxPoints ?? 61;
  const maxPoints = Math.min(availablePoints, treeMaxPoints);

  const leftNodes = useMemo(() => treeData?.leftTree ?? [], [treeData]);
  const rightNodes = useMemo(() => treeData?.rightTree ?? [], [treeData]);
  const sidebarNodes = useMemo(() => treeData?.sidebarTrack ?? [], [treeData]);
  const allNodes = useMemo(() => [...leftNodes, ...rightNodes], [leftNodes, rightNodes]);

  // Dev guard: deep-freeze tree arrays + nodes to catch accidental mutation.
  // Server already freezes the class (left) tree; this freezes the spec side
  // and the combined response wrapper as a defense-in-depth measure.
  if (import.meta.env.DEV && treeData) {
    if (!Object.isFrozen(leftNodes)) {
      Object.freeze(leftNodes);
      for (const n of leftNodes) Object.freeze(n);
    }
    if (!Object.isFrozen(rightNodes)) {
      Object.freeze(rightNodes);
      for (const n of rightNodes) Object.freeze(n);
    }
    if (!Object.isFrozen(sidebarNodes)) {
      Object.freeze(sidebarNodes);
      for (const n of sidebarNodes) Object.freeze(n);
    }
  }

  const nodeSide = useMemo(() => {
    const m = new Map<string, 'left' | 'right'>();
    for (const n of leftNodes) m.set(n.id, 'left');
    for (const n of rightNodes) m.set(n.id, 'right');
    return m;
  }, [leftNodes, rightNodes]);

  // Per-side spent points — autoGranted nodes never count toward the total.
  const leftSpent = useMemo(
    () => leftNodes.reduce((s, n) => n.autoGranted ? s : s + (points[n.id] ?? 0), 0),
    [leftNodes, points],
  );
  const rightSpent = useMemo(
    () => rightNodes.reduce((s, n) => n.autoGranted ? s : s + (points[n.id] ?? 0), 0),
    [rightNodes, points],
  );
  // Sidebar nodes are level-based auto rewards and do not cost tree points.
  const treeSpent = leftSpent + rightSpent;
  const totalPointsSpent = treeSpent;
  const canAllocateMore = totalPointsSpent < maxPoints;

  // Determine node state with tier gating + AND-prereq logic
  const getNodeState = useCallback(
    (nodeId: string): NodeState => {
      // Sidebar node? Auto-unlock based on character level. Not clickable.
      const sb = sidebarNodes.find(n => n.id === nodeId);
      if (sb) {
        if (level >= sb.unlockPointsRequired) {
          return { status: 'maxed', currentPoints: 1 };
        }
        return {
          status: 'locked',
          currentPoints: 0,
          lockReason: 'level',
          levelRequired: sb.unlockPointsRequired,
          sideSpent: level,
        };
      }

      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return { status: 'locked', currentPoints: 0 };

      // autoGranted nodes unlock at a character level threshold (unlockAt field).
      if (node.autoGranted) {
        if (node.unlockAt !== undefined && level < node.unlockAt) {
          return {
            status: 'locked',
            currentPoints: 0,
            lockReason: 'level',
            levelRequired: node.unlockAt,
          };
        }
        return { status: 'maxed', currentPoints: node.maxPoints };
      }

      const currentPoints = points[nodeId] ?? 0;
      const isMaxed = currentPoints >= node.maxPoints;
      const side = nodeSide.get(nodeId) ?? 'left';
      const sideSpent = side === 'left' ? leftSpent : rightSpent;

      // ── Row level gate: character level required to access this row ─────────
      const treeSide = side === 'left' ? 'class' : 'spec';
      const rowIndex = getTierIndex(node) + 1; // 1-based
      const rowLevelReq = getRowLevelReq(rowIndex, treeSide);
      const rowLevelMet = level >= rowLevelReq;

      // ── AE/TE points-spent gate: reqTabPoints on the node (official manifest field) ──
      // Nodes with reqTabPoints require that many points spent in the same tree side.
      const reqTabPoints = (node.reqTabPoints != null && node.reqTabPoints > 0)
        ? node.reqTabPoints
        : 0;
      const tabPointsMet = reqTabPoints === 0 || sideSpent >= reqTabPoints;

      // ── Per-node level gate: individual requiredLevel field ───────────────
      // Only some nodes carry this (e.g. sub-spec pivot nodes at level 10/20/30/40/50).
      const nodeRequiredLevel = (node.requiredLevel != null && node.requiredLevel > 1)
        ? node.requiredLevel
        : 0;
      const nodeLevelMet = nodeRequiredLevel === 0 || level >= nodeRequiredLevel;

      // Prereq check: ANY one prereq must have at least 1 point (OR logic).
      const prereqsMet =
        node.prerequisites.length === 0 ||
        node.prerequisites.some(prereqId => (points[prereqId] ?? 0) > 0);

      // If already allocated, never lock — always interactable for refund.
      if (isMaxed) return { status: 'maxed', currentPoints, sideSpent };
      if (currentPoints > 0) return { status: 'active', currentPoints, sideSpent };

      // Row level gate — character level too low for this row
      if (!rowLevelMet) {
        return {
          status: 'locked',
          currentPoints,
          lockReason: 'level',
          levelRequired: rowLevelReq,
          sideSpent,
        };
      }
      // AE/TE points-spent gate — not enough essence spent in this tree yet
      if (!tabPointsMet) {
        return {
          status: 'locked',
          currentPoints,
          lockReason: 'points',
          pointsRequired: reqTabPoints,
          sideSpent,
        };
      }
      // Per-node level gate (pivot nodes, capstones)
      if (!nodeLevelMet) {
        return {
          status: 'locked',
          currentPoints,
          lockReason: 'level',
          levelRequired: nodeRequiredLevel,
          sideSpent,
        };
      }
      if (!prereqsMet) {
        return { status: 'locked', currentPoints, lockReason: 'prereq', sideSpent };
      }
      // Side cap check: AE (left) / TE (right) hard cap.
      const sideCap = side === 'left' ? AE_CAP : TE_CAP;
      if (sideSpent >= sideCap) {
        return { status: 'locked', currentPoints, lockReason: 'budget', sideSpent };
      }
      return { status: 'available', currentPoints, sideSpent };
    },
    [allNodes, sidebarNodes, nodeSide, points, leftSpent, rightSpent, level],
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
      // autoGranted nodes are never manually interactable.
      if (node.autoGranted) return;
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

      // Normal node — also enforce per-side AE/TE hard cap.
      const side = nodeSide.get(nodeId) ?? 'left';
      const sideSpentNow = side === 'left' ? leftSpent : rightSpent;
      const sideCap = side === 'left' ? AE_CAP : TE_CAP;
      if (state.status === 'locked' || state.status === 'maxed' || !canAllocateMore) return;
      if (sideSpentNow >= sideCap) return;
      setPoints(prev => ({ ...prev, [nodeId]: (prev[nodeId] ?? 0) + 1 }));
    },
    [treeData, allNodes, sidebarNodes, nodeSide, leftSpent, rightSpent, getNodeState, canAllocateMore, choices],
  );

  const canRemovePoint = useCallback(
    (nodeId: string): boolean => {
      // Sidebar nodes auto-unlock; nothing to refund.
      if (sidebarNodes.some(n => n.id === nodeId)) return false;

      const currentPoints = points[nodeId] ?? 0;
      if (currentPoints === 0) return false;

      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return false;
      if (node.autoGranted) return false;

      const side = nodeSide.get(nodeId) ?? 'left';
      const sideSpent = side === 'left' ? leftSpent : rightSpent;
      const newSideSpent = sideSpent - 1;
      const willUnsatisfy = currentPoints === 1; // dropping to 0 → un-satisfies prereq for dependents

      // OR-prereq cascade: removing the last point orphans a dependent only if
      // it has points allocated AND no other spent prereq to satisfy the OR condition.
      if (willUnsatisfy) {
        const orphaned = allNodes.some(dep => {
          if (!dep.prerequisites.includes(nodeId)) return false;
          if ((points[dep.id] ?? 0) === 0) return false;
          // Check if any OTHER prereq of this dependent is still spent
          const otherPrereqsMet = dep.prerequisites
            .filter(pid => pid !== nodeId)
            .some(pid => (points[pid] ?? 0) > 0);
          return !otherPrereqsMet; // only orphaned if no other prereq covers it
        });
        if (orphaned) return false;
      }

      // Row level gates cannot be violated by a refund (level doesn't decrease).
      // AE/TE tab-points gate CAN be violated: removing a point reduces sideSpent.
      // Block refund if any allocated node on the same side requires more sideSpent
      // than (sideSpent - 1) via its reqTabPoints field.
      const sideNodes = side === 'left' ? leftNodes : rightNodes;
      const rowGateViolated = sideNodes.some(dep => {
        if (dep.id === nodeId) return false;
        if ((points[dep.id] ?? 0) === 0) return false;
        const depReqTabPoints = (dep.reqTabPoints != null && dep.reqTabPoints > 0)
          ? dep.reqTabPoints
          : 0;
        return depReqTabPoints > 0 && newSideSpent < depReqTabPoints;
      });
      if (rowGateViolated) return false;

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
        level,
        points,
        choices,
      }),
    );
  }, [treeData, points, choices, level]);

  const loadBuild = useCallback(
    (encoded: string): { classId?: string; specId?: string; level?: number } | undefined => {
      try {
        const decoded = JSON.parse(atob(encoded));

        // Sanitize points first (per-entry caps).
        // Also migrate legacy left-side IDs (`${classId}_${specId}_l_${i}`)
        // to the new class-stable form (`${classId}_class_l_${i}`) so older
        // shared builds still resolve onto the invariant class tree. The
        // regex escapes classId (defensive against future IDs with regex
        // metacharacters) and uses `[^_]+` for the spec token so any spec id
        // (digits/hyphens/etc.) matches. Idempotent on already-migrated keys.
        const safePoints: BuildState = {};
        const decodedClassId = typeof decoded?.classId === 'string' ? decoded.classId : '';
        const escapedClassId = decodedClassId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const legacyLeft = decodedClassId
          ? new RegExp(`^${escapedClassId}_[^_]+_l_(\\d+)$`)
          : null;
        if (decoded?.points && typeof decoded.points === 'object') {
          for (const [k, v] of Object.entries(decoded.points)) {
            if (typeof k === 'string' && typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 99) {
              const m = legacyLeft?.exec(k);
              const key = m ? `${decodedClassId}_class_l_${m[1]}` : k;
              safePoints[key] = Math.floor(v);
            }
          }
        }

        // Validate against the level budget — reject if over-cap so we never
        // silently load an invalid build. Older builds saved with the legacy
        // wider level range collapse into the new in-game [10, 60] range here.
        const decodedLevel =
          typeof decoded?.level === 'number' && Number.isFinite(decoded.level)
            ? clampLevel(decoded.level)
            : undefined;
        const effectiveLevel = decodedLevel ?? DEFAULT_LEVEL;
        const budget = getAvailablePoints(effectiveLevel);
        const totalSafe = Object.values(safePoints).reduce((s, n) => s + n, 0);
        if (totalSafe > budget) return undefined;

        setPoints(safePoints);

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
          level: decodedLevel,
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
    availablePoints,
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
