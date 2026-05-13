import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { parseWowTooltip, type SectionKind } from '@/data/talent-engine/wow-tooltip-parser';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import type { TalentTree as TalentTreeType, TalentNode } from '@workspace/api-client-react';
import { validateTree } from '@/data/classes/validate';
import { getNodeIconStyle, loadIconManifest } from '@/data/classes/icons';
import { type NodeState, getRowLevelReq } from '@/hooks/use-talent-tree';
import { getEdgeOverride, type EdgeFace } from '@/data/talent-engine/edge-overrides';
import { useShiftKey } from '@/hooks/use-shift-key';

// Kick off the icon sprite manifest fetch as early as possible.
loadIconManifest();

// ── Debug toggles ─────────────────────────────────────────────────────────────
// window.DEBUG_TREE = true   → node z-index labels, elementFromPoint logging
// window.DEBUG_EDGES = true  → edge anchors, direction arrows, midpoint handles
declare global { interface Window { DEBUG_TREE?: boolean; DEBUG_EDGES?: boolean } }
function isDebug():      boolean { return typeof window !== 'undefined' && !!window.DEBUG_TREE; }
function isDebugEdges(): boolean { return typeof window !== 'undefined' && !!window.DEBUG_EDGES; }

interface DualTalentTreeProps {
  tree: TalentTreeType;
  side: 'left' | 'right';
  getNodeState: (nodeId: string) => NodeState;
  /** Returns the selected option id for a choice node, or undefined */
  getChoiceSelection: (nodeId: string) => string | undefined;
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string) => void;
  /** Points spent in this side's tree — drives AE/TE cap indicator */
  sideSpent: number;
}

export function TalentTree({
  tree,
  side,
  getNodeState,
  getChoiceSelection,
  onNodeClick,
  onNodeContextMenu,
  sideSpent,
}: DualTalentTreeProps) {
  // Guard: validate structure before rendering
  const validation = validateTree(tree);
  if (!validation.valid) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
        <div className="text-xs font-mono text-destructive/60 bg-destructive/10 border border-destructive/20 rounded px-4 py-3 max-w-md">
          <div className="font-bold mb-1">Tree structure invalid</div>
          <div className="text-muted-foreground">{validation.reason}</div>
        </div>
      </div>
    );
  }

  const nodes = side === 'left' ? (tree.leftTree ?? []) : (tree.rightTree ?? []);
  const label = side === 'left'
    ? (tree.leftTreeName ?? `Path of ${tree.class}`)
    : (tree.rightTreeName ?? `Mastery of ${tree.class}`);

  return (
    <div
      className="flex flex-col items-center w-full h-full pt-4 px-2"
      style={{ position: 'relative', overflow: 'visible', pointerEvents: 'none' }}
    >
      <TreeLabel label={label} color={tree.color} />
      <div
        className="flex items-start gap-1"
        style={{ position: 'relative', overflow: 'visible' }}
      >
        <SingleTree
          nodes={nodes}
          color={tree.color}
          sideSpent={sideSpent}
          classSlug={tree.class?.toLowerCase() ?? ''}
          treeSide={side === 'left' ? 'class' : 'spec'}
          getNodeState={getNodeState}
          getChoiceSelection={getChoiceSelection}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
        />
      </div>
    </div>
  );
}

// ── Tree label ────────────────────────────────────────────────────────────────

function TreeLabel({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="mb-3 px-4 py-1 rounded-sm text-[10px] font-bold uppercase tracking-[0.28em] select-none pointer-events-none"
      style={{
        color: `${color}BB`,
        letterSpacing: '0.28em',
      }}
    >
      {label}
    </div>
  );
}

// ── Single tree ───────────────────────────────────────────────────────────────

interface SingleTreeProps {
  nodes: TalentNode[];
  color: string;
  /** Points spent in THIS tree — drives per-row tier-gate dim treatment. */
  sideSpent: number;
  /** Lowercase class slug for edge override lookup (e.g. "tinker"). */
  classSlug: string;
  /** Which tree this is — determines AE vs TE phrasing in tooltips. */
  treeSide: 'class' | 'spec';
  getNodeState: (nodeId: string) => NodeState;
  getChoiceSelection: (nodeId: string) => string | undefined;
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string) => void;
}

// ── Node visual sizes ────────────────────────────────────────────────────────
const NODE_SIZE     = 48;
const CAPSTONE_SIZE = 60;

// ── Lattice constants for procedurally generated trees ───────────────────────
// These are ONLY used for non-extracted (generated) trees. Extracted trees use
// tree-local normalized position.x/y set by the normalizer pipeline.
const LATTICE_ROWS = 10;
const LATTICE_COLS = 10;
const CELL_W = 72;            // horizontal pitch per column (px)
const CELL_H = 70;            // vertical pitch per row (px)
const LATTICE_PAD_X = 36;     // left/right canvas inset before col 1
const LATTICE_PAD_Y = 48;     // top canvas inset before row 1 — must exceed NODE_HALF (26px) to keep top row clickable
const SVG_PAD = 24;           // extra SVG overflow room for glows

// Half-sizes: terminate edges exactly at the visual node border (no pad).
const NODE_HALF = NODE_SIZE     / 2;
const CAP_HALF  = CAPSTONE_SIZE / 2;

// Fallback fixed canvas size for procedurally generated trees.
const LATTICE_W = LATTICE_PAD_X * 2 + (LATTICE_COLS - 1) * CELL_W + CELL_W;
const LATTICE_H = LATTICE_PAD_Y * 2 + (LATTICE_ROWS - 1) * CELL_H + CELL_H;

/** Convert 1-based (row, col) lattice coords to pixel center (generated trees only). */
function latticeToPixel(row: number, col: number): { x: number; y: number } {
  return {
    x: LATTICE_PAD_X + (col - 1) * CELL_W,
    y: LATTICE_PAD_Y + (row - 1) * CELL_H,
  };
}

/**
 * Resolve a node's pixel center.
 *
 * For extracted trees: position.x/y are already tree-local normalized + scaled
 * by normalize-tree.ts, so use them directly.
 *
 * For generated trees: fall back to latticeToPixel(gridRow, gridColumn).
 */
function nodePixelCenter(node: TalentNode): { x: number; y: number } {
  // Extracted trees: normalizer has already written tree-local scaled coords
  // into position.x/y. Detect this by checking if gridRow exists AND x > 0.
  // position.x/y from the normalizer are always >= TREE_PAD (36/40).
  const lp = latticePosition(node);
  if (node.position.x > 0 && node.position.y > 0 && lp.gridRow) {
    return { x: node.position.x, y: node.position.y };
  }
  // Generated trees: use fixed lattice mapping.
  if (lp.gridRow && lp.gridColumn) {
    return latticeToPixel(lp.gridRow, lp.gridColumn);
  }
  // Last resort fallback.
  return { x: node.position.x, y: node.position.y };
}

/**
 * Compute data-driven canvas dimensions from actual node positions.
 * Returns { width, height } that tightly fits all nodes with padding.
 */
export function computeCanvasBounds(nodes: TalentNode[]): { width: number; height: number } {
  if (nodes.length === 0) return { width: LATTICE_W, height: LATTICE_H };
  let maxX = 0, maxY = 0;
  for (const n of nodes) {
    const { x, y } = nodePixelCenter(n);
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  // Add padding after the last node so it doesn't sit flush against the edge.
  return {
    width: maxX + LATTICE_PAD_X + 24,
    height: maxY + LATTICE_PAD_Y + 24,
  };
}

const TIER_HEIGHT = CELL_H;   // row-overlay height == cell pitch

function latticePosition(node: TalentNode): { gridRow?: number; gridColumn?: number } {
  return node.position as TalentNode['position'] & { gridRow?: number; gridColumn?: number };
}

function groupByTier(nodes: TalentNode[]): TalentNode[][] {
  // Strict lattice grouping: gridRow is required for correct rendering.
  // Nodes without gridRow are treated as data integrity failures — they are
  // still placed (in row 1 as fallback) but a warning is logged.
  const tiers: TalentNode[][] = Array.from({ length: LATTICE_ROWS }, () => []);
  for (const n of nodes) {
    const lp = latticePosition(n);
    if (lp.gridRow && lp.gridRow >= 1 && lp.gridRow <= LATTICE_ROWS) {
      tiers[lp.gridRow - 1].push(n);
    } else {
      // Data integrity failure: place in row 1 and warn.
      if (typeof console !== 'undefined') {
        console.warn(`[talents] node "${n.name}" (${n.id}) missing gridRow — placed in row 1`);
      }
      tiers[0].push(n);
    }
  }
  // Within each row sort by gridColumn (then x as tiebreak).
  for (const row of tiers) row.sort((a, b) => {
    const ac = latticePosition(a).gridColumn ?? 999;
    const bc = latticePosition(b).gridColumn ?? 999;
    return ac !== bc ? ac - bc : a.position.x - b.position.x;
  });
  return tiers;
}

function nodeHalf(node: TalentNode): number {
  return (node.type === 'choice' || node.type === 'capstone') ? CAP_HALF : NODE_HALF;
}

/** Exit the top/bottom face of a node toward a target (vertical attachment). */
function edgePointV(
  center: { x: number; y: number },
  target: { x: number; y: number },
  node: TalentNode,
): { x: number; y: number } {
  const h = nodeHalf(node);
  return { x: center.x, y: center.y + (target.y >= center.y ? h : -h) };
}

/** Exit the left/right face of a node toward a target (horizontal attachment). */
function edgePointH(
  center: { x: number; y: number },
  target: { x: number; y: number },
  node: TalentNode,
): { x: number; y: number } {
  const h = nodeHalf(node);
  return { x: center.x + (target.x >= center.x ? h : -h), y: center.y };
}

/** Exit the explicit named face of a node (used by edge overrides). */
function edgePointFace(
  center: { x: number; y: number },
  node: TalentNode,
  face: EdgeFace,
): { x: number; y: number } {
  const h = nodeHalf(node);
  switch (face) {
    case 'top':    return { x: center.x,     y: center.y - h };
    case 'bottom': return { x: center.x,     y: center.y + h };
    case 'left':   return { x: center.x - h, y: center.y     };
    case 'right':  return { x: center.x + h, y: center.y     };
  }
}

interface EdgeResult {
  d:        string;
  startPt:  { x: number; y: number };
  endPt:    { x: number; y: number };
  pivot:    { x: number; y: number } | null;
  edgeType: 'vertical' | 'horizontal' | 'elbow' | 'manual';
}

/**
 * Build an SVG path + anchor metadata for a prereq→dependent edge.
 * Checks for a manual override first; falls back to auto-routing.
 *
 * Auto-routing rules (in priority order):
 *   1. Same column              → straight vertical   (top/bottom face)
 *   2. Same row                 → straight horizontal (left/right face)
 *   3. Adjacent column (|Δcol|=1) + different row → straight diagonal corner-to-corner
 *   4. Multi-column off-diagonal  → two-segment: short vertical stub + diagonal run
 *
 * Override rules:
 *   routing:'manual' + path  → return the literal path string unchanged
 *   routing:'straight'       → straight line using explicit exit/enter faces
 *   routing:'elbow'          → L-elbow using explicit exit/enter faces and optional midY
 */
function edgePathWithAnchors(
  from:     { x: number; y: number },
  to:       { x: number; y: number },
  fromNode: TalentNode,
  toNode:   TalentNode,
  classSlug: string,
): EdgeResult {
  const override = getEdgeOverride(classSlug, fromNode.id, toNode.id);
  if (isDebugEdges()) {
    const fromShort = fromNode.id.replace('CoATalentFrameTreeViewSpecTreePoolFrame', 'S:').replace('CoATalentFrameTreeViewClassTreePoolFrame', 'C:');
    const toShort   = toNode.id.replace('CoATalentFrameTreeViewSpecTreePoolFrame', 'S:').replace('CoATalentFrameTreeViewClassTreePoolFrame', 'C:');
    if (override) {
      console.log(`[edge-override] HIT  ${fromShort} → ${toShort} | routing:${override.routing} exit:${override.exit} enter:${override.enter}`);
    } else {
      console.log(`[edge-override] MISS ${fromShort} → ${toShort}`);
    }
  }

  // ── Manual override: fully custom path ───────────────────────────────
  if (override?.routing === 'manual' && override.path) {
    return {
      d:        override.path,
      startPt:  from,
      endPt:    to,
      pivot:    null,
      edgeType: 'manual',
    };
  }

  // ── Straight override: explicit face-to-face line ─────────────────────
  if (override?.routing === 'straight') {
    const s = override.exit  ? edgePointFace(from, fromNode, override.exit)  : edgePointV(from, to, fromNode);
    const e = override.enter ? edgePointFace(to,   toNode,   override.enter) : edgePointV(to, from, toNode);
    return {
      d:        `M ${r(s.x)} ${r(s.y)} L ${r(e.x)} ${r(e.y)}`,
      startPt:  s,
      endPt:    e,
      pivot:    null,
      edgeType: 'vertical',
    };
  }

  const fl = latticePosition(fromNode);
  const tl = latticePosition(toNode);
  const colA = fl.gridColumn ?? 0;
  const colB = tl.gridColumn ?? 0;
  const rowA = fl.gridRow    ?? 0;
  const rowB = tl.gridRow    ?? 0;

  // ── Auto primitive 1: same column → straight vertical ────────────────
  if (!override && colA && colB && colA === colB) {
    const s = edgePointV(from, to,   fromNode);
    const e = edgePointV(to,   from, toNode);
    return {
      d:        `M ${r(s.x)} ${r(s.y)} L ${r(e.x)} ${r(e.y)}`,
      startPt:  s,
      endPt:    e,
      pivot:    null,
      edgeType: 'vertical',
    };
  }

  // ── Auto primitive 2: same row → straight horizontal ─────────────────
  if (!override && rowA && rowB && rowA === rowB) {
    const s = edgePointH(from, to,   fromNode);
    const e = edgePointH(to,   from, toNode);
    return {
      d:        `M ${r(s.x)} ${r(s.y)} L ${r(e.x)} ${r(e.y)}`,
      startPt:  s,
      endPt:    e,
      pivot:    null,
      edgeType: 'horizontal',
    };
  }

  // ── Diagonal routing (auto, no override active) ───────────────────────
  const goingDown = to.y > from.y;
  const srcH = nodeHalf(fromNode);
  const dstH = nodeHalf(toNode);

  // For override elbow: honour explicit faces + optional midY
  if (override?.routing === 'elbow') {
    const s = override.exit  ? edgePointFace(from, fromNode, override.exit)
                             : { x: from.x, y: goingDown ? from.y + srcH : from.y - srcH };
    const e = override.enter ? edgePointFace(to,   toNode,   override.enter)
                             : { x: to.x, y: goingDown ? to.y - dstH : to.y + dstH };
    const rawMid = s.y + (e.y - s.y) * 0.30;
    const midY = r(override.midY ?? (goingDown
      ? Math.max(s.y, Math.min(e.y, rawMid))
      : Math.min(s.y, Math.max(e.y, rawMid))));
    const sx = r(s.x), sy = r(s.y), ex = r(e.x), ey = r(e.y);
    return {
      d: `M ${sx} ${sy} L ${sx} ${midY} L ${ex} ${midY} L ${ex} ${ey}`,
      startPt: s, endPt: e,
      pivot: { x: s.x, y: midY },
      edgeType: 'elbow',
    };
  }

  const colDelta = colA && colB ? Math.abs(colB - colA) : 0;

  // ── Auto primitive 3: adjacent columns → pure diagonal ───────────────
  // Exit from the corner of the source node in the direction of the target,
  // enter the corner of the target node — one straight diagonal line.
  if (!override && colDelta === 1 && rowA && rowB && rowA !== rowB) {
    const goRight = to.x > from.x;
    // Exit corner: bottom-right or bottom-left of source (top if going up)
    const sx2 = r(from.x + (goRight ?  srcH : -srcH));
    const sy2 = r(from.y + (goingDown ?  srcH : -srcH));
    // Enter corner: top-left or top-right of target
    const ex2 = r(to.x   + (goRight ? -dstH :  dstH));
    const ey2 = r(to.y   + (goingDown ? -dstH :  dstH));
    return {
      d:        `M ${sx2} ${sy2} L ${ex2} ${ey2}`,
      startPt:  { x: sx2, y: sy2 },
      endPt:    { x: ex2, y: ey2 },
      pivot:    null,
      edgeType: 'vertical',
    };
  }

  // ── Auto primitive 4: multi-column off-diagonal → stub + diagonal ────
  // A short vertical stub exits the source (20% of row-span), then a
  // single diagonal line runs to the target corner — no horizontal rail.
  {
    const s = { x: from.x, y: goingDown ? from.y + srcH : from.y - srcH };
    const e = { x: to.x,   y: goingDown ? to.y   - dstH : to.y   + dstH };
    const stubLen = (e.y - s.y) * 0.18;
    const stubY = r(s.y + stubLen);
    const sx2 = r(s.x), sy2 = r(s.y), ex2 = r(e.x), ey2 = r(e.y);
    return {
      d:        `M ${sx2} ${sy2} L ${sx2} ${stubY} L ${ex2} ${ey2}`,
      startPt:  s,
      endPt:    e,
      pivot:    { x: s.x, y: stubY },
      edgeType: 'elbow',
    };
  }
}

/** Round to 2 decimal places for clean SVG output. */
function r(v: number): number {
  return Math.round(v * 100) / 100;
}


function SingleTree({ nodes, color, sideSpent, classSlug, treeSide, getNodeState, getChoiceSelection, onNodeClick, onNodeContextMenu }: SingleTreeProps) {
  const tiers = useMemo(() => groupByTier(nodes), [nodes]);
  // Data-driven canvas size from actual node positions.
  const { width, height } = useMemo(() => computeCanvasBounds(nodes), [nodes]);

  // ── Centers for SVG connection lines (pure lattice arithmetic) ───────────
  const [centers, setCenters] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Since node positions are now computed from fixed lattice coords
  // (nodePixelCenter), we can derive SVG connection centers directly from
  // lattice arithmetic rather than measuring DOM layout. This avoids the
  // offset-walk drift that can occur inside a CSS-transformed ScaleStage.
  useLayoutEffect(() => {
    const next = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      // nodePixelCenter() returns coords in the container div's coordinate space.
      // The SVG element is placed at left:-SVG_PAD, top:-SVG_PAD, so its
      // internal coordinate origin is offset by +SVG_PAD from the container.
      // Add SVG_PAD to each center so paths land on actual node centers.
      const c = nodePixelCenter(node);
      next.set(node.id, { x: c.x + SVG_PAD, y: c.y + SVG_PAD });
    }
    setCenters(next);
  }, [nodes]);

  const colorId  = color.replace('#', '');
  const colorHex = color; // used in SVG feFlood — must be a valid CSS color string

  return (
    <div
      className="relative"
      style={{
        width,
        height,
        background: 'transparent',
        borderRadius: 0,
        boxShadow: 'none',
        overflow: 'visible',
        // The canvas div itself must not intercept pointer events.
        // Only the individual node divs (rendered inside this) re-enable auto.
        pointerEvents: 'none',
      }}
    >
      {/* SVG connection lines — rendered below nodes */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={width + SVG_PAD * 2}
        height={height + SVG_PAD * 2}
        style={{
          overflow: 'visible',
          left: -SVG_PAD,
          top: -SVG_PAD,
          position: 'absolute',
        }}
      >
        <defs>
          {/* Maxed path glow — strong bloom around active lines */}
          <filter id={`glow-maxed-${colorId}`} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feFlood floodColor={colorHex} floodOpacity="0.8" result="flood" />
            <feComposite in="flood" in2="blur" operator="in" result="colored" />
            <feMerge>
              <feMergeNode in="colored" />
              <feMergeNode in="colored" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Active path — subtle soft glow */}
          <filter id={`glow-active-${colorId}`} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feFlood floodColor={colorHex} floodOpacity="0.55" result="flood" />
            <feComposite in="flood" in2="blur" operator="in" result="colored" />
            <feMerge>
              <feMergeNode in="colored" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Inactive dash pattern */}
          <pattern id={`dash-inactive-${colorId}`} patternUnits="userSpaceOnUse" width="12" height="4">
            <rect width="7" height="4" fill="#3a3a55" />
          </pattern>
        </defs>

        {nodes.map(node =>
          node.prerequisites.map(prereqId => {
            const prereq = nodes.find(n => n.id === prereqId);
            if (!prereq) return null;
            const a = centers.get(prereqId);
            const b = centers.get(node.id);
            if (!a || !b) return null;

            const prereqState = getNodeState(prereqId);
            const nodeState   = getNodeState(node.id);

            const prereqMaxed  = prereqState.status === 'maxed';
            const prereqActive = prereqState.status === 'active';
            const targetAvail  = nodeState.status === 'available';

            const edge   = edgePathWithAnchors(a, b, prereq, node, classSlug);
            const { d: path, startPt, endPt, pivot, edgeType } = edge;
            const key  = `${prereqId}→${node.id}`;

            const CAP = 'butt' as const;
            const JOIN = 'miter' as const;
            const dbgEdge = isDebugEdges();

            // ── Unified edge render ───────────────────────────────────────
            // Pick stroke params by state, then one return with optional debug.
            let strokeColor = '#6a6a88';
            let strokeWidth = 1.4;
            let strokeOpacity = 0.70;
            let bloomPath: React.ReactNode = null;

            if (prereqMaxed) {
              strokeColor   = color;
              strokeWidth   = 2;
              strokeOpacity = 1;
              bloomPath = <path d={path} fill="none" stroke={color} strokeWidth={4}
                strokeOpacity={0.15} strokeLinecap={CAP} strokeLinejoin={JOIN}
                filter={`url(#glow-maxed-${colorId})`} />;
            } else if (prereqActive) {
              strokeColor   = color;
              strokeWidth   = 1.6;
              strokeOpacity = 0.88;
              bloomPath = <path d={path} fill="none" stroke={color} strokeWidth={2.5}
                strokeOpacity={0.12} strokeLinecap={CAP} strokeLinejoin={JOIN}
                filter={`url(#glow-active-${colorId})`} />;
            } else if (targetAvail) {
              strokeColor   = color;
              strokeWidth   = 1.4;
              strokeOpacity = 0.55;
            }

            return (
              <g key={key}>
                {bloomPath}
                <path d={path} fill="none" stroke={strokeColor}
                  strokeWidth={strokeWidth} strokeOpacity={strokeOpacity}
                  strokeLinecap={CAP} strokeLinejoin={JOIN} />
                {/* ── DEBUG_EDGES overlay ─────────────────────────────── */}
                {dbgEdge && (() => {
                  const mx = (startPt.x + endPt.x) / 2;
                  const my = (startPt.y + endPt.y) / 2;
                  // Direction arrow at midpoint (pointing from start→end)
                  const dx = endPt.x - startPt.x;
                  const dy = endPt.y - startPt.y;
                  const len = Math.sqrt(dx*dx + dy*dy) || 1;
                  const arrowLen = 8;
                  const ax = mx + (dx/len)*arrowLen*0.5;
                  const ay = my + (dy/len)*arrowLen*0.5;
                  const perpX = -(dy/len)*3;
                  const perpY =  (dx/len)*3;
                  return (
                    <g>
                      {/* Anchor dots */}
                      <circle cx={startPt.x} cy={startPt.y} r={3.5} fill="lime"   opacity={0.95} />
                      <circle cx={endPt.x}   cy={endPt.y}   r={3.5} fill="cyan"   opacity={0.95} />
                      {/* Elbow pivot */}
                      {pivot && <circle cx={pivot.x} cy={pivot.y} r={4} fill="none" stroke="orange" strokeWidth={1.5} opacity={0.9} />}
                      {/* Midpoint handle (draggable-style visual) */}
                      <rect x={mx-4} y={my-4} width={8} height={8} fill="#fff" opacity={0.25} stroke="#fff" strokeWidth={0.5} />
                      {/* Direction arrow */}
                      <polygon
                        points={`${r(ax)},${r(ay)} ${r(ax-perpX-dx/len*4)},${r(ay-perpY-dy/len*4)} ${r(ax+perpX-dx/len*4)},${r(ay+perpY-dy/len*4)}`}
                        fill="yellow" opacity={0.85}
                      />
                      {/* Edge type + key label */}
                      <text x={r(mx)} y={r(Math.min(startPt.y, endPt.y) - 6)}
                        fontSize="6.5" fill="#ffff80" textAnchor="middle"
                        style={{ pointerEvents: 'none' }}>
                        {edgeType}
                      </text>
                      <text x={r(mx)} y={r(Math.min(startPt.y, endPt.y) - 14)}
                        fontSize="5.5" fill="#aaaaff" textAnchor="middle"
                        style={{ pointerEvents: 'none' }}>
                        {prereqId.slice(-12)}→{node.id.slice(-12)}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })
        )}
      </svg>

      {nodes.map(node => {
        const state = getNodeState(node.id);
        const selectedOptionId = node.type === 'choice' ? getChoiceSelection(node.id) : undefined;
        const { x: px, y: py } = nodePixelCenter(node);
        const dbg = isDebug();
        const nodeSize = (node.type === 'choice' || node.type === 'capstone') ? CAPSTONE_SIZE : NODE_SIZE;
        return (
          <div
            key={node.id}
            className="absolute flex items-center justify-center"
            data-node-id={node.id}
            style={{
              left: px,
              top: py,
              transform: 'translate(-50%, -50%)',
              zIndex: 5,
              position: 'absolute',
              pointerEvents: 'auto',
              // Debug: bright red outline on the actual hitbox div
              ...(dbg ? {
                outline: '2px solid red',
                outlineOffset: '0px',
              } : {}),
            }}
            onPointerEnter={dbg ? (e) => {
              const el = document.elementFromPoint(e.clientX, e.clientY);
              console.log('[DEBUG] pointerenter node:', node.id, node.name,
                '\n  wrapper rect:', e.currentTarget.getBoundingClientRect(),
                '\n  topmost element at cursor:', el,
                '\n  topmost tag/class:', el?.tagName, (el as HTMLElement)?.className);
            } : undefined}
            onPointerDown={dbg ? (e) => {
              const el = document.elementFromPoint(e.clientX, e.clientY);
              console.log('[DEBUG] pointerdown node:', node.id,
                '\n  topmost element:', el,
                '\n  tag:', el?.tagName, '\n  class:', (el as HTMLElement)?.className,
                '\n  is inside this wrapper:', e.currentTarget.contains(el));
            } : undefined}
            onClick={dbg ? (e) => {
              console.log('[DEBUG] click FIRED on node wrapper:', node.id, node.name);
            } : undefined}
          >
            {/* Debug: z-index label */}
            {dbg && (
              <div style={{
                position: 'absolute', top: -14, left: 0,
                fontSize: 8, color: 'yellow', background: 'rgba(0,0,0,0.7)',
                padding: '0 2px', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 100,
              }}>
                z5 {Math.round(px)},{Math.round(py)}
              </div>
            )}
            <TalentNodeComponent
              node={node}
              state={state}
              color={color}
              treeSide={treeSide}
              allNodes={nodes}
              selectedOptionId={selectedOptionId}
              getNodeState={getNodeState}
              onClick={() => onNodeClick(node.id)}
              onContextMenu={() => onNodeContextMenu(node.id)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Talent node ───────────────────────────────────────────────────────────────

interface TalentNodeComponentProps {
  node: TalentNode;
  state: NodeState;
  color: string;
  treeSide: 'class' | 'spec';
  allNodes: TalentNode[];
  selectedOptionId?: string;
  getNodeState: (nodeId: string) => NodeState;
  onClick: () => void;
  onContextMenu: () => void;
}

function TalentNodeComponent({
  node, state, color, treeSide, allNodes, selectedOptionId, getNodeState, onClick, onContextMenu,
}: TalentNodeComponentProps) {
  const [hovered, setHovered] = useState(false);
  const { status, currentPoints } = state;

  const isLocked        = status === 'locked';
  const isAvailable     = status === 'available';
  const isActive        = status === 'active';
  const isMaxed         = status === 'maxed';

  const isChoice = node.type === 'choice';
  const isCapstone = node.type === 'capstone';
  const isAutoGranted = !!node.autoGranted;
  const isLargeNode = isChoice || isCapstone;
  const isPlaceholder = node.id.includes('placeholder') || node.name.startsWith('Unresolved');
  const size = isLargeNode ? CAPSTONE_SIZE : NODE_SIZE;

  // For choice nodes, derive option-specific name/icon for the active half.
  const choiceOptions = isChoice ? node.options ?? [] : [];
  const selectedIdx = isChoice
    ? Math.max(0, choiceOptions.findIndex(o => o.id === selectedOptionId))
    : -1;
  const activeOption = isChoice && selectedIdx >= 0 ? choiceOptions[selectedIdx] : undefined;

  const iconData = isChoice
    ? getNodeIconStyle(node.id, activeOption?.name ?? choiceOptions[0]?.name ?? node.name, node.type, activeOption?.icon ?? node.icon)
    : getNodeIconStyle(node.id, node.name, node.type, node.icon);
  const isIconPlaceholder = iconData.type === 'placeholder';

  // Shape per spec: autoGranted ability-teaching nodes are square, autoGranted
  // passives are circle, regular passives circle, actives rounded square,
  // capstones circle, choices octagon.
  // Primary signal: nodeShape field from extracted data ('square' = ability node).
  // Fallback: detect "teaches/grants" in stripped description text.
  const nodeShape = (node as { nodeShape?: string }).nodeShape;
  const agIsAbilityShape = isAutoGranted && (
    nodeShape === 'square' ||
    /teaches you|grants you|\blearn /i.test(
      (node.description ?? '').replace(/\|c[0-9a-fA-F]{8}/g, '').replace(/\|r/g, '').replace(/\|T[^|]+\|t/g, '')
    )
  );
  const shapeStyle: React.CSSProperties =
    isAutoGranted
      ? (agIsAbilityShape ? { borderRadius: '6px' } : { borderRadius: '50%' })
      : isCapstone
      ? { borderRadius: '50%' }
      : node.type === 'passive'
      ? { borderRadius: '50%' }
      : node.type === 'active'
      ? { borderRadius: '6px' }
      : { clipPath: 'polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)' };

  // State-derived visuals
  // ── Visual hierarchy: 4 clear tiers ────────────────────────────────────
  //
  //  locked    → desaturated, dim, dark bg, dark border, no glow
  //  available → neutral/bright border hint, slight bg lift, no glow
  //  active    → colored border, colored bg, soft outer glow
  //  maxed     → full color, bright bloom, saturated bg, breathing ring
  //
  // The gap between each tier must be immediately obvious at a glance.

  // ── autoGranted nodes use a teal accent independent of class color ─────
  const AG_COLOR = '#00e5cc';
  // For autoGranted nodes: only use the teal accent when the node is actually
  // unlocked (maxed/active). Locked future milestones use neutral gray so they
  // don't glow cyan like unlocked ones.
  const nodeColor = isAutoGranted
    ? (isLocked ? '#555570' : AG_COLOR)
    : color;

  // ── Border ───────────────────────────────────────────────────────────────
  const borderColor =
    isMaxed         ? nodeColor
    : isActive      ? `${nodeColor}CC`
    : isAvailable   ? `${nodeColor}70`
    : '#454560';    // all locked states: medium gray, readable

  const borderWidth = isMaxed ? 2 : isActive ? 2 : 1.5;

  // ── Opacity ───────────────────────────────────────────────────────────────
  // Official: all nodes remain clearly visible. Locked = slight desaturation only.
  const nodeOpacity = isLocked
    ? (isPlaceholder ? 0.45 : 0.65)
    : isAvailable ? 0.9
    : 1;

  // ── Glow ─────────────────────────────────────────────────────────────────
  // Official: clean, crisp — no heavy bloom. Maxed gets a subtle ring only.
  const boxShadow =
    isMaxed
      ? `0 0 0 1px ${nodeColor}77,
         0 0 6px  ${nodeColor}55,
         inset 0 0 4px ${nodeColor}18`
      : isActive
      ? `0 0 0 1px ${nodeColor}55,
         0 0 4px  ${nodeColor}44`
      : 'none';

  // ── Background ───────────────────────────────────────────────────────────
  // Official: locked nodes have same dark bg as others — no extra darkness.
  const bgStyle: React.CSSProperties = {
    background: isMaxed
      ? `radial-gradient(circle at 38% 28%, ${nodeColor}44 0%, ${nodeColor}18 45%, #0d0c1c 100%)`
      : isActive
      ? `radial-gradient(circle at 38% 28%, ${nodeColor}28 0%, #111028 55%, #0b0a1a 100%)`
      : '#0a0a16',
  };

  // Cursor-following tooltip: track the mouse position so the tooltip's arrow
  // always points at the cursor (not the node center).
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };
  const handleMouseEnter = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    setHovered(true);
  };

  return (
    <div
      data-testid={`node-${node.id}`}
      className="relative"
      style={{
        width: size,
        height: size,
        zIndex: hovered ? 50 : 10,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); onContextMenu(); }}
    >
      {/* Outer breathing ring — maxed only, very subtle */}
      {isMaxed && (
        <motion.div
          className="absolute pointer-events-none"
          animate={{ scale: [1, 1.14, 1], opacity: [0.28, 0, 0.28] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            inset: -2,
            ...shapeStyle,
            border: `1px solid ${color}88`,
          }}
        />
      )}

      <motion.div
        whileHover={!isLocked ? { scale: 1.08 } : {}}
        whileTap={!isLocked ? { scale: 0.92 } : {}}
        animate={isMaxed ? { scale: [1, 1.02, 1] } : {}}
        transition={isMaxed
          ? { duration: 2.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
          : { type: 'spring', stiffness: 380, damping: 26 }
        }
        className={`w-full h-full relative overflow-hidden select-none ${isAutoGranted ? 'cursor-default' : 'cursor-pointer'}`}
        style={{
          ...shapeStyle,
          ...bgStyle,
          border: `${borderWidth}px solid ${borderColor}`,
          boxShadow,
          opacity: nodeOpacity,
          transition: 'border-color 0.18s, box-shadow 0.18s, opacity 0.18s',
        }}
      >
        {/* Icon — choice nodes show split halves, others show single icon */}
        {isChoice && choiceOptions.length === 2 ? (
          <ChoiceSplitIcon
            options={choiceOptions}
            selectedIdx={activeOption ? selectedIdx : -1}
            nodeId={node.id}
            nodeType={node.type}
            isLocked={isLocked}
            isActive={isActive || isMaxed}
            color={color}
          />
        ) : !isIconPlaceholder ? (
          <div
            className="w-full h-full"
            style={{
              backgroundImage: (iconData as { type: 'sprite'; backgroundImage: string; backgroundPosition: string; backgroundSize: string }).backgroundImage,
              backgroundPosition: (iconData as { type: 'sprite'; backgroundImage: string; backgroundPosition: string; backgroundSize: string }).backgroundPosition,
              backgroundSize: (iconData as { type: 'sprite'; backgroundImage: string; backgroundPosition: string; backgroundSize: string }).backgroundSize,
              backgroundRepeat: 'no-repeat',
              filter: isLocked
                ? `grayscale(0.8) brightness(0.72)`
                : isMaxed
                ? `saturate(1.2) brightness(1.08)`
                : isActive
                ? `saturate(1.1) brightness(1.0)`
                : `saturate(0.8) brightness(0.85)`,
              transition: 'filter 0.25s',
            }}
          />
        ) : (
          /* Placeholder: initials when icon not in sprite manifest */
          <div
            className="w-full h-full flex items-center justify-center text-[10px] font-bold"
            style={{
              color: isLocked ? (isPlaceholder ? `${color}99` : '#77778c') : isMaxed ? color : isActive ? `${color}CC` : '#8a8aa0',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            {node.name.split(' ').map(w => w[0]).join('').slice(0, 3)}
          </div>
        )}

        {/* Choice node — vertical divider between halves */}
        {isChoice && (
          <div
            className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              width: 1.5,
              background: isLocked ? '#252535' : `${color}AA`,
              boxShadow: isActive || isMaxed ? `0 0 4px ${color}` : 'none',
            }}
          />
        )}

        {/* Sheen overlay for active/maxed */}
        {(isActive || isMaxed) && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${nodeColor}18 0%, transparent 60%)`,
            }}
          />
        )}
      </motion.div>

      {/* autoGranted badge — replaces all pips */}
      {isAutoGranted && (
        <div
          className="absolute -bottom-[16px] left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wider px-1.5 rounded-sm select-none whitespace-nowrap"
          style={{
            background: isMaxed ? `${AG_COLOR}22` : 'rgba(0,0,0,0.7)',
            color: isMaxed ? AG_COLOR : isLocked ? `${AG_COLOR}55` : `${AG_COLOR}99`,
            border: `1px solid ${isMaxed ? `${AG_COLOR}66` : '#252535'}`,
            lineHeight: '14px',
            backdropFilter: 'blur(2px)',
          }}
        >
          {isLocked && node.unlockAt !== undefined ? `lv${node.unlockAt}` : 'auto'}
        </div>
      )}
      {/* Points pip — shown below node. Hidden for autoGranted and locked+placeholder. */}
      {!isAutoGranted && (!isLocked || isAvailable) && node.maxPoints > 1 && (
        <div
          className="absolute -bottom-[18px] left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-1.5 rounded-sm select-none whitespace-nowrap"
          style={{
            background: isMaxed ? `${color}22` : 'rgba(0,0,0,0.7)',
            color: isMaxed ? color : isActive ? `${color}CC` : '#55556a',
            border: `1px solid ${isMaxed ? `${color}77` : isActive ? `${color}44` : '#252535'}`,
            lineHeight: '15px',
            minWidth: '26px',
            textAlign: 'center',
            boxShadow: isMaxed ? `0 0 5px ${color}66` : 'none',
            backdropFilter: 'blur(2px)',
          }}
        >
          {currentPoints}/{node.maxPoints}
        </div>
      )}
      {/* Single-rank pip: just a dot indicator */}
      {!isAutoGranted && (!isLocked || isAvailable) && node.maxPoints === 1 && (
        <div
          className="absolute -bottom-[14px] left-1/2 -translate-x-1/2 select-none"
          style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: isMaxed ? color : isActive ? `${color}88` : '#252535',
            boxShadow: isMaxed ? `0 0 4px ${color}` : 'none',
          }}
        />
      )}

      {/* WoW-style tooltip — follows the cursor */}
      <AnimatePresence>
        {hovered && (
          <WowTooltip
            node={node}
            state={state}
            color={color}
            treeSide={treeSide}
            allNodes={allNodes}
            selectedOptionId={selectedOptionId}
            getNodeState={getNodeState}
            mousePos={mousePos}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Choice split icon (two halves, one per option) ──────────────────────────

interface ChoiceSplitIconProps {
  options: NonNullable<TalentNode['options']>;
  /** -1 = no selection (both dim) */
  selectedIdx: number;
  nodeId: string;
  nodeType: TalentNode['type'];
  isLocked: boolean;
  isActive: boolean;
  color: string;
}

function ChoiceSplitIcon({
  options, selectedIdx, nodeId, nodeType, isLocked, isActive, color,
}: ChoiceSplitIconProps) {
  return (
    <div className="absolute inset-0 flex">
      {options.map((opt, i) => {
        const isThisSelected = i === selectedIdx;
        const isThisDim = !isThisSelected && selectedIdx >= 0;
        const iconData = getNodeIconStyle(`${nodeId}_${i}`, opt.name, nodeType, opt.icon);
        return (
          <ChoiceHalf
            key={opt.id}
            iconData={iconData}
            altText={opt.name}
            color={color}
            isLocked={isLocked}
            isSelected={isThisSelected && isActive}
            isDim={isThisDim || (!isActive && selectedIdx < 0)}
            side={i === 0 ? 'left' : 'right'}
          />
        );
      })}
    </div>
  );
}

interface ChoiceHalfProps {
  iconData: ReturnType<typeof getNodeIconStyle>;
  altText: string;
  color: string;
  isLocked: boolean;
  isSelected: boolean;
  isDim: boolean;
  side: 'left' | 'right';
}

function ChoiceHalf({ iconData, altText, color, isLocked, isSelected, isDim, side }: ChoiceHalfProps) {
  const filter = isLocked
    ? 'grayscale(1) brightness(0.3)'
    : isSelected
    ? `saturate(1.4) brightness(1.1) drop-shadow(0 0 4px ${color}AA)`
    : isDim
    ? 'grayscale(0.7) brightness(0.5)'
    : 'saturate(0.9) brightness(0.85)';
  const opacity = isLocked ? 0.5 : isDim ? 0.45 : 1;
  return (
    <div
      className="relative h-full overflow-hidden"
      style={{ width: '50%' }}
    >
      {iconData.type === 'sprite' ? (
        <div
          className="absolute top-0 h-full"
          style={{
            width: '200%',
            left: side === 'left' ? 0 : '-100%',
            backgroundImage: iconData.backgroundImage,
            backgroundPosition: iconData.backgroundPosition,
            backgroundSize: iconData.backgroundSize,
            backgroundRepeat: 'no-repeat',
            filter,
            opacity,
            transition: 'filter 0.25s, opacity 0.25s',
          }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
          style={{
            color: isSelected ? color : '#555',
            background: 'rgba(0,0,0,0.25)',
            opacity,
          }}
        >
          {altText.split(' ').map(w => w[0]).join('').slice(0, 2)}
        </div>
      )}
    </div>
  );
}

// ── WoW-style tooltip ─────────────────────────────────────────────────────────

interface WowTooltipProps {
  node: TalentNode;
  state: NodeState;
  color: string;
  treeSide: 'class' | 'spec';
  allNodes: TalentNode[];
  selectedOptionId?: string;
  getNodeState: (id: string) => NodeState;
  /** Current cursor viewport coords; tooltip follows this and arrow points at it. */
  mousePos: { x: number; y: number };
}

// ── Section color map ────────────────────────────────────────────────────────
// Default foreground colors for each semantic section kind.
// Per-span color overrides from |cRRGGBB| tags are applied on top of these.
const SECTION_COLORS: Record<SectionKind, string> = {
  'unlock-header': '#66ddff',
  'resource':      '#d8d8f0',
  'cast-time':     '#c8c8dc',
  'cooldown':      '#ffffff',
  'description':   '#d2d2df',
  'spell-header':  '#ffffff',
  'divider':       'transparent',
  'shift-hint':    '#00ddff',
  'junk':          'transparent',
};

/** Render a sequence of TextSpans, applying per-span color overrides. */
function SpanText({ spans, defaultColor }: { spans: { text: string; color?: string }[]; defaultColor: string }) {
  return (
    <>
      {spans.map((span, i) =>
        span.color
          ? <span key={i} style={{ color: span.color }}>{span.text}</span>
          : <span key={i} style={{ color: defaultColor }}>{span.text}</span>
      )}
    </>
  );
}

function WowTooltip({ node, state, color, treeSide, allNodes, getNodeState, selectedOptionId, mousePos }: WowTooltipProps) {
  const { status, currentPoints } = state;
  const isLocked      = status === 'locked';
  const isMaxed       = status === 'maxed';
  const isActive      = status === 'active';
  const isChoice      = node.type === 'choice';
  const isAutoGranted = !!node.autoGranted;
  const shiftHeld     = useShiftKey();

  const AG_COLOR = '#00e5cc';
  const tooltipColor = isAutoGranted ? AG_COLOR : color;

  // Show all prereq names (OR logic — any one satisfies).
  const prereqNames = node.prerequisites
    .map(pid => allNodes.find(n => n.id === pid)?.name)
    .filter((n): n is string => Boolean(n));

  const selectedOption = isChoice
    ? (node.options ?? []).find(o => o.id === selectedOptionId)
    : undefined;

  // Parse the raw description through the WoW markup parser.
  const parsed = useMemo(() => parseWowTooltip(node.description), [node.description]);
  const parsedExpanded = useMemo(
    () => node.expandedDescription != null ? parseWowTooltip(node.expandedDescription) : null,
    [node.expandedDescription],
  );

  // Separate metadata sections (resource/cast/cooldown) from description body.
  const metaSections = parsed.sections.filter(s =>
    s.kind === 'unlock-header' || s.kind === 'resource' || s.kind === 'cast-time' || s.kind === 'cooldown'
  );
  const bodySections = parsed.sections.filter(s =>
    s.kind !== 'unlock-header' && s.kind !== 'resource' && s.kind !== 'cast-time' && s.kind !== 'cooldown'
  );

  // Expanded description body (Shift-held). If the field is an empty string we
  // render a scaffold block so the slot is visible during content authoring.
  const expandedBodySections = parsedExpanded
    ? parsedExpanded.sections.filter(s =>
        s.kind !== 'unlock-header' && s.kind !== 'resource' && s.kind !== 'cast-time' && s.kind !== 'cooldown'
      )
    : null;
  const hasExpandedContent = node.expandedDescription != null;  // field exists (even if empty)

  // The tooltip is rendered via a portal to document.body so that
  // `position: fixed` resolves against the viewport — it would otherwise be
  // anchored to the CSS-transformed ScaleStage ancestor and drift.
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 306, h: 0 });

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width !== dims.w || r.height !== dims.h) {
      setDims({ w: r.width, h: r.height });
    }
  });

  const margin = 8;
  const cursorOffset = 14;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
  const w = dims.w;
  const h = dims.h;

  let placement: 'top' | 'bottom' = 'top';
  let top = mousePos.y - h - cursorOffset;
  if (top < margin) {
    placement = 'bottom';
    top = mousePos.y + cursorOffset;
  }
  if (top + h > vh - margin) top = Math.max(margin, vh - margin - h);

  let left = mousePos.x - w / 2;
  if (left < margin) left = margin;
  else if (left + w > vw - margin) left = vw - margin - w;

  const arrowX = Math.max(10, Math.min(w - 10, mousePos.x - left));
  const isTop = placement === 'top';

  // ── auto-passive description helpers ─────────────────────────────────────
  const agDescription = bodySections
    .filter(s => s.kind === 'description')
    .map(s => s.raw)
    .join(' ')
    .replace(/\bLevel:\s*\d+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const agTeachesAbility = /teaches you|grants you|learn /i.test(agDescription);
  const agAbilityNameMatch = agDescription.match(/(?:teaches|grants) you ([^.]+)\./i);
  const agAbilityName = agAbilityNameMatch ? agAbilityNameMatch[1].trim() : null;
  const agNodeTypeLabel = agTeachesAbility ? 'Ability' : 'Passive';

  return createPortal(
    <motion.div
      ref={tooltipRef}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.12 }}
      className="fixed z-[100] pointer-events-none w-[306px]"
      style={{
        left,
        top,
        visibility: h === 0 ? 'hidden' : 'visible',
      }}
    >
      {/* Main panel */}
      <div
        className="rounded-md overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #171421 0%, #090813 100%)',
          border: `1px solid ${tooltipColor}55`,
          boxShadow: `0 12px 38px rgba(0,0,0,0.9), 0 0 0 1px ${tooltipColor}18, 0 0 24px ${tooltipColor}18`,
        }}
      >
        {/* Title bar */}
        <div
          className="px-3.5 pt-3 pb-2.5"
          style={{
            background: `linear-gradient(90deg, ${tooltipColor}18 0%, ${tooltipColor}06 100%)`,
            borderBottom: `1px solid ${tooltipColor}30`,
          }}
        >
          {/* Talent name — gold, WoW style */}
          <div
            className="text-[15px] font-bold leading-snug tracking-wide"
            style={{ color: '#ffd100', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            {node.name}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {isAutoGranted ? (
              <>
                <span
                  className="text-[9px] uppercase tracking-[0.15em] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: `${AG_COLOR}22`,
                    color: AG_COLOR,
                    border: `1px solid ${AG_COLOR}44`,
                  }}
                >
                  auto-passive
                </span>
                {node.unlockAt !== undefined && (
                  <span className="text-[10px]" style={{ color: '#e07820' }}>
                    Requires Level {node.unlockAt}
                  </span>
                )}
              </>
            ) : (
              <>
                <span
                  className="text-[9px] uppercase tracking-[0.15em] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: `${color}22`,
                    color: `${color}CC`,
                    border: `1px solid ${color}33`,
                  }}
                >
                  {node.type}
                </span>
                <span className="text-[10px]" style={{ color: '#a8a8bd' }}>
                  Rank {currentPoints} / {node.maxPoints}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-3.5 py-2.5 space-y-0">

          {/* ── AUTO-PASSIVE branch: clean minimal layout ── */}
          {isAutoGranted ? (
            <>
              <div className="text-[11px] font-semibold mb-1.5" style={{ color: `${AG_COLOR}CC` }}>
                Level {node.unlockAt ?? '?'} {agNodeTypeLabel}
              </div>

              {agDescription && !agTeachesAbility && (
                <p className="text-[12px] leading-relaxed" style={{ color: '#c8c8d8' }}>
                  {agDescription}
                </p>
              )}

              {agTeachesAbility && (
                <>
                  <p className="text-[12px] leading-relaxed mb-2" style={{ color: '#c8c8d8' }}>
                    Teaches you {agAbilityName ?? node.name}.
                  </p>
                  <div
                    className="my-2"
                    style={{
                      height: 1,
                      background: `linear-gradient(90deg, transparent 0%, ${AG_COLOR}44 20%, ${AG_COLOR}44 80%, transparent 100%)`,
                    }}
                  />
                  <div className="flex items-start gap-2">
                    <div
                      className="flex-none rounded"
                      style={{
                        width: 36, height: 36,
                        background: `${AG_COLOR}18`,
                        border: `1px solid ${AG_COLOR}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <span className="text-[10px] font-bold" style={{ color: `${AG_COLOR}AA` }}>
                        {(agAbilityName ?? node.name).split(' ').map((w: string) => w[0]).join('').slice(0, 3)}
                      </span>
                    </div>
                    <div>
                      <div className="text-[12px] font-bold leading-tight mb-0.5" style={{ color: '#ffd100' }}>
                        {agAbilityName ?? node.name}
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: '#c8c8d8' }}>
                        {agDescription}
                      </p>
                    </div>
                  </div>
                </>
              )}

            </>
          ) : (
            <>
              {/* ── Normal node: requirement block ── */}
              {(() => {
                const pos = node.position as { gridRow?: number };
                const rowIdx = (pos.gridRow != null && pos.gridRow >= 1) ? pos.gridRow : 1;
                const rowLvl = getRowLevelReq(rowIdx, treeSide);
                const essenceName = treeSide === 'class' ? 'Ability Essence in class tree' : 'Talent Essence in spec tree';
                const hasReqs = rowLvl > 1
                  || (node.requiredLevel != null && node.requiredLevel > 0)
                  || metaSections.length > 0
                  || (node.reqTabPoints != null && node.reqTabPoints > 0)
                  || prereqNames.length > 0;
                if (!hasReqs) return null;
                return (
                  <div className="pb-1.5 mb-1" style={{ borderBottom: `1px solid ${tooltipColor}1a` }}>
                    {rowLvl > 1 && (
                      <div className="text-[11px] leading-snug py-px" style={{ color: '#ff4040' }}>
                        Requires Level {rowLvl}
                      </div>
                    )}
                    {node.requiredLevel != null && node.requiredLevel > 0 && node.requiredLevel !== rowLvl && (
                      <div className="text-[11px] leading-snug py-px" style={{ color: '#ff4040' }}>
                        Requires Level {node.requiredLevel}
                      </div>
                    )}
                    {metaSections.map((sec, idx) => (
                      <div key={idx} className="text-[11px] leading-snug py-px">
                        <SpanText spans={sec.spans} defaultColor={SECTION_COLORS[sec.kind]} />
                      </div>
                    ))}
                    {node.reqTabPoints != null && node.reqTabPoints > 0 ? (
                      <div className="text-[11px] leading-snug py-px" style={{ color: '#ff8040' }}>
                        requires {node.reqTabPoints} {essenceName}
                        {prereqNames.length > 0 && (
                          <span>; requires one connected node: {prereqNames.join(' or ')}</span>
                        )}
                      </div>
                    ) : prereqNames.length > 0 ? (
                      <div className="text-[11px] leading-snug py-px" style={{ color: '#ff8040' }}>
                        requires one connected node: {prereqNames.join(' or ')}
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {/* Body: description / spell-headers / dividers / shift-hint */}
              {bodySections.length > 0 && (
                <div className="py-1.5 space-y-0">
                  {bodySections.map((sec, idx) => {
                    if (sec.kind === 'divider') {
                      return (
                        <div
                          key={idx}
                          className="my-2"
                          style={{
                            height: 1,
                            background: `linear-gradient(90deg, transparent 0%, ${color}44 20%, ${color}44 80%, transparent 100%)`,
                          }}
                        />
                      );
                    }
                    if (sec.kind === 'spell-header') {
                      return (
                        <div key={idx} className="text-[12px] font-bold leading-snug py-0.5">
                          <SpanText spans={sec.spans} defaultColor={SECTION_COLORS['spell-header']} />
                        </div>
                      );
                    }
                    if (sec.kind === 'shift-hint') {
                      return (
                        <div key={idx} className="text-[10px] leading-snug italic mt-1" style={{ color: SECTION_COLORS['shift-hint'] }}>
                          <SpanText spans={sec.spans} defaultColor={SECTION_COLORS['shift-hint']} />
                        </div>
                      );
                    }
                    const prevSec = bodySections[idx - 1];
                    const addTopGap = idx > 0 && prevSec?.kind !== 'description' && prevSec?.kind !== 'divider';
                    return (
                      <div
                        key={idx}
                        className="text-[12px] leading-[1.6]"
                        style={{ color: SECTION_COLORS['description'], marginTop: addTopGap ? 6 : 2 }}
                      >
                        <SpanText spans={sec.spans} defaultColor={SECTION_COLORS['description']} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Choice node */}
              {isChoice && node.options && node.options.length === 2 && (
                <div className="pt-1.5 mt-0.5 space-y-2 border-t" style={{ borderColor: `${color}22` }}>
                  {node.options.map((opt, i) => {
                    const isSelected = opt.id === selectedOptionId;
                    const optParsed = parseWowTooltip(opt.description ?? '');
                    const optDesc = optParsed.sections
                      .filter(s => s.kind === 'description')
                      .map(s => s.raw)
                      .join(' ');
                    return (
                      <div
                        key={opt.id}
                        className="text-[11px] leading-snug px-2.5 py-2 rounded"
                        style={{
                          color: isSelected ? '#fff' : '#7a7a90',
                          background: isSelected ? `${color}22` : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isSelected ? `${color}66` : '#252535'}`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="text-[8px] font-bold uppercase tracking-wider px-1 py-px rounded"
                            style={{
                              color: isSelected ? color : '#55556a',
                              background: isSelected ? `${color}11` : 'transparent',
                              border: `1px solid ${isSelected ? `${color}44` : '#252535'}`,
                            }}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="font-bold" style={{ color: isSelected ? '#ffd100' : '#7a7a90' }}>
                            {opt.name}
                          </span>
                          {isSelected && (
                            <span className="ml-auto text-[8px]" style={{ color: `${color}AA` }}>● selected</span>
                          )}
                        </div>
                        {optDesc && (
                          <div className="mt-0.5" style={{ color: isSelected ? '#c8c8d8' : '#55556a' }}>
                            {optDesc}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {currentPoints > 0 && (
                    <p className="text-[10px] italic pt-0.5" style={{ color: `${color}99` }}>
                      Click to switch between options
                    </p>
                  )}
                </div>
              )}

              {/* Selected option summary */}
              {isChoice && selectedOption && !isLocked && (
                <div
                  className="text-[11px] leading-relaxed px-2.5 py-2 mt-1 rounded font-bold"
                  style={{ color, background: `${color}10`, border: `1px solid ${color}33` }}
                >
                  Active: {selectedOption.name}
                </div>
              )}

              {/* Advanced Details (Shift-held) */}
              {shiftHeld && (() => {
                const pos = node.position as { x: number; y: number; gridRow?: number; gridColumn?: number };
                const row = pos.gridRow ?? null;
                const col = pos.gridColumn ?? null;
                const essenceType = (() => {
                  const idStr = String(node.id);
                  if (idStr.includes('_l_') || idStr.includes('class')) return 'AE';
                  if (idStr.includes('_r_') || idStr.includes('spec'))  return 'TE';
                  return '—';
                })();
                const flags: string[] = [];
                if (isChoice)         flags.push('choice');
                if (node.type === 'capstone') flags.push('capstone');
                if (node.maxPoints > 1)       flags.push(`multi-rank (×${node.maxPoints})`);
                if (node.prerequisites.length === 0) flags.push('no prereqs');

                type Row = { label: string; value: string };
                const rows: Row[] = [
                  { label: 'Node ID',    value: String(node.id) },
                  { label: 'Type',       value: node.type },
                  { label: 'Essence',    value: essenceType },
                  { label: 'Max Rank',   value: String(node.maxPoints) },
                  { label: 'Row',        value: row != null ? String(row) : '—' },
                  { label: 'Col',        value: col != null ? String(col) : '—' },
                  { label: 'Prereqs',    value: node.prerequisites.length > 0
                    ? `${node.prerequisites.length} (OR logic)` : 'none' },
                  { label: 'Mode',       value: node.prerequisites.length > 1 ? 'OR' : node.prerequisites.length === 1 ? 'Single' : '—' },
                ];
                if (flags.length > 0) rows.push({ label: 'Flags', value: flags.join(', ') });

                return (
                  <div
                    className="mt-2 rounded overflow-hidden"
                    style={{ background: 'rgba(0,200,220,0.04)', border: '1px solid rgba(0,200,220,0.18)' }}
                  >
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1.5"
                      style={{ borderBottom: '1px solid rgba(0,200,220,0.14)', background: 'rgba(0,200,220,0.07)' }}
                    >
                      <div className="w-1 h-1 rounded-full" style={{ background: '#00cce8' }} />
                      <span className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: '#00cce8' }}>
                        Advanced Details
                      </span>
                    </div>
                    <div className="px-2.5 py-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {rows.map(({ label, value }) => (
                        <React.Fragment key={label}>
                          <span className="text-[9px] uppercase tracking-wide" style={{ color: '#4a6070' }}>{label}</span>
                          <span className="text-[9px] font-mono text-right" style={{ color: '#9ab8c8' }}>{value}</span>
                        </React.Fragment>
                      ))}
                    </div>
                    {expandedBodySections && expandedBodySections.length > 0 && (
                      <div className="px-2.5 pb-1.5 pt-0.5" style={{ borderTop: '1px solid rgba(0,200,220,0.10)' }}>
                        {expandedBodySections.map((sec, idx) => (
                          sec.kind === 'divider'
                            ? <div key={idx} className="my-1" style={{ height: 1, background: 'rgba(0,200,220,0.18)' }} />
                            : <div key={idx} className="text-[10px] leading-[1.55]" style={{ color: '#8ab0c0', marginTop: idx > 0 ? 2 : 0 }}>
                                <SpanText spans={sec.spans} defaultColor="#8ab0c0" />
                              </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Hint text */}
              <p className="text-[10px] pt-2 mt-1 border-t" style={{ color: '#5a5a70', borderColor: `${tooltipColor}18` }}>
                {isLocked
                  ? 'Complete prerequisites to unlock'
                  : isChoice && currentPoints > 0
                  ? 'Left-click to switch · Right-click to refund'
                  : isChoice
                  ? 'Left-click to spend 1 point and pick option A'
                  : isMaxed
                  ? 'Right-click to refund'
                  : isActive
                  ? 'Left-click to add · Right-click to refund'
                  : 'Left-click to allocate a point'}
              </p>
              <p className="text-[9px] mt-0.5" style={{ color: shiftHeld ? '#00cce840' : '#2a5565' }}>
                {shiftHeld ? 'Release SHIFT to collapse' : 'HOLD SHIFT for more details'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Tooltip arrow */}
      <div
        className="absolute"
        style={{
          left: arrowX,
          ...(isTop ? { top: '100%' } : { bottom: '100%' }),
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          ...(isTop
            ? { borderTop: `7px solid ${color}50` }
            : { borderBottom: `7px solid ${color}50` }),
        }}
      />
    </motion.div>,
    document.body,
  );
}
