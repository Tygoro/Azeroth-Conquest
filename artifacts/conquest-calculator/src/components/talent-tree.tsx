import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TalentTree as TalentTreeType, TalentNode } from '@workspace/api-client-react';

interface DualTalentTreeProps {
  tree: TalentTreeType;
  getNodeState: (nodeId: string) => { status: 'locked' | 'available' | 'active' | 'maxed'; currentPoints: number };
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string) => void;
}

// Canvas dimensions per single tree
const CANVAS_W = 480;
const CANVAS_H = 600;

export function TalentTree({ tree, getNodeState, onNodeClick, onNodeContextMenu }: DualTalentTreeProps) {
  return (
    <div className="flex flex-col items-center w-full h-full overflow-auto">
      <div className="flex items-start justify-center gap-12 px-6 py-4 min-w-max">
        {/* Left tree label */}
        <div className="flex flex-col items-center">
          <div
            className="mb-3 text-xs font-bold uppercase tracking-[0.2em] px-4 py-1 rounded border"
            style={{ color: tree.color, borderColor: `${tree.color}55`, background: `${tree.color}11` }}
          >
            Path of {tree.class}
          </div>
          <SingleTree
            nodes={tree.leftTree ?? []}
            color={tree.color}
            getNodeState={getNodeState}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
          />
        </div>

        {/* Divider */}
        <div className="flex flex-col items-center self-stretch mt-10">
          <div className="flex-1 w-px" style={{ background: `linear-gradient(to bottom, transparent, ${tree.color}66, transparent)` }} />
        </div>

        {/* Right tree label */}
        <div className="flex flex-col items-center">
          <div
            className="mb-3 text-xs font-bold uppercase tracking-[0.2em] px-4 py-1 rounded border"
            style={{ color: tree.color, borderColor: `${tree.color}55`, background: `${tree.color}11` }}
          >
            Mastery of {tree.class}
          </div>
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

interface SingleTreeProps {
  nodes: TalentNode[];
  color: string;
  getNodeState: (nodeId: string) => { status: 'locked' | 'available' | 'active' | 'maxed'; currentPoints: number };
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string) => void;
}

function SingleTree({ nodes, color, getNodeState, onNodeClick, onNodeContextMenu }: SingleTreeProps) {
  // Compute bounding box so the canvas fits the content
  const { width, height } = useMemo(() => {
    if (!nodes.length) return { width: CANVAS_W, height: CANVAS_H };
    const xs = nodes.map(n => n.position.x);
    const ys = nodes.map(n => n.position.y);
    return {
      width: Math.max(...xs) + 120,
      height: Math.max(...ys) + 120,
    };
  }, [nodes]);

  return (
    <div
      className="relative"
      style={{ width, height }}
    >
      {/* SVG connection lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={width}
        height={height}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="glow-active" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-dim" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {nodes.map(node =>
          node.prerequisites.map(prereqId => {
            const prereq = nodes.find(n => n.id === prereqId);
            if (!prereq) return null;

            const prereqState = getNodeState(prereqId);
            const isActive = prereqState.status === 'maxed' || prereqState.status === 'active';
            const isMaxed = prereqState.status === 'maxed';

            const x1 = prereq.position.x;
            const y1 = prereq.position.y;
            const x2 = node.position.x;
            const y2 = node.position.y;

            // Mid-point for curved path
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;

            return (
              <g key={`${prereqId}-${node.id}`}>
                {/* Glow layer for active connections */}
                {isActive && (
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={color}
                    strokeWidth={6}
                    strokeOpacity={0.25}
                    filter="url(#glow-active)"
                  />
                )}
                {/* Main line */}
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isMaxed ? color : isActive ? `${color}BB` : '#2a2a3a'}
                  strokeWidth={isMaxed ? 3 : isActive ? 2 : 1.5}
                  strokeOpacity={isMaxed ? 1 : isActive ? 0.7 : 0.35}
                  strokeDasharray={isActive ? 'none' : '6 4'}
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
            onClick={() => onNodeClick(node.id)}
            onContextMenu={() => onNodeContextMenu(node.id)}
          />
        );
      })}
    </div>
  );
}

const NODE_SIZE = 52;

interface TalentNodeComponentProps {
  node: TalentNode;
  state: { status: string; currentPoints: number };
  color: string;
  onClick: () => void;
  onContextMenu: () => void;
}

function TalentNodeComponent({ node, state, color, onClick, onContextMenu }: TalentNodeComponentProps) {
  const [hovered, setHovered] = useState(false);
  const { status, currentPoints } = state;

  const isLocked = status === 'locked';
  const isAvailable = status === 'available';
  const isActive = status === 'active';
  const isMaxed = status === 'maxed';

  const borderColor = isMaxed
    ? color
    : isActive
    ? `${color}CC`
    : isAvailable
    ? `${color}66`
    : '#2a2a3a';

  const bgColor = isMaxed
    ? `${color}33`
    : isActive
    ? `${color}1A`
    : '#0d0d14';

  const glowColor = (isMaxed || isActive) ? color : 'transparent';

  // Shape: passive = rounded square, active = hex-like octagon, choice = circle
  const borderRadius =
    node.type === 'choice'
      ? '50%'
      : node.type === 'passive'
      ? '6px'
      : '4px';

  const clipStyle =
    node.type === 'active'
      ? { clipPath: 'polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)' }
      : {};

  return (
    <div
      data-testid={`node-${node.id}`}
      className="absolute"
      style={{
        left: node.position.x,
        top: node.position.y,
        transform: 'translate(-50%, -50%)',
        width: NODE_SIZE,
        height: NODE_SIZE,
        zIndex: hovered ? 50 : 10,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); onContextMenu(); }}
    >
      <motion.div
        whileHover={!isLocked ? { scale: 1.15 } : {}}
        whileTap={!isLocked ? { scale: 0.9 } : {}}
        animate={isMaxed ? { scale: [1, 1.05, 1] } : {}}
        transition={isMaxed ? { duration: 1.5, repeat: Infinity, repeatType: 'mirror' } : {}}
        className="w-full h-full flex items-center justify-center cursor-pointer relative"
        style={{
          borderRadius,
          ...clipStyle,
          background: bgColor,
          border: `2px solid ${borderColor}`,
          boxShadow: (isMaxed || isActive)
            ? `0 0 12px ${glowColor}88, 0 0 30px ${glowColor}33, inset 0 0 10px ${glowColor}22`
            : 'inset 0 1px 0 rgba(255,255,255,0.05)',
          opacity: isLocked ? 0.4 : 1,
          transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
        }}
      >
        {/* Icon placeholder / initials */}
        <span
          className="text-[11px] font-bold text-center leading-tight px-0.5 select-none"
          style={{ color: isLocked ? '#555' : isMaxed ? color : isActive ? `${color}CC` : '#666' }}
        >
          {node.name.split(' ').map(w => w[0]).join('').slice(0, 3)}
        </span>

        {/* Point pip */}
        {!isLocked && (
          <div
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full select-none"
            style={{
              background: isMaxed ? color : '#111',
              color: isMaxed ? '#000' : isActive ? color : '#555',
              border: `1px solid ${isMaxed ? color : isActive ? `${color}66` : '#333'}`,
              lineHeight: 1,
            }}
          >
            {currentPoints}/{node.maxPoints}
          </div>
        )}
      </motion.div>

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 z-50 pointer-events-none rounded-md overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #13131e 0%, #1a1a2e 100%)',
              border: `1px solid ${color}44`,
              boxShadow: `0 4px 24px rgba(0,0,0,0.7), 0 0 0 1px ${color}22`,
            }}
          >
            {/* Header */}
            <div
              className="px-3 py-2 border-b"
              style={{ borderColor: `${color}33`, background: `${color}11` }}
            >
              <div className="font-bold text-sm" style={{ color }}>{node.name}</div>
              <div className="text-[10px] mt-0.5 font-mono" style={{ color: `${color}99` }}>
                {node.type.toUpperCase()} &bull; {currentPoints}/{node.maxPoints} pts
              </div>
            </div>
            {/* Body */}
            <div className="px-3 py-2">
              <p className="text-xs leading-relaxed text-[#9999b0]">{node.description}</p>
              {isLocked && node.prerequisites.length > 0 && (
                <p className="text-[10px] mt-2 text-[#ff4444]">
                  Requires prerequisites to be maxed
                </p>
              )}
              {!isLocked && (
                <p className="text-[10px] mt-2 text-[#555577]">
                  {isMaxed
                    ? 'Right-click to refund'
                    : isActive
                    ? 'Left-click to add · Right-click to refund'
                    : 'Left-click to allocate'}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
