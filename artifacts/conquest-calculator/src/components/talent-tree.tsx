import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TalentTree as TalentTreeType, TalentNode } from '@workspace/api-client-react';
import { validateTree } from '@/data/classes/validate';
import { getNodeIconUrl, CLASS_BG_GRADIENT } from '@/data/classes/icons';

interface DualTalentTreeProps {
  tree: TalentTreeType;
  getNodeState: (nodeId: string) => { status: 'locked' | 'available' | 'active' | 'maxed'; currentPoints: number };
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string) => void;
}

const CANVAS_W = 480;
const CANVAS_H = 600;

export function TalentTree({ tree, getNodeState, onNodeClick, onNodeContextMenu }: DualTalentTreeProps) {
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

  const bg = CLASS_BG_GRADIENT[tree.classId] ?? 'radial-gradient(ellipse 90% 70% at 50% 0%, #0d0d14 0%, #050508 100%)';

  return (
    <div className="relative w-full h-full overflow-auto">
      {/* ── Background layer ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: bg }}
      />
      {/* Vignette + dark overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, transparent 0%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px',
        }}
      />

      {/* ── Trees ── */}
      <div className="relative flex items-start justify-center gap-10 px-6 py-6 min-w-max mx-auto">
        {/* Left tree */}
        <div className="flex flex-col items-center">
          <TreeLabel label={`Path of ${tree.class}`} color={tree.color} />
          <SingleTree
            nodes={tree.leftTree ?? []}
            color={tree.color}
            getNodeState={getNodeState}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
          />
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
          <TreeLabel label={`Mastery of ${tree.class}`} color={tree.color} />
          <SingleTree
            nodes={tree.rightTree ?? []}
            color={tree.color}
            getNodeState={getNodeState}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
          />
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

// ── Single tree ───────────────────────────────────────────────────────────────

interface SingleTreeProps {
  nodes: TalentNode[];
  color: string;
  getNodeState: (nodeId: string) => { status: 'locked' | 'available' | 'active' | 'maxed'; currentPoints: number };
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string) => void;
}

function SingleTree({ nodes, color, getNodeState, onNodeClick, onNodeContextMenu }: SingleTreeProps) {
  const { width, height } = useMemo(() => {
    if (!nodes.length) return { width: CANVAS_W, height: CANVAS_H };
    const xs = nodes.map(n => n.position.x);
    const ys = nodes.map(n => n.position.y);
    return {
      width: Math.max(...xs) + 130,
      height: Math.max(...ys) + 130,
    };
  }, [nodes]);

  const colorId = color.replace('#', '');

  return (
    <div className="relative" style={{ width, height }}>
      {/* SVG connection lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={width}
        height={height}
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

            const prereqState = getNodeState(prereqId);
            const nodeState = getNodeState(node.id);
            const isMaxed = prereqState.status === 'maxed';
            const isActive = prereqState.status === 'active' || isMaxed;
            const isAvailable = nodeState.status === 'available';

            const x1 = prereq.position.x;
            const y1 = prereq.position.y;
            const x2 = node.position.x;
            const y2 = node.position.y;

            return (
              <g key={`${prereqId}-${node.id}`}>
                {/* Glow layer — only for active/maxed */}
                {isMaxed && (
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={color}
                    strokeWidth={8}
                    strokeOpacity={0.2}
                    filter={`url(#line-glow-${colorId})`}
                  />
                )}
                {isActive && !isMaxed && (
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={color}
                    strokeWidth={5}
                    strokeOpacity={0.15}
                    filter={`url(#line-dim-${colorId})`}
                  />
                )}
                {/* Main line */}
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
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

      {/* Talent nodes */}
      {nodes.map(node => {
        const state = getNodeState(node.id);
        return (
          <TalentNodeComponent
            key={node.id}
            node={node}
            state={state}
            color={color}
            allNodes={nodes}
            getNodeState={getNodeState}
            onClick={() => onNodeClick(node.id)}
            onContextMenu={() => onNodeContextMenu(node.id)}
          />
        );
      })}
    </div>
  );
}

// ── Talent node ───────────────────────────────────────────────────────────────

const NODE_SIZE = 56;
const CAPSTONE_SIZE = 68;

interface TalentNodeComponentProps {
  node: TalentNode;
  state: { status: string; currentPoints: number };
  color: string;
  allNodes: TalentNode[];
  getNodeState: (nodeId: string) => { status: string; currentPoints: number };
  onClick: () => void;
  onContextMenu: () => void;
}

function TalentNodeComponent({
  node, state, color, allNodes, getNodeState, onClick, onContextMenu,
}: TalentNodeComponentProps) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { status, currentPoints } = state;

  const isLocked    = status === 'locked';
  const isAvailable = status === 'available';
  const isActive    = status === 'active';
  const isMaxed     = status === 'maxed';

  const isCapstone = node.type === 'choice' || node.type === 'capstone';
  const size = isCapstone ? CAPSTONE_SIZE : NODE_SIZE;

  const iconUrl = getNodeIconUrl(node.id, node.name, node.type);

  // Shape
  const shapeStyle: React.CSSProperties =
    isCapstone
      ? { borderRadius: '50%' }
      : node.type === 'passive'
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

  return (
    <div
      data-testid={`node-${node.id}`}
      className="absolute"
      style={{
        left: node.position.x,
        top: node.position.y,
        transform: 'translate(-50%, -50%)',
        width: size,
        height: size,
        zIndex: hovered ? 50 : 10,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); onContextMenu(); }}
    >
      {/* Outer glow ring for maxed */}
      {isMaxed && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            borderRadius: isCapstone ? '50%' : '8px',
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
        {/* Icon */}
        {!imgError ? (
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

      {/* WoW-style tooltip */}
      <AnimatePresence>
        {hovered && (
          <WowTooltip
            node={node}
            status={status}
            currentPoints={currentPoints}
            color={color}
            allNodes={allNodes}
            getNodeState={getNodeState}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── WoW-style tooltip ─────────────────────────────────────────────────────────

interface WowTooltipProps {
  node: TalentNode;
  status: string;
  currentPoints: number;
  color: string;
  allNodes: TalentNode[];
  getNodeState: (id: string) => { status: string; currentPoints: number };
}

function WowTooltip({ node, status, currentPoints, color, allNodes, getNodeState }: WowTooltipProps) {
  const isLocked  = status === 'locked';
  const isMaxed   = status === 'maxed';
  const isActive  = status === 'active';

  const unmetPrereqs = node.prerequisites.filter(pid => {
    const pNode = allNodes.find(n => n.id === pid);
    if (!pNode) return false;
    const pState = getNodeState(pid);
    return pState.status !== 'maxed';
  });

  const prereqNames = unmetPrereqs
    .map(pid => allNodes.find(n => n.id === pid)?.name)
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.94 }}
      transition={{ duration: 0.12 }}
      className="absolute z-50 pointer-events-none w-64"
      style={{
        bottom: 'calc(100% + 14px)',
        left: '50%',
        transform: 'translateX(-50%)',
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

          {/* Unmet requirements — red */}
          {isLocked && prereqNames.length > 0 && (
            <div
              className="text-[10px] leading-snug px-2 py-1.5 rounded"
              style={{
                color: '#ff5050',
                background: 'rgba(255,50,50,0.08)',
                border: '1px solid rgba(255,50,50,0.2)',
              }}
            >
              <span className="font-bold">Requires:</span>{' '}
              {prereqNames.join(', ')} (maxed)
            </div>
          )}

          {/* Hint text */}
          <p className="text-[10px]" style={{ color: '#44445a' }}>
            {isMaxed
              ? '⌘ Right-click to refund'
              : isActive
              ? 'Left-click to add · Right-click to refund'
              : isLocked
              ? 'Complete prerequisites to unlock'
              : 'Left-click to allocate a point'}
          </p>
        </div>
      </div>

      {/* Tooltip arrow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-full"
        style={{
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: `7px solid ${color}50`,
        }}
      />
    </motion.div>
  );
}
