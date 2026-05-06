import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import type { TalentTree as TalentTreeType, TalentNode } from '@workspace/api-client-react';
import { validateTree } from '@/data/classes/validate';
import { getNodeIconUrl } from '@/data/classes/icons';
import { TIER_POINT_GATES, type NodeState } from '@/hooks/use-talent-tree';

interface DualTalentTreeProps {
  tree: TalentTreeType;
  side: 'left' | 'right';
  getNodeState: (nodeId: string) => NodeState;
  /** Returns the selected option id for a choice node, or undefined */
  getChoiceSelection: (nodeId: string) => string | undefined;
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string) => void;
  /** Points spent in this side's tree — drives tier-gate strip */
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
    <div className="flex flex-col items-center w-full h-full pt-6 px-2">
      <TreeLabel label={label} color={tree.color} />
      <div className="flex items-start gap-2">
        <TierGateStrip color={tree.color} sideSpent={sideSpent} side={side} />
        <SingleTree
          nodes={nodes}
          color={tree.color}
          sideSpent={sideSpent}
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
      className="mb-4 px-5 py-1.5 rounded text-[11px] font-bold uppercase tracking-[0.22em] relative overflow-hidden"
      style={{
        color,
        border: `1px solid ${color}40`,
        background: `linear-gradient(90deg, ${color}18 0%, ${color}08 100%)`,
        boxShadow: `0 0 20px ${color}18, inset 0 1px 0 ${color}20`,
      }}
    >
      {label}
    </div>
  );
}

// ── Tree gate strip ─────────────────────────────────────────────────────────

const TREE_GATE_ROWS = [
  { row: 5, required: 8 },
  { row: 6, required: 16 },
  { row: 7, required: 24 },
  { row: 8, required: 32 },
  { row: 9, required: 40 },
  { row: 10, required: 48 },
];

function TierGateStrip({ color, sideSpent, side }: { color: string; sideSpent: number; side: 'left' | 'right' }) {
  return (
    <div
      className="relative flex-none"
      style={{ width: 48, height: LATTICE_H }}
    >
      {TREE_GATE_ROWS.map(({ row, required }) => {
        // Gate line sits exactly halfway between the bottom of row (row-1) and top of row (row).
        const yAbove = latticeToPixel(row - 1, 1).y;
        const yBelow = latticeToPixel(row, 1).y;
        const y = (yAbove + yBelow) / 2;
        const met = sideSpent >= required;
        return (
          <div
            key={row}
            className="absolute flex items-center gap-1 text-[10px] font-mono font-bold whitespace-nowrap"
            style={{
              top: y,
              [side === 'left' ? 'right' : 'left']: 8,
              transform: 'translateY(-50%)',
              color: met ? color : '#3a3a4a',
              opacity: met ? 1 : 0.6,
              flexDirection: side === 'left' ? 'row' : 'row-reverse',
            }}
            title={`Spend ${Math.max(required - sideSpent, 0)} more points to unlock this row`}
          >
            {!met && <Lock className="w-2.5 h-2.5" />}
            <span>{required}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Single tree ───────────────────────────────────────────────────────────────

interface SingleTreeProps {
  nodes: TalentNode[];
  color: string;
  /** Points spent in THIS tree — drives per-row tier-gate dim treatment. */
  sideSpent: number;
  getNodeState: (nodeId: string) => NodeState;
  getChoiceSelection: (nodeId: string) => string | undefined;
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string) => void;
}

// ── Fixed lattice constants ──────────────────────────────────────────────────
// CoA trees are always a strict 10-row × 7-column occupancy matrix.
// Every node must have gridRow (1-10) and gridColumn (1-7) metadata.
// Empty lattice slots are just unoccupied cells — no inference needed.
const LATTICE_ROWS = 10;
const LATTICE_COLS = 7;
const CELL_W = 72;            // horizontal pitch per column (px)
const CELL_H = 70;            // vertical pitch per row (px)
const LATTICE_PAD_X = 36;     // left/right canvas inset before col 1
const LATTICE_PAD_Y = 40;     // top canvas inset before row 1
const SVG_PAD = 20;           // extra SVG overflow room for glows
const NODE_EDGE_PAD = 3;      // edge-attachment inset from node face

// Fixed canvas size — derived from lattice geometry, never from node positions.
const LATTICE_W = LATTICE_PAD_X * 2 + (LATTICE_COLS - 1) * CELL_W + CELL_W;
const LATTICE_H = LATTICE_PAD_Y * 2 + (LATTICE_ROWS - 1) * CELL_H + CELL_H;

/** Convert 1-based (row, col) lattice coords to pixel center. */
function latticeToPixel(row: number, col: number): { x: number; y: number } {
  return {
    x: LATTICE_PAD_X + (col - 1) * CELL_W,
    y: LATTICE_PAD_Y + (row - 1) * CELL_H,
  };
}

/** Resolve a node's pixel center, always preferring lattice coords. */
function nodePixelCenter(node: TalentNode): { x: number; y: number } {
  const lp = latticePosition(node);
  if (lp.gridRow && lp.gridColumn) {
    return latticeToPixel(lp.gridRow, lp.gridColumn);
  }
  // Graceful degradation: if lattice metadata is absent fall back to
  // the stored pixel position so nothing is silently dropped.
  return { x: node.position.x, y: node.position.y };
}

const TIER_HEIGHT = CELL_H;   // row-overlay height == cell pitch

function latticePosition(node: TalentNode): { gridRow?: number; gridColumn?: number } {
  return node.position as TalentNode['position'] & { gridRow?: number; gridColumn?: number };
}

function groupByTier(nodes: TalentNode[]): TalentNode[][] {
  // Strict lattice grouping: always use gridRow first.
  // Only fall back to y-proximity for nodes that genuinely lack gridRow metadata
  // (legacy imports / unresolved placeholders) so nothing is silently dropped.
  const tiers: TalentNode[][] = Array.from({ length: LATTICE_ROWS }, () => []);
  for (const n of nodes) {
    const lp = latticePosition(n);
    if (lp.gridRow && lp.gridRow >= 1 && lp.gridRow <= LATTICE_ROWS) {
      tiers[lp.gridRow - 1].push(n);
      continue;
    }
    // Degraded fallback: nearest lattice row center by y-distance.
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let r = 1; r <= LATTICE_ROWS; r++) {
      const rowY = latticeToPixel(r, 1).y;
      const d = Math.abs(rowY - n.position.y);
      if (d < bestDist) { bestDist = d; bestIdx = r - 1; }
    }
    tiers[bestIdx].push(n);
  }
  // Within each row sort by gridColumn (then x as tiebreak).
  for (const row of tiers) row.sort((a, b) => {
    const ac = latticePosition(a).gridColumn ?? 999;
    const bc = latticePosition(b).gridColumn ?? 999;
    return ac !== bc ? ac - bc : a.position.x - b.position.x;
  });
  return tiers;
}

function nodeRadius(node: TalentNode): number {
  return (node.type === 'choice' || node.type === 'capstone' ? CAPSTONE_SIZE : NODE_SIZE) / 2 + NODE_EDGE_PAD;
}

function edgePoint(from: { x: number; y: number }, to: { x: number; y: number }, node: TalentNode): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const radius = nodeRadius(node);
  return {
    x: from.x + (dx / length) * radius,
    y: from.y + (dy / length) * radius,
  };
}

function branchPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromNode: TalentNode,
  toNode: TalentNode,
): string {
  const fl = latticePosition(fromNode);
  const tl = latticePosition(toNode);
  const start = edgePoint(from, to, fromNode);
  const end = edgePoint(to, from, toNode);
  // Straight line: same column OR missing lattice metadata OR row-gap > 1
  // (long-range connections should not bezier-curve across rows).
  const rowDist = (fl.gridRow !== undefined && tl.gridRow !== undefined)
    ? Math.abs(tl.gridRow - fl.gridRow) : 0;
  const colDist = (fl.gridColumn !== undefined && tl.gridColumn !== undefined)
    ? Math.abs(tl.gridColumn - fl.gridColumn) : 0;
  const useCurve = rowDist === 1 && colDist > 0;
  if (!useCurve) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  // Elbow curve: exit vertically from source, arrive vertically at target.
  const midY = start.y + (end.y - start.y) * 0.5;
  return `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`;
}

function TreeGateBar({ color, sideSpent }: { color: string; sideSpent: number }) {
  return (
    <>
      {TREE_GATE_ROWS.map(({ row, required }) => {
        const yAbove = latticeToPixel(row - 1, 1).y;
        const yBelow = latticeToPixel(row, 1).y;
        const y = (yAbove + yBelow) / 2;
        const met = sideSpent >= required;
        return (
          <div
            key={row}
            className="absolute pointer-events-none"
            style={{
              left: 28,
              top: y,
              width: 96,
              height: 1,
              background: `linear-gradient(90deg, transparent 0%, ${met ? `${color}33` : 'rgba(255,70,70,0.24)'} 25%, ${met ? `${color}77` : 'rgba(255,70,70,0.5)'} 50%, ${met ? `${color}33` : 'rgba(255,70,70,0.24)'} 75%, transparent 100%)`,
              boxShadow: met ? `0 0 6px ${color}22` : '0 0 6px rgba(255,50,50,0.16)',
              opacity: met ? 0.48 : 0.72,
              zIndex: 2,
            }}
          />
        );
      })}
    </>
  );
}

function SingleTree({ nodes, color, sideSpent, getNodeState, getChoiceSelection, onNodeClick, onNodeContextMenu }: SingleTreeProps) {
  const tiers = useMemo(() => groupByTier(nodes), [nodes]);
  // Fixed canvas size from lattice geometry — never inferred from node positions.
  const width = LATTICE_W;
  const height = LATTICE_H;

  // ── Centers for SVG connection lines (pure lattice arithmetic) ───────────
  const [centers, setCenters] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Since node positions are now computed from fixed lattice coords
  // (nodePixelCenter), we can derive SVG connection centers directly from
  // lattice arithmetic rather than measuring DOM layout. This avoids the
  // offset-walk drift that can occur inside a CSS-transformed ScaleStage.
  useLayoutEffect(() => {
    const next = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      next.set(node.id, nodePixelCenter(node));
    }
    setCenters(next);
  }, [nodes]);

  const colorId = color.replace('#', '');

  return (
    <div className="relative" style={{ width, height }}>
      {/* SVG connection lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Glow filter for active lines */}
          <filter id={`line-glow-${colorId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feFlood floodColor={color} floodOpacity="0.6" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Dimmer glow for available lines */}
          <filter id={`line-dim-${colorId}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {nodes.map(node =>
          node.prerequisites.map(prereqId => {
            const prereq = nodes.find(n => n.id === prereqId);
            if (!prereq) return null;
            const a = centers.get(prereqId);
            const b = centers.get(node.id);
            if (!a || !b) return null;

            const prereqState = getNodeState(prereqId);
            const nodeState = getNodeState(node.id);
            const isMaxed = prereqState.status === 'maxed';
            const isActive = prereqState.status === 'active' || isMaxed;
            const isAvailable = nodeState.status === 'available';

            return (
              <g key={`${prereqId}-${node.id}`}>
                {/* Glow layer — only for active/maxed */}
                {isMaxed && (
                  <path
                    d={branchPath(a, b, prereq, node)}
                    fill="none"
                    stroke={color}
                    strokeWidth={8}
                    strokeOpacity={0.28}
                    filter={`url(#line-glow-${colorId})`}
                  />
                )}
                {isActive && !isMaxed && (
                  <path
                    d={branchPath(a, b, prereq, node)}
                    fill="none"
                    stroke={color}
                    strokeWidth={6}
                    strokeOpacity={0.24}
                    filter={`url(#line-dim-${colorId})`}
                  />
                )}
                {/* Main line */}
                <path
                  d={branchPath(a, b, prereq, node)}
                  fill="none"
                  stroke={
                    isMaxed ? color
                    : isActive ? `${color}CC`
                    : isAvailable ? `${color}88`
                    : '#5c5c72'
                  }
                  strokeWidth={isMaxed ? 3 : isActive ? 2.5 : 2}
                  strokeOpacity={isMaxed ? 1 : isActive ? 0.9 : isAvailable ? 0.72 : 0.56}
                  strokeDasharray={isActive ? undefined : '5 5'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })
        )}
      </svg>

      <TreeGateBar color={color} sideSpent={sideSpent} />

      {/* Lattice row overlays — one per lattice row, y derived from latticeToPixel. */}
      {Array.from({ length: LATTICE_ROWS }, (_, rowIdx) => {
        const rowGate = TIER_POINT_GATES[rowIdx] ?? 0;
        const rowLocked = sideSpent < rowGate;
        const rowCenterY = latticeToPixel(rowIdx + 1, 1).y;
        return (
        <div
          key={rowIdx}
          data-row-index={rowIdx + 1}
          data-row-locked={rowLocked || undefined}
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: rowCenterY,
            height: TIER_HEIGHT,
            transform: 'translateY(-50%)',
            // Subtle row-level dim only — individual locked nodes already dim
            // themselves to 0.35, so we keep this multiplier near 1 to avoid
            // an unreadable ~0.19 effective luminance.
            opacity: rowLocked ? 0.78 : 1,
            transition: 'opacity 0.25s ease',
          }}
        />
        );
      })}

      {nodes.map(node => {
        const state = getNodeState(node.id);
        const selectedOptionId = node.type === 'choice' ? getChoiceSelection(node.id) : undefined;
        const { x: px, y: py } = nodePixelCenter(node);
        return (
          <div
            key={node.id}
            className="absolute flex items-center justify-center"
            style={{
              left: px,
              top: py,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <TalentNodeComponent
              node={node}
              state={state}
              color={color}
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

const NODE_SIZE = 48;
const CAPSTONE_SIZE = 60;

interface TalentNodeComponentProps {
  node: TalentNode;
  state: NodeState;
  color: string;
  allNodes: TalentNode[];
  selectedOptionId?: string;
  getNodeState: (nodeId: string) => NodeState;
  onClick: () => void;
  onContextMenu: () => void;
}

function TalentNodeComponent({
  node, state, color, allNodes, selectedOptionId, getNodeState, onClick, onContextMenu,
}: TalentNodeComponentProps) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { status, currentPoints } = state;

  const isLocked    = status === 'locked';
  const isAvailable = status === 'available';
  const isActive    = status === 'active';
  const isMaxed     = status === 'maxed';

  const isChoice = node.type === 'choice';
  const isCapstone = node.type === 'capstone';
  const isLargeNode = isChoice || isCapstone;
  const isPlaceholder = node.id.includes('placeholder') || node.name.startsWith('Unresolved');
  const size = isLargeNode ? CAPSTONE_SIZE : NODE_SIZE;

  // For choice nodes, derive option-specific name/icon for the active half.
  const choiceOptions = isChoice ? node.options ?? [] : [];
  const selectedIdx = isChoice
    ? Math.max(0, choiceOptions.findIndex(o => o.id === selectedOptionId))
    : -1;
  const activeOption = isChoice && selectedIdx >= 0 ? choiceOptions[selectedIdx] : undefined;

  const iconUrl = isChoice
    ? getNodeIconUrl(node.id, activeOption?.name ?? choiceOptions[0]?.name ?? node.name, node.type, activeOption?.icon ?? node.icon)
    : getNodeIconUrl(node.id, node.name, node.type, node.icon);

  // Shape per spec: passives circle, actives rounded square, capstones circle, choices octagon
  const shapeStyle: React.CSSProperties =
    isCapstone
      ? { borderRadius: '50%' }
      : node.type === 'passive'
      ? { borderRadius: '50%' }
      : node.type === 'active'
      ? { borderRadius: '6px' }
      : { clipPath: 'polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)' };

  // State-derived visuals
  const borderColor =
    isMaxed     ? color
    : isActive  ? `${color}DD`
    : isAvailable ? `${color}77`
    : isPlaceholder ? `${color}66`
    : '#44445a';

  const boxShadow =
    isMaxed
      ? `0 0 0 1px ${color}44, 0 0 14px ${color}99, 0 0 40px ${color}44, inset 0 0 12px ${color}33`
      : isActive
      ? `0 0 0 1px ${color}33, 0 0 10px ${color}66, 0 0 24px ${color}22`
      : isAvailable
      ? `0 0 0 1px ${color}22, 0 0 6px ${color}33`
      : isPlaceholder
      ? `0 0 0 1px ${color}22, inset 0 0 10px ${color}18`
      : 'inset 0 0 8px rgba(255,255,255,0.04)';

  const bgStyle: React.CSSProperties = {
    background: isMaxed
      ? `radial-gradient(circle at 40% 35%, ${color}44 0%, ${color}18 50%, #0d0d18 100%)`
      : isActive
      ? `radial-gradient(circle at 40% 35%, ${color}28 0%, #0d0d18 100%)`
      : isPlaceholder
      ? `radial-gradient(circle at 40% 35%, ${color}1F 0%, #191927 62%, #0f0f1b 100%)`
      : `radial-gradient(circle at 40% 35%, #222232 0%, #10101c 100%)`,
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
      {/* Outer glow ring for maxed */}
      {isMaxed && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            ...shapeStyle,
            border: `1px solid ${color}`,
            boxShadow: `0 0 20px ${color}`,
          }}
        />
      )}

      <motion.div
        whileHover={!isLocked ? { scale: 1.12 } : {}}
        whileTap={!isLocked ? { scale: 0.88 } : {}}
        animate={isMaxed ? { scale: [1, 1.03, 1] } : {}}
        transition={isMaxed
          ? { duration: 2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
          : { type: 'spring', stiffness: 300 }
        }
        className="w-full h-full relative overflow-hidden cursor-pointer select-none"
        style={{
          ...shapeStyle,
          ...bgStyle,
          border: `2px solid ${borderColor}`,
          boxShadow,
          opacity: isLocked ? (isPlaceholder ? 0.72 : 0.58) : 1,
          transition: 'border-color 0.25s, box-shadow 0.25s, opacity 0.25s',
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
        ) : !imgError ? (
          <img
            src={iconUrl}
            alt={node.name}
            className="w-full h-full object-cover"
            style={{
              filter: isLocked
                ? `grayscale(1) brightness(${isPlaceholder ? 0.72 : 0.52})`
                : isMaxed
                ? `saturate(1.4) brightness(1.1) drop-shadow(0 0 4px ${color}88)`
                : isActive
                ? `saturate(1.1) brightness(0.95)`
                : 'saturate(0.8) brightness(0.78)',
              transition: 'filter 0.25s',
            }}
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : (
          /* Fallback: initials if image fails */
          <div
            className="w-full h-full flex items-center justify-center text-[10px] font-bold"
            style={{
              color: isLocked ? (isPlaceholder ? `${color}99` : '#77778c') : isMaxed ? color : isActive ? `${color}CC` : '#8a8aa0',
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
              background: `linear-gradient(135deg, ${color}18 0%, transparent 60%)`,
            }}
          />
        )}
      </motion.div>

      {/* Points pip — shown below node when not locked */}
      {!isLocked && (
        <div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-1.5 rounded-full select-none whitespace-nowrap"
          style={{
            background: isMaxed ? color : '#0d0d18',
            color: isMaxed ? '#000' : isActive ? color : '#55556a',
            border: `1px solid ${isMaxed ? color : isActive ? `${color}77` : '#252535'}`,
            lineHeight: '16px',
            minWidth: '28px',
            textAlign: 'center',
            boxShadow: isMaxed ? `0 0 6px ${color}88` : 'none',
          }}
        >
          {currentPoints}/{node.maxPoints}
        </div>
      )}

      {/* WoW-style tooltip — follows the cursor */}
      <AnimatePresence>
        {hovered && (
          <WowTooltip
            node={node}
            state={state}
            color={color}
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
        const url = getNodeIconUrl(`${nodeId}_${i}`, opt.name, nodeType);
        return (
          <ChoiceHalf
            key={opt.id}
            iconUrl={url}
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
  iconUrl: string;
  altText: string;
  color: string;
  isLocked: boolean;
  isSelected: boolean;
  isDim: boolean;
  side: 'left' | 'right';
}

function ChoiceHalf({ iconUrl, altText, color, isLocked, isSelected, isDim, side }: ChoiceHalfProps) {
  const [err, setErr] = useState(false);
  const filter = isLocked
    ? 'grayscale(1) brightness(0.3)'
    : isSelected
    ? `saturate(1.4) brightness(1.1) drop-shadow(0 0 4px ${color}AA)`
    : isDim
    ? 'grayscale(0.7) brightness(0.5)'
    : 'saturate(0.9) brightness(0.85)';
  const opacity = isLocked ? 0.5 : isDim ? 0.45 : 1;
  // Each half is 50% wide; we use background-image on the half itself so we can
  // position the SAME icon offset to "show" the appropriate half of a single icon.
  // For different per-option icons, we instead show the icon centered in the half.
  return (
    <div
      className="relative h-full overflow-hidden"
      style={{ width: '50%' }}
    >
      {!err ? (
        <img
          src={iconUrl}
          alt={altText}
          className="absolute top-0 h-full"
          style={{
            // Render the option icon at the full node size, but only the
            // appropriate half is visible thanks to the parent's overflow:hidden
            width: '200%',
            left: side === 'left' ? 0 : '-100%',
            objectFit: 'cover',
            filter,
            opacity,
            transition: 'filter 0.25s, opacity 0.25s',
          }}
          onError={() => setErr(true)}
          draggable={false}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
          style={{
            color: isSelected ? color : '#555',
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
  allNodes: TalentNode[];
  selectedOptionId?: string;
  getNodeState: (id: string) => NodeState;
  /** Current cursor viewport coords; tooltip follows this and arrow points at it. */
  mousePos: { x: number; y: number };
}

function cleanTooltipText(text: string): string {
  return text
    .replace(/\[?Interface\\[^)\]\s]+]?/gi, '')
    .replace(/\bInterface\\[^\s]+/gi, '')
    .replace(/\b[A-Z][A-Za-z]+_[A-Za-z0-9_]+\b/g, '')
    .replace(/\b[a-z0-9-]+_(class|spec|left|right|l|r|sb)_[a-z0-9_-]+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTooltipText(text: string): string[] {
  const cleaned = cleanTooltipText(text);
  if (!cleaned) return [];
  return cleaned
    .replace(/\s+(?=(?:\d+\s+(?:Mana|Energy|Rage|Focus|Runic Power)|Instant cast|Channeled|Passive|Melee Range|Ranged Range|Requires|Cooldown|Recharge|Charges)\b)/gi, '\n')
    .replace(/\s+(?=(?:\d+(?:\.\d+)?\s*(?:sec|min)\s+(?:cooldown|recharge)|\d+\s+Charges?)\b)/gi, '\n')
    .replace(/\.\s+(?=[A-Z])/g, '.\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function tooltipLineKind(line: string): 'resource' | 'cast' | 'timing' | 'requirement' | 'description' {
  if (/^\d+\s+(Mana|Energy|Rage|Focus|Runic Power)\b/i.test(line)) return 'resource';
  if (/^(Instant cast|Channeled|Passive|Melee Range|Ranged Range)\b/i.test(line)) return 'cast';
  if (/(cooldown|recharge|charges?)\b/i.test(line)) return 'timing';
  if (/^(Requires|Spend|Unlocks)\b/i.test(line)) return 'requirement';
  return 'description';
}

function WowTooltip({ node, state, color, allNodes, getNodeState, selectedOptionId, mousePos }: WowTooltipProps) {
  const { status, currentPoints, lockReason, tierGateRequired, sideSpent } = state;
  const isLocked  = status === 'locked';
  const isMaxed   = status === 'maxed';
  const isActive  = status === 'active';
  const isChoice  = node.type === 'choice';

  // Prereqs need ALL (AND logic) to have ≥1 point — show ANY unmet
  const unmetPrereqs = node.prerequisites.filter(pid => {
    const pNode = allNodes.find(n => n.id === pid);
    if (!pNode) return false;
    const pState = getNodeState(pid);
    return pState.currentPoints === 0;
  });
  const hasUnmetPrereqs = unmetPrereqs.length > 0;

  const prereqNames = unmetPrereqs
    .map(pid => allNodes.find(n => n.id === pid)?.name)
    .filter(Boolean);

  const selectedOption = isChoice
    ? (node.options ?? []).find(o => o.id === selectedOptionId)
    : undefined;
  const descriptionLines = formatTooltipText(node.description);

  // The tooltip is rendered via a portal to document.body so that
  // `position: fixed` resolves against the viewport — it would otherwise be
  // anchored to the CSS-transformed ScaleStage ancestor and drift.
  //
  // Layout strategy: cache the rendered tooltip dimensions in state, then
  // compute placement inline on every cursor move. The cursor sits at
  // (mousePos.x, mousePos.y); we place the tooltip so its arrow is centered
  // on that point. Vertical: prefer above cursor, flip below if it would clip
  // the top edge. Horizontal: center on cursor, then clamp into the viewport
  // — and decouple the arrow's x from the tooltip's x so the arrow always
  // points at the cursor even when the tooltip itself is clamped.
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 292, h: 0 });

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

  return createPortal(
    <motion.div
      ref={tooltipRef}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.12 }}
      className="fixed z-[100] pointer-events-none w-[292px]"
      style={{
        left,
        top,
        // Hide on the very first paint (before measure) to avoid a flash at
        // the cursor's top-left while h is still 0.
        visibility: h === 0 ? 'hidden' : 'visible',
      }}
    >
      {/* Main panel */}
      <div
        className="rounded-md overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #171421 0%, #090813 100%)',
          border: `1px solid ${color}55`,
          boxShadow: `0 12px 38px rgba(0,0,0,0.9), 0 0 0 1px ${color}18, 0 0 24px ${color}18`,
        }}
      >
        {/* Title bar */}
        <div
          className="px-3.5 pt-3 pb-2.5"
          style={{
            background: `linear-gradient(90deg, ${color}18 0%, ${color}06 100%)`,
            borderBottom: `1px solid ${color}30`,
          }}
        >
          {/* Talent name — gold, WoW style */}
          <div
            className="text-[15px] font-bold leading-snug tracking-wide"
            style={{ color: '#ffd100', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            {node.name}
          </div>
          {/* Type + rank */}
          <div className="flex items-center gap-2 mt-1.5">
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
          </div>
        </div>

        {/* Body */}
        <div className="px-3.5 py-3 space-y-3">
          {descriptionLines.length > 0 && (
            <div className="space-y-1.5">
              {descriptionLines.map((line, idx) => {
                const kind = tooltipLineKind(line);
                return (
                  <div
                    key={`${kind}-${idx}`}
                    className={kind === 'description' ? 'text-[12px] leading-[1.55]' : 'text-[11px] leading-snug'}
                    style={{
                      color:
                        kind === 'resource' ? '#d8d8ee'
                        : kind === 'cast' ? '#b8b8cc'
                        : kind === 'timing' ? '#a8a8bd'
                        : kind === 'requirement' ? '#ff7070'
                        : '#d2d2df',
                      marginTop: idx > 0 && kind === 'description' && tooltipLineKind(descriptionLines[idx - 1]) !== 'description' ? 8 : undefined,
                    }}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          )}

          {/* Choice node — show both options with selection state */}
          {isChoice && node.options && node.options.length === 2 && (
            <div className="pt-1 space-y-2 border-t" style={{ borderColor: `${color}22` }}>
              {node.options.map((opt, i) => {
                const isSelected = opt.id === selectedOptionId;
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
                    <div style={{ color: isSelected ? '#c8c8d8' : '#55556a' }}>
                      {opt.description}
                    </div>
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

          {/* Tier gate not met — red */}
          {isLocked && lockReason === 'tier' && tierGateRequired !== undefined && (
            <div
              className="text-[11px] leading-relaxed px-2.5 py-2 rounded"
              style={{
                color: '#ff5050',
                background: 'rgba(255,50,50,0.08)',
                border: '1px solid rgba(255,50,50,0.2)',
              }}
            >
              Spend <span className="font-bold">{Math.max(tierGateRequired - (sideSpent ?? 0), 0)}</span> more points in this tree to unlock this row
              {sideSpent !== undefined && (
                <span className="text-muted-foreground/80"> ({sideSpent}/{tierGateRequired})</span>
              )}
            </div>
          )}

          {/* Prereqs unmet — red. AND logic: lists every unmet prereq. */}
          {isLocked && lockReason === 'prereq' && hasUnmetPrereqs && prereqNames.length > 0 && (
            <div
              className="text-[11px] leading-relaxed px-2.5 py-2 rounded"
              style={{
                color: '#ff5050',
                background: 'rgba(255,50,50,0.08)',
                border: '1px solid rgba(255,50,50,0.2)',
              }}
            >
              <span className="font-bold">Requires</span>{' '}
              {node.prerequisites.length > 1
                ? `${prereqNames.join(' AND ')}`
                : `${prereqNames[0]}`}
            </div>
          )}

          {/* Selected option summary (when choice node has selection) */}
          {isChoice && selectedOption && !isLocked && (
            <div
              className="text-[11px] leading-relaxed px-2.5 py-2 rounded font-bold"
              style={{
                color,
                background: `${color}10`,
                border: `1px solid ${color}33`,
              }}
            >
              Active: {selectedOption.name}
            </div>
          )}

          {/* Hint text */}
          <p className="text-[10px] pt-1 border-t" style={{ color: '#5a5a70', borderColor: `${color}18` }}>
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
        </div>
      </div>

      {/* Tooltip arrow — always centered on the cursor's actual x. */}
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
