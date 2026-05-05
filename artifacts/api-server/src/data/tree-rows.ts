import type { TalentNode } from "@workspace/api-zod";

// ─── PER-SPEC ROW DEFINITIONS ───────────────────────────────────────────────
// Each entry is the column count per row, top → bottom. The renderer builds
// flex rows from these counts; the data generator below creates the matching
// nodes (positions, prereq DAG, types, max points). Total node count =
// sum(rows). Row count must be 10 to align with the existing tier-gate /
// sidebar progression system (TIER_POINT_GATES has 10 entries).
//
// To add a new spec layout: pick a `${classId}_${specId}_${side}` key with
// `side` ∈ {`l`, `r`}, or use just `${classId}_${specId}` to apply to both
// sides, or just `${classId}` to apply to all specs in that class.
//
// Resolution order (most specific wins):
//   1. `${classId}_${specId}_${side}`
//   2. `${classId}_${specId}`
//   3. `${classId}`
//   4. DEFAULT_ROWS

/** Default 33-node, 10-row layout used by every spec without an override. */
export const DEFAULT_ROWS: ReadonlyArray<number> = [1, 3, 4, 5, 5, 4, 4, 3, 2, 2];

export const TREE_ROWS: Record<string, ReadonlyArray<number>> = {
  // Sun Cleric — hand-tuned to mirror the in-game Conquest of Azeroth UI.
  // The class-side ("Sun Cleric") and the four spec-sides differ visually.
  suncleric: [3, 2, 3, 3, 4, 5, 5, 4, 3, 3], // class side default for Sun Cleric (35 nodes)
  suncleric_valkyrie_l: [3, 2, 3, 3, 4, 5, 5, 4, 3, 3], // Valkyrie left side (35 nodes, same as class)
  suncleric_valkyrie_r: [1, 1, 2, 4, 3, 7, 5, 4, 3, 3], // Valkyrie spec side (33 nodes)
};

/** Resolve the row layout for a given (classId, specId, side). */
export function getRowsFor(
  classId: string,
  specId: string,
  side: "l" | "r",
): ReadonlyArray<number> {
  return (
    TREE_ROWS[`${classId}_${specId}_${side}`] ??
    TREE_ROWS[`${classId}_${specId}`] ??
    TREE_ROWS[classId] ??
    DEFAULT_ROWS
  );
}

// ─── LAYOUT GENERATOR ───────────────────────────────────────────────────────
// Produces deterministic positions / prereq DAG / node types / max-points for
// any row pattern. The renderer also derives flex layout from rows, but the
// data layer needs concrete (x, y) so SVG connection lines and tier-gate
// matching (use-talent-tree.ts) keep working.

const TIER_Y_BASE = 40;
const TIER_Y_STEP = 70;
const COLUMN_SPACING = 78;

/** Centered column position (so cp=0 is the row axis). */
const colPos = (col: number, cols: number): number => col - (cols - 1) / 2;

/** y for a given row index — matches use-talent-tree.ts TIER_Y_VALUES. */
export const tierY = (rowIdx: number): number => TIER_Y_BASE + rowIdx * TIER_Y_STEP;

export interface GeneratedLayout {
  count: number;
  positions: Array<{ x: number; y: number }>;
  prereqs: number[][];
  types: Array<TalentNode["type"]>;
  maxPoints: number[];
}

/**
 * Generate a full tree layout from a row-count array.
 *
 * Special case: the canonical DEFAULT_ROWS pattern returns the same hand-tuned
 * arrays the codebase has shipped with, so existing serialized URLs decode to
 * exactly the same prereq DAG / node types they always did.
 */
export function generateLayout(rows: ReadonlyArray<number>): GeneratedLayout {
  // Strict shape: 10 rows, every row >=1. Aligns with TIER_POINT_GATES (10
  // entries) and TIER_Y_VALUES in use-talent-tree.ts.
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
  // Center every row around a single x axis. Use a left padding of 24px so the
  // leftmost node of the widest row sits comfortably inside the canvas.
  const xCenter = 24 + ((maxCols - 1) / 2) * COLUMN_SPACING;

  const rowStart: number[] = [];
  let acc = 0;
  for (const n of rows) {
    rowStart.push(acc);
    acc += n;
  }

  const positions: Array<{ x: number; y: number }> = [];
  const prereqs: number[][] = [];
  const types: Array<TalentNode["type"]> = [];
  const maxPoints: number[] = [];

  // Distribute choice nodes evenly through the tree (not in row 0 / last row).
  // Aim for roughly 1 choice per ~6 nodes — close to the default density (6/33).
  const choiceTargets = pickChoiceIndices(rows, rowStart);
  const choiceSet = new Set(choiceTargets);

  rows.forEach((cols, rowIdx) => {
    const y = tierY(rowIdx);
    const isLastRow = rowIdx === rows.length - 1;

    for (let col = 0; col < cols; col++) {
      const cp = colPos(col, cols);
      const x = Math.round(xCenter + cp * COLUMN_SPACING);
      positions.push({ x, y });

      // ── Prereq DAG ───────────────────────────────────────────────────────
      // Each non-root node connects to the nearest column-neighbour(s) in the
      // previous row. Tie rule: if exactly two prev nodes are equidistant,
      // converge ONLY when the current node sits on the centre axis (cp ≈ 0);
      // otherwise pick the inner candidate (closer to centre). This mirrors
      // the topology the hand-tuned default uses.
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

      // ── Type / max points ────────────────────────────────────────────────
      let t: TalentNode["type"];
      if (isLastRow) {
        t = "capstone";
      } else if (rowIdx === 0) {
        t = "active";
      } else if (choiceSet.has(positions.length - 1)) {
        t = "choice";
      } else {
        // Alternate active / passive for visual variety, weighted slightly
        // toward passives in middle tiers and actives on the edges.
        const globalIdx = rowStart[rowIdx] + col;
        const isEdge = col === 0 || col === cols - 1;
        const mod = (globalIdx + rowIdx) % 5;
        if (isEdge) t = mod < 3 ? "active" : "passive";
        else t = mod < 2 ? "active" : "passive";
      }
      types.push(t);
      maxPoints.push(t === "choice" || t === "capstone" ? 1 : 2);
    }
  });

  return { count, positions, prereqs, types, maxPoints };
}

// ─── DEFAULT LAYOUT (HAND-TUNED, FROZEN FOR URL COMPAT) ─────────────────────

const DEFAULT_POSITIONS_RAW = [
  // Tier 0 (1)
  [2, 40],
  // Tier 1 (3)
  [1, 110], [2, 110], [3, 110],
  // Tier 2 (4)
  [0.5, 180], [1.5, 180], [2.5, 180], [3.5, 180],
  // Tier 3 (5)
  [0, 250], [1, 250], [2, 250], [3, 250], [4, 250],
  // Tier 4 (5)
  [0, 320], [1, 320], [2, 320], [3, 320], [4, 320],
  // Tier 5 (4)
  [0.5, 390], [1.5, 390], [2.5, 390], [3.5, 390],
  // Tier 6 (4)
  [0.5, 460], [1.5, 460], [2.5, 460], [3.5, 460],
  // Tier 7 (3)
  [1, 530], [2, 530], [3, 530],
  // Tier 8 (2)
  [1.5, 600], [2.5, 600],
  // Tier 9 (2 capstones)
  [1.5, 670], [2.5, 670],
] as const;

// Deep-freeze so the canonical layout cannot be mutated at runtime.
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
    "active",
    "passive", "active", "passive",
    "active", "choice", "passive", "active",
    "passive", "active", "choice", "active", "passive",
    "active", "passive", "choice", "passive", "active",
    "passive", "active", "choice", "passive",
    "active", "passive", "active", "choice",
    "active", "choice", "active",
    "active", "passive",
    "capstone", "capstone",
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

/** Pick well-spaced indices to mark as choice nodes (not in row 0 / last row). */
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

  // Aim for ~1 choice per 6 nodes, biased toward middle of each chosen row.
  const targetCount = Math.max(3, Math.round(total / 6));
  const picks = new Set<number>();
  let cursor = 0;
  while (picks.size < targetCount && picks.size < total) {
    const rowIdx = interiorRows[cursor % interiorRows.length];
    const cols = rows[rowIdx];
    // pick alternating middle / off-center positions
    const step = Math.floor(picks.size / interiorRows.length);
    const colTry = Math.min(cols - 1, Math.max(0, Math.floor(cols / 2) + (step % 2 === 0 ? 0 : 1)));
    const globalIdx = rowStart[rowIdx] + colTry;
    if (!picks.has(globalIdx)) picks.add(globalIdx);
    else picks.add(rowStart[rowIdx]); // fallback: first node in row
    cursor++;
    if (cursor > targetCount * 4) break; // safety
  }
  return Array.from(picks);
}
