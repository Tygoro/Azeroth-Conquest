import type { TalentNode } from '@workspace/api-client-react';

// ─── PER-SPEC ROW DEFINITIONS ───────────────────────────────────────────────
// Each entry is the column count per row, top → bottom. The renderer builds
// flex rows from these counts; the data generator below creates the matching
// nodes (positions, prereq DAG, types, max points). Total node count =
// sum(rows). Row count must be 10 to align with the existing tier-gate /
// sidebar progression system (TIER_POINT_GATES has 10 entries).

/** Default 33-node, 10-row layout used by every spec without an override. */
export const DEFAULT_ROWS: ReadonlyArray<number> = [1, 3, 4, 5, 5, 4, 4, 3, 2, 2];

export const TREE_ROWS: Record<string, ReadonlyArray<number>> = {
  // Sun Cleric — hand-tuned to mirror the in-game Conquest of Azeroth UI.
  suncleric: [3, 2, 3, 3, 4, 5, 5, 4, 3, 3],
  suncleric_valkyrie_l: [3, 2, 3, 3, 4, 5, 5, 4, 3, 3],
  suncleric_valkyrie_r: [1, 1, 2, 4, 3, 7, 5, 4, 3, 3],
};

/** Resolve the row layout for a given (classId, specId, side). */
export function getRowsFor(
  classId: string,
  specId: string,
  side: 'l' | 'r',
): ReadonlyArray<number> {
  return (
    TREE_ROWS[`${classId}_${specId}_${side}`] ??
    TREE_ROWS[`${classId}_${specId}`] ??
    TREE_ROWS[classId] ??
    DEFAULT_ROWS
  );
}

/**
 * Resolve the row layout for a CLASS-side tree (left side). Skips the
 * spec-level overrides on purpose so the layout is invariant across all specs
 * of the same class.
 */
export function getClassRowsFor(classId: string): ReadonlyArray<number> {
  return TREE_ROWS[`${classId}_l`] ?? TREE_ROWS[classId] ?? DEFAULT_ROWS;
}

const TIER_Y_BASE = 40;
const TIER_Y_STEP = 70;
const COLUMN_SPACING = 78;

const colPos = (col: number, cols: number): number => col - (cols - 1) / 2;

export const tierY = (rowIdx: number): number => TIER_Y_BASE + rowIdx * TIER_Y_STEP;

export interface GeneratedLayout {
  count: number;
  positions: Array<{ x: number; y: number }>;
  prereqs: number[][];
  types: Array<TalentNode['type']>;
  maxPoints: number[];
}

export function generateLayout(rows: ReadonlyArray<number>): GeneratedLayout {
  if (rows.length !== 10) {
    throw new Error(`generateLayout: expected 10 rows, got ${rows.length}`);
  }
  for (let i = 0; i < rows.length; i++) {
    if (!Number.isInteger(rows[i]) || rows[i] < 1) {
      throw new Error(`generateLayout: row ${i} must be a positive integer, got ${rows[i]}`);
    }
  }
  if (sameRows(rows, DEFAULT_ROWS)) return DEFAULT_LAYOUT;

  const count = rows.reduce((s, n) => s + n, 0);
  const maxCols = Math.max(...rows);
  const xCenter = 24 + ((maxCols - 1) / 2) * COLUMN_SPACING;

  const rowStart: number[] = [];
  let acc = 0;
  for (const n of rows) {
    rowStart.push(acc);
    acc += n;
  }

  const positions: Array<{ x: number; y: number }> = [];
  const prereqs: number[][] = [];
  const types: Array<TalentNode['type']> = [];
  const maxPoints: number[] = [];

  const choiceTargets = pickChoiceIndices(rows, rowStart);
  const choiceSet = new Set(choiceTargets);

  rows.forEach((cols, rowIdx) => {
    const y = tierY(rowIdx);
    const isLastRow = rowIdx === rows.length - 1;

    for (let col = 0; col < cols; col++) {
      const cp = colPos(col, cols);
      const x = Math.round(xCenter + cp * COLUMN_SPACING);
      positions.push({ x, y });

      if (rowIdx === 0) {
        prereqs.push([]);
      } else {
        const prevCols = rows[rowIdx - 1];
        const prevStart = rowStart[rowIdx - 1];
        const dists = Array.from({ length: prevCols }, (_, p) => ({
          idx: prevStart + p,
          cp: colPos(p, prevCols),
          dist: Math.abs(colPos(p, prevCols) - cp),
        }));
        dists.sort((a, b) => a.dist - b.dist);
        const minDist = dists[0].dist;
        const ties = dists.filter((d) => Math.abs(d.dist - minDist) < 0.01);
        if (ties.length === 1) {
          prereqs.push([ties[0].idx]);
        } else if (Math.abs(cp) < 0.05) {
          prereqs.push(ties.map((t) => t.idx));
        } else {
          ties.sort((a, b) => Math.abs(a.cp) - Math.abs(b.cp));
          prereqs.push([ties[0].idx]);
        }
      }

      let t: TalentNode['type'];
      if (isLastRow) {
        t = 'capstone';
      } else if (rowIdx === 0) {
        t = 'active';
      } else if (choiceSet.has(positions.length - 1)) {
        t = 'choice';
      } else {
        const globalIdx = rowStart[rowIdx] + col;
        const isEdge = col === 0 || col === cols - 1;
        const mod = (globalIdx + rowIdx) % 5;
        if (isEdge) t = mod < 3 ? 'active' : 'passive';
        else t = mod < 2 ? 'active' : 'passive';
      }
      types.push(t);
      maxPoints.push(t === 'choice' || t === 'capstone' ? 1 : 2);
    }
  });

  return { count, positions, prereqs, types, maxPoints };
}

// ─── DEFAULT LAYOUT (HAND-TUNED, FROZEN FOR URL COMPAT) ─────────────────────

const DEFAULT_POSITIONS_RAW = [
  [2, 40],
  [1, 110], [2, 110], [3, 110],
  [0.5, 180], [1.5, 180], [2.5, 180], [3.5, 180],
  [0, 250], [1, 250], [2, 250], [3, 250], [4, 250],
  [0, 320], [1, 320], [2, 320], [3, 320], [4, 320],
  [0.5, 390], [1.5, 390], [2.5, 390], [3.5, 390],
  [0.5, 460], [1.5, 460], [2.5, 460], [3.5, 460],
  [1, 530], [2, 530], [3, 530],
  [1.5, 600], [2.5, 600],
  [1.5, 670], [2.5, 670],
] as const;

function deepFreezeLayout<T extends GeneratedLayout>(l: T): T {
  Object.freeze(l.positions);
  for (const p of l.positions) Object.freeze(p);
  Object.freeze(l.prereqs);
  for (const p of l.prereqs) Object.freeze(p);
  Object.freeze(l.types);
  Object.freeze(l.maxPoints);
  return Object.freeze(l);
}

const DEFAULT_LAYOUT: GeneratedLayout = deepFreezeLayout({
  count: 33,
  positions: DEFAULT_POSITIONS_RAW.map(([col, y]) => ({ x: 48 + col * 78, y })),
  prereqs: [
    [],
    [0], [0], [0],
    [1], [1, 2], [2, 3], [3],
    [4], [5], [5, 6], [6], [7],
    [8], [9], [10], [11], [12],
    [13, 14], [14, 15], [16], [16, 17],
    [18], [19, 20], [20], [21],
    [22, 23], [24], [25],
    [26, 27], [27, 28],
    [29], [30],
  ],
  types: [
    'active',
    'passive', 'active', 'passive',
    'active', 'choice', 'passive', 'active',
    'passive', 'active', 'choice', 'active', 'passive',
    'active', 'passive', 'choice', 'passive', 'active',
    'passive', 'active', 'choice', 'passive',
    'active', 'passive', 'active', 'choice',
    'active', 'choice', 'active',
    'active', 'passive',
    'capstone', 'capstone',
  ],
  maxPoints: [
    1,
    2, 2, 2,
    2, 1, 2, 2,
    2, 2, 1, 2, 2,
    2, 2, 1, 2, 2,
    2, 2, 1, 2,
    2, 2, 2, 1,
    2, 1, 2,
    2, 2,
    1, 1,
  ],
});

function sameRows(a: ReadonlyArray<number>, b: ReadonlyArray<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function pickChoiceIndices(
  rows: ReadonlyArray<number>,
  rowStart: ReadonlyArray<number>,
): number[] {
  const total = rows.reduce((s, n) => s + n, 0);
  const interiorRows: number[] = [];
  rows.forEach((_, idx) => {
    if (idx > 0 && idx < rows.length - 1) interiorRows.push(idx);
  });
  if (!interiorRows.length) return [];

  const targetCount = Math.max(3, Math.round(total / 6));
  const picks = new Set<number>();
  let cursor = 0;
  while (picks.size < targetCount && picks.size < total) {
    const rowIdx = interiorRows[cursor % interiorRows.length];
    const cols = rows[rowIdx];
    const step = Math.floor(picks.size / interiorRows.length);
    const colTry = Math.min(cols - 1, Math.max(0, Math.floor(cols / 2) + (step % 2 === 0 ? 0 : 1)));
    const globalIdx = rowStart[rowIdx] + colTry;
    if (!picks.has(globalIdx)) picks.add(globalIdx);
    else picks.add(rowStart[rowIdx]);
    cursor++;
    if (cursor > targetCount * 4) break;
  }
  return Array.from(picks);
}
