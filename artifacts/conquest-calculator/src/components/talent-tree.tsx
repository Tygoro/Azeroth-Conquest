import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import type { TalentTree as TalentTreeType, TalentNode } from '@workspace/api-client-react';
import { validateTree } from '@/data/classes/validate';
import { getNodeIconUrl } from '@/data/classes/icons';
import { TIER_POINT_GATES, TIER_Y_VALUES, type NodeState } from '@/hooks/use-talent-tree';

interface DualTalentTreeProps {
  tree: TalentTreeType;
  getNodeState: (nodeId: string) => NodeState;
  /** Returns the selected option id for a choice node, or undefined */
  getChoiceSelection: (nodeId: string) => string | undefined;
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string) => void;
  /** Per-side spent points — used to render the tier-gate indicator strip */
  leftSpent: number;
  rightSpent: number;
}

const CANVAS_W = 480;
const CANVAS_H = 740;

export function TalentTree({
  tree,
  getNodeState,
  getChoiceSelection,
  onNodeClick,
  onNodeContextMenu,
  leftSpent,
  rightSpent,
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

  return (
    <div className="relative w-full h-full flex items-start justify-center gap-6 px-4 py-6">
      {/* Left tree */}
      <div className="flex flex-col items-center">
        <TreeLabel label={tree.leftTreeName ?? `Path of ${tree.class}`} color={tree.color} />
        <div className="flex items-start">
          <TierGateStrip color={tree.color} sideSpent={leftSpent} side="left" />
          <SingleTree
            nodes={tree.leftTree ?? []}
            color={tree.color}
            sideSpent={leftSpent}
            getNodeState={getNodeState}
            getChoiceSelection={getChoiceSelection}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
          />
        </div>
      </div>

      {/* Center divider */}
      <div className="flex flex-col items-center self-stretch mt-12 mx-2">
        {/* Class emblem */}
        <div
          className="w-10 h-10 rounded-full flex-none mb-2 flex items-center justify-center text-[9px] font-bold tracking-wider"
          style={{
            background: `radial-gradient(circle, ${tree.color}22 0%, transparent 70%)`,
            border: `1px solid ${tree.color}44`,
            color: `${tree.color}99`,
            boxShadow: `0 0 12px ${tree.color}22`,
          }}
        >
          {tree.class.slice(0, 2).toUpperCase()}
        </div>
        <div
          className="flex-1 w-px"
          style={{ background: `linear-gradient(to bottom, ${tree.color}55, transparent)` }}
        />
      </div>

      {/* Right tree */}
      <div className="flex flex-col items-center">
        <TreeLabel label={tree.rightTreeName ?? `Mastery of ${tree.class}`} color={tree.color} />
        <div className="flex items-start">
          <SingleTree
            nodes={tree.rightTree ?? []}
            color={tree.color}
            sideSpent={rightSpent}
            getNodeState={getNodeState}
            getChoiceSelection={getChoiceSelection}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
          />
          <TierGateStrip color={tree.color} sideSpent={rightSpent} side="right" />
        </div>
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

// ── Tier-gate strip (Dragonflight-style point requirement column) ──────────

function TierGateStrip({ color, sideSpent, side }: { color: string; sideSpent: number; side: 'left' | 'right' }) {
  return (
    <div
      className="relative flex-none"
      style={{ width: 36, height: TIER_Y_VALUES[TIER_Y_VALUES.length - 1] + 60 }}
    >
      {TIER_Y_VALUES.map((y, idx) => {
        const gate = TIER_POINT_GATES[idx] ?? 0;
        const met = sideSpent >= gate;
        // Hide the "0 pts" label for tier 0 — visual noise
        if (gate === 0) return null;
        return (
          <div
            key={idx}
            className="absolute flex items-center gap-1 text-[10px] font-mono font-bold whitespace-nowrap"
            style={{
              top: y,
              [side === 'left' ? 'right' : 'left']: 4,
              transform: 'translateY(-50%)',
              color: met ? color : '#3a3a4a',
              opacity: met ? 1 : 0.6,
              flexDirection: side === 'left' ? 'row' : 'row-reverse',
            }}
            title={`Tier ${idx + 1}: ${gate} points required in this tree (${sideSpent}/${gate})`}
          >
            {!met && <Lock className="w-2.5 h-2.5" />}
            <span>{gate}</span>
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

// ── Layout constants ─────────────────────────────────────────────────────────
// Per-spec row counts come from the backend (driven by TREE_ROWS in
// api-server/src/data/tree-rows.ts). Here we just group nodes by tier and
// render each tier as a flex row — no fixed grid columns.
//
// Each row is absolute-positioned so its center y matches `TIER_Y_VALUES[i]`,
// keeping the tier-gate strip and the gating logic in `use-talent-tree.ts`
// visually consistent with the rendered nodes.
const NODE_GAP = 14;          // horizontal gap inside a row
const ROW_PAD_X = 16;         // inner horizontal padding so the widest row doesn't kiss the edge
const TIER_HEIGHT = 60;       // row height (capstones are 60px, regular 48px — use the larger)
const SVG_PAD = 24;           // padding around the SVG so glow doesn't clip
const NODE_MAX_W = 60;        // largest node footprint (capstones)

function groupByTier(nodes: TalentNode[]): TalentNode[][] {
  const tiers: TalentNode[][] = Array.from({ length: TIER_Y_VALUES.length }, () => []);
  for (const n of nodes) {
    // Match the node's y to the nearest tier (mirrors getTierIndex in use-talent-tree.ts).
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < TIER_Y_VALUES.length; i++) {
      const d = Math.abs(TIER_Y_VALUES[i] - n.position.y);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    tiers[bestIdx].push(n);
  }
  // Within a row, sort by source x so the in-game ordering is preserved.
  for (const row of tiers) row.sort((a, b) => a.position.x - b.position.x);
  return tiers;
}

function SingleTree({ nodes, color, sideSpent, getNodeState, getChoiceSelection, onNodeClick, onNodeContextMenu }: SingleTreeProps) {
  const tiers = useMemo(() => groupByTier(nodes), [nodes]);
  const maxCols = useMemo(() => tiers.reduce((m, r) => Math.max(m, r.length), 0), [tiers]);

  // Container width is driven by the widest row (no horizontal scroll).
  // Use the larger node size (60) so capstones never overflow.
  const width = Math.max(
    CANVAS_W,
    ROW_PAD_X * 2 + maxCols * NODE_MAX_W + Math.max(0, maxCols - 1) * NODE_GAP,
  );
  // Container height: enough to fit the deepest tier center + half a row + pad.
  const height = TIER_Y_VALUES[TIER_Y_VALUES.length - 1] + TIER_HEIGHT / 2 + SVG_PAD;

  // ── Refs / centers for SVG connection lines ────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement | null>());
  const [centers, setCenters] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Re-measure whenever the node set or container width changes. We use
  // `offsetLeft/offsetTop` (layout-space, untransformed coords) instead of
  // `getBoundingClientRect()` so that wrapping the tree in a CSS-transformed
  // ScaleStage doesn't drift line endpoints — the SVG is in the same
  // transformed subtree, so layout-space coords stay correct after scaling.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const next = new Map<string, { x: number; y: number }>();
      nodeRefs.current.forEach((el, id) => {
        if (!el) return;
        // Walk up offsetParent chain until we hit the SingleTree container.
        let x = 0;
        let y = 0;
        let cur: HTMLElement | null = el;
        while (cur && cur !== container) {
          x += cur.offsetLeft;
          y += cur.offsetTop;
          cur = cur.offsetParent as HTMLElement | null;
        }
        next.set(id, { x: x + el.offsetWidth / 2, y: y + el.offsetHeight / 2 });
      });
      setCenters(next);
    };
    measure();
    // Window resize covers ScaleStage transform updates (it's driven by
    // window resize via ResizeObserver on its own parent). A ResizeObserver
    // on the container catches direct layout changes (font load, etc.).
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [nodes, width]);

  const colorId = color.replace('#', '');

  return (
    <div ref={containerRef} className="relative" style={{ width, height }}>
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
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={color}
                    strokeWidth={8}
                    strokeOpacity={0.2}
                    filter={`url(#line-glow-${colorId})`}
                  />
                )}
                {isActive && !isMaxed && (
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={color}
                    strokeWidth={5}
                    strokeOpacity={0.15}
                    filter={`url(#line-dim-${colorId})`}
                  />
                )}
                {/* Main line */}
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={
                    isMaxed ? color
                    : isActive ? `${color}CC`
                    : isAvailable ? `${color}55`
                    : '#1e1e2e'
                  }
                  strokeWidth={isMaxed ? 2.5 : isActive ? 2 : 1.5}
                  strokeOpacity={isMaxed ? 1 : isActive ? 0.8 : isAvailable ? 0.5 : 0.3}
                  strokeDasharray={isActive ? undefined : '5 5'}
                  strokeLinecap="round"
                />
              </g>
            );
          })
        )}
      </svg>

      {/* One absolute-positioned flex row per tier — center y == TIER_Y_VALUES[i]
          so the tier-gate strip and gating logic in use-talent-tree.ts stay
          visually consistent with the rendered nodes. Locked rows (whose tier
          gate is not met by this tree's spent points) get a subtle row-level
          dim on top of the per-node lock styling. */}
      {tiers.map((row, rowIdx) => {
        const rowGate = TIER_POINT_GATES[rowIdx] ?? 0;
        const rowLocked = sideSpent < rowGate;
        return (
        <div
          key={rowIdx}
          data-row-index={rowIdx + 1}
          data-row-locked={rowLocked || undefined}
          className="absolute left-0 right-0 flex justify-center items-center"
          style={{
            top: TIER_Y_VALUES[rowIdx],
            height: TIER_HEIGHT,
            transform: 'translateY(-50%)',
            gap: NODE_GAP,
            paddingLeft: ROW_PAD_X,
            paddingRight: ROW_PAD_X,
            // Subtle row-level dim only — individual locked nodes already dim
            // themselves to 0.35, so we keep this multiplier near 1 to avoid
            // an unreadable ~0.19 effective luminance.
            opacity: rowLocked ? 0.78 : 1,
            transition: 'opacity 0.25s ease',
          }}
        >
          {row.map(node => {
            const state = getNodeState(node.id);
            const selectedOptionId = node.type === 'choice' ? getChoiceSelection(node.id) : undefined;
            return (
              <div
                key={node.id}
                ref={el => { nodeRefs.current.set(node.id, el); }}
                className="flex items-center justify-center"
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
  const size = isLargeNode ? CAPSTONE_SIZE : NODE_SIZE;

  // For choice nodes, derive option-specific name/icon for the active half.
  const choiceOptions = isChoice ? node.options ?? [] : [];
  const selectedIdx = isChoice
    ? Math.max(0, choiceOptions.findIndex(o => o.id === selectedOptionId))
    : -1;
  const activeOption = isChoice && selectedIdx >= 0 ? choiceOptions[selectedIdx] : undefined;

  const iconUrl = isChoice
    ? getNodeIconUrl(node.id, activeOption?.name ?? choiceOptions[0]?.name ?? node.name, node.type)
    : getNodeIconUrl(node.id, node.name, node.type);

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
    : '#252535';

  const boxShadow =
    isMaxed
      ? `0 0 0 1px ${color}44, 0 0 14px ${color}99, 0 0 40px ${color}44, inset 0 0 12px ${color}33`
      : isActive
      ? `0 0 0 1px ${color}33, 0 0 10px ${color}66, 0 0 24px ${color}22`
      : isAvailable
      ? `0 0 0 1px ${color}22, 0 0 6px ${color}33`
      : 'none';

  const bgStyle: React.CSSProperties = {
    background: isMaxed
      ? `radial-gradient(circle at 40% 35%, ${color}44 0%, ${color}18 50%, #0d0d18 100%)`
      : isActive
      ? `radial-gradient(circle at 40% 35%, ${color}28 0%, #0d0d18 100%)`
      : `radial-gradient(circle at 40% 35%, #14141f 0%, #0a0a14 100%)`,
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
          opacity: isLocked ? 0.35 : 1,
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
                ? 'grayscale(1) brightness(0.3)'
                : isMaxed
                ? `saturate(1.4) brightness(1.1) drop-shadow(0 0 4px ${color}88)`
                : isActive
                ? `saturate(1.1) brightness(0.95)`
                : 'saturate(0.7) brightness(0.6)',
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
              color: isLocked ? '#444' : isMaxed ? color : isActive ? `${color}CC` : '#555',
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
  const [dims, setDims] = useState({ w: 256, h: 0 });

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
      className="fixed z-[100] pointer-events-none w-64"
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
          background: 'linear-gradient(160deg, #12121e 0%, #0a0a16 100%)',
          border: `1px solid ${color}50`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.85), 0 0 0 1px ${color}18, 0 0 20px ${color}15`,
        }}
      >
        {/* Title bar */}
        <div
          className="px-3 pt-2.5 pb-2"
          style={{
            background: `linear-gradient(90deg, ${color}18 0%, ${color}06 100%)`,
            borderBottom: `1px solid ${color}30`,
          }}
        >
          {/* Talent name — gold, WoW style */}
          <div
            className="text-sm font-bold leading-tight tracking-wide"
            style={{ color: '#ffd100', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            {node.name}
          </div>
          {/* Type + rank */}
          <div className="flex items-center gap-2 mt-0.5">
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
            <span className="text-[10px] font-mono" style={{ color: '#9999b0' }}>
              {currentPoints} / {node.maxPoints} pts
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 space-y-2">
          {/* Description */}
          <p className="text-xs leading-relaxed" style={{ color: '#c8c8d8' }}>
            {node.description}
          </p>

          {/* Choice node — show both options with selection state */}
          {isChoice && node.options && node.options.length === 2 && (
            <div className="space-y-1.5">
              {node.options.map((opt, i) => {
                const isSelected = opt.id === selectedOptionId;
                return (
                  <div
                    key={opt.id}
                    className="text-[11px] leading-snug px-2 py-1.5 rounded"
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
                <p className="text-[10px] italic" style={{ color: `${color}99` }}>
                  Click to switch between options
                </p>
              )}
            </div>
          )}

          {/* Tier gate not met — red */}
          {isLocked && lockReason === 'tier' && tierGateRequired !== undefined && (
            <div
              className="text-[10px] leading-snug px-2 py-1.5 rounded"
              style={{
                color: '#ff5050',
                background: 'rgba(255,50,50,0.08)',
                border: '1px solid rgba(255,50,50,0.2)',
              }}
            >
              Requires <span className="font-bold">{tierGateRequired}</span> points in this tree
              {sideSpent !== undefined && (
                <span className="text-muted-foreground/80"> ({sideSpent}/{tierGateRequired})</span>
              )}
            </div>
          )}

          {/* Prereqs unmet — red. AND logic: lists every unmet prereq. */}
          {isLocked && lockReason === 'prereq' && hasUnmetPrereqs && prereqNames.length > 0 && (
            <div
              className="text-[10px] leading-snug px-2 py-1.5 rounded"
              style={{
                color: '#ff5050',
                background: 'rgba(255,50,50,0.08)',
                border: '1px solid rgba(255,50,50,0.2)',
              }}
            >
              <span className="font-bold">Requires:</span>{' '}
              {node.prerequisites.length > 1
                ? `${prereqNames.join(' AND ')}`
                : `${prereqNames[0]}`}
            </div>
          )}

          {/* Selected option summary (when choice node has selection) */}
          {isChoice && selectedOption && !isLocked && (
            <div
              className="text-[10px] leading-snug px-2 py-1.5 rounded font-bold"
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
          <p className="text-[10px]" style={{ color: '#44445a' }}>
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
