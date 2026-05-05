import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import type { SidebarNode } from '@workspace/api-client-react';
import type { NodeState } from '@/hooks/use-talent-tree';

interface SidebarTrackProps {
  nodes: SidebarNode[];
  color: string;
  treeSpent: number;
  getNodeState: (nodeId: string) => NodeState;
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string) => void;
}

const NODE_SIZE = 52;
const TRACK_GAP = 86;
const TRACK_WIDTH = 88;
const TRACK_PAD_TOP = 32;

export function SidebarTrack({
  nodes,
  color,
  treeSpent,
  getNodeState,
  onNodeClick,
  onNodeContextMenu,
}: SidebarTrackProps) {
  if (!nodes.length) return null;

  const trackHeight = TRACK_PAD_TOP + (nodes.length - 1) * TRACK_GAP + NODE_SIZE + 20;
  const lastThreshold = nodes[nodes.length - 1].unlockPointsRequired;
  const fillPct = Math.min((treeSpent / lastThreshold) * 100, 100);

  return (
    <aside
      className="flex-none relative flex flex-col items-center px-3 py-4"
      style={{
        width: TRACK_WIDTH,
        background: `linear-gradient(180deg, ${color}06 0%, transparent 100%)`,
        borderLeft: `1px solid ${color}22`,
      }}
      data-testid="sidebar-track"
    >
      <div
        className="text-[9px] font-bold uppercase tracking-[0.2em] mb-3 text-center leading-tight"
        style={{ color: `${color}AA` }}
      >
        Path of<br />Ascension
      </div>

      <div className="relative" style={{ width: NODE_SIZE + 8, height: trackHeight }}>
        {/* Vertical progress track */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full overflow-hidden"
          style={{
            top: TRACK_PAD_TOP,
            width: 6,
            height: (nodes.length - 1) * TRACK_GAP,
            background: '#1a1a26',
            border: `1px solid ${color}22`,
          }}
        >
          <div
            className="absolute left-0 right-0 bottom-0 transition-all duration-500"
            style={{
              height: `${fillPct}%`,
              background: `linear-gradient(to top, ${color}, ${color}88)`,
              boxShadow: `0 0 12px ${color}99`,
            }}
          />
        </div>

        {/* Sidebar nodes */}
        {nodes.map((sb, i) => {
          const state = getNodeState(sb.id);
          const top = TRACK_PAD_TOP + i * TRACK_GAP;
          return (
            <SidebarNodeComponent
              key={sb.id}
              node={sb}
              state={state}
              color={color}
              top={top}
              size={NODE_SIZE}
              treeSpent={treeSpent}
              onClick={() => onNodeClick(sb.id)}
              onContextMenu={() => onNodeContextMenu(sb.id)}
            />
          );
        })}
      </div>

      {/* Footer: progress label */}
      <div className="mt-2 text-center">
        <div className="text-[9px] font-mono text-muted-foreground">
          <span className="font-bold" style={{ color }}>{treeSpent}</span>
          <span className="opacity-50"> / {lastThreshold}</span>
        </div>
      </div>
    </aside>
  );
}

// ── Single sidebar node ─────────────────────────────────────────────────────

interface SidebarNodeComponentProps {
  node: SidebarNode;
  state: NodeState;
  color: string;
  top: number;
  size: number;
  treeSpent: number;
  onClick: () => void;
  onContextMenu: () => void;
}

function SidebarNodeComponent({
  node, state, color, top, size, treeSpent, onClick, onContextMenu,
}: SidebarNodeComponentProps) {
  const [hovered, setHovered] = useState(false);
  const { status } = state;

  const isLocked    = status === 'locked';
  const isAvailable = status === 'available';
  const isMaxed     = status === 'maxed' || status === 'active';

  const borderColor =
    isMaxed     ? color
    : isAvailable ? `${color}88`
    : '#252535';

  const boxShadow =
    isMaxed
      ? `0 0 0 1px ${color}55, 0 0 18px ${color}AA, 0 0 36px ${color}55, inset 0 0 12px ${color}33`
      : isAvailable
      ? `0 0 0 1px ${color}33, 0 0 8px ${color}55`
      : 'none';

  const bgStyle: React.CSSProperties = {
    background: isMaxed
      ? `radial-gradient(circle at 40% 35%, ${color}55 0%, ${color}18 50%, #0d0d18 100%)`
      : isAvailable
      ? `radial-gradient(circle at 40% 35%, ${color}22 0%, #0d0d18 100%)`
      : `radial-gradient(circle at 40% 35%, #14141f 0%, #0a0a14 100%)`,
  };

  return (
    <div
      data-testid={`sidebar-node-${node.id}`}
      className="absolute left-1/2 -translate-x-1/2"
      style={{
        top,
        width: size,
        height: size,
        zIndex: hovered ? 60 : 20,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); onContextMenu(); }}
    >
      {/* Outer animated glow for maxed */}
      {isMaxed && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            border: `1px solid ${color}`,
            boxShadow: `0 0 22px ${color}`,
            borderRadius: '50%',
          }}
        />
      )}

      <motion.div
        whileHover={!isLocked ? { scale: 1.12 } : {}}
        whileTap={!isLocked ? { scale: 0.9 } : {}}
        animate={isMaxed ? { scale: [1, 1.04, 1] } : {}}
        transition={isMaxed
          ? { duration: 2.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
          : { type: 'spring', stiffness: 300 }
        }
        className="w-full h-full relative overflow-hidden cursor-pointer select-none flex items-center justify-center"
        style={{
          ...bgStyle,
          borderRadius: '50%',
          border: `2px solid ${borderColor}`,
          boxShadow,
          opacity: isLocked ? 0.4 : 1,
          transition: 'border-color 0.25s, box-shadow 0.25s, opacity 0.25s',
        }}
      >
        {isLocked ? (
          <Lock className="w-4 h-4" style={{ color: `${color}55` }} />
        ) : (
          <span
            className="text-base font-bold"
            style={{
              color: isMaxed ? '#fff' : color,
              textShadow: isMaxed ? `0 0 8px ${color}` : 'none',
            }}
          >
            {['I', 'II', 'III', 'IV', 'V'][node.unlockPointsRequired === 8 ? 0 : node.unlockPointsRequired === 16 ? 1 : node.unlockPointsRequired === 24 ? 2 : node.unlockPointsRequired === 35 ? 3 : 4] ?? '?'}
          </span>
        )}

        {/* Sheen overlay for maxed */}
        {isMaxed && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${color}28 0%, transparent 60%)`,
            }}
          />
        )}
      </motion.div>

      {/* Threshold label below */}
      <div
        className="absolute left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold whitespace-nowrap"
        style={{
          top: size + 4,
          color: treeSpent >= node.unlockPointsRequired ? color : '#444459',
        }}
      >
        {node.unlockPointsRequired}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <SidebarTooltip
            node={node}
            state={state}
            color={color}
            treeSpent={treeSpent}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tooltip ─────────────────────────────────────────────────────────────────

interface SidebarTooltipProps {
  node: SidebarNode;
  state: NodeState;
  color: string;
  treeSpent: number;
}

function SidebarTooltip({ node, state, color, treeSpent }: SidebarTooltipProps) {
  const { status, currentPoints } = state;
  const isLocked = status === 'locked';

  return (
    <motion.div
      initial={{ opacity: 0, x: 8, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 8, scale: 0.94 }}
      transition={{ duration: 0.12 }}
      className="absolute z-[60] pointer-events-none w-64"
      style={{
        right: 'calc(100% + 14px)',
        top: '50%',
        transform: 'translateY(-50%)',
      }}
    >
      <div
        className="rounded-md overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #12121e 0%, #0a0a16 100%)',
          border: `1px solid ${color}50`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.85), 0 0 0 1px ${color}18, 0 0 20px ${color}15`,
        }}
      >
        <div
          className="px-3 pt-2.5 pb-2"
          style={{
            background: `linear-gradient(90deg, ${color}18 0%, ${color}06 100%)`,
            borderBottom: `1px solid ${color}30`,
          }}
        >
          <div
            className="text-sm font-bold leading-tight tracking-wide"
            style={{ color: '#ffd100', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            {node.name}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-[9px] uppercase tracking-[0.15em] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: `${color}22`,
                color: `${color}CC`,
                border: `1px solid ${color}33`,
              }}
            >
              ascension
            </span>
            <span className="text-[10px] font-mono" style={{ color: '#9999b0' }}>
              {currentPoints} / {node.maxPoints} pt
            </span>
          </div>
        </div>

        <div className="px-3 py-2.5 space-y-2">
          <p className="text-xs leading-relaxed" style={{ color: '#c8c8d8' }}>
            {node.description}
          </p>

          {isLocked && (
            <div
              className="text-[10px] leading-snug px-2 py-1.5 rounded"
              style={{
                color: '#ff5050',
                background: 'rgba(255,50,50,0.08)',
                border: '1px solid rgba(255,50,50,0.2)',
              }}
            >
              <span className="font-bold">Locked:</span> spend{' '}
              <span className="font-bold">{node.unlockPointsRequired}</span>{' '}
              points across both trees to unlock ({treeSpent}/{node.unlockPointsRequired})
            </div>
          )}

          {!isLocked && currentPoints === 0 && (
            <div
              className="text-[10px] leading-snug px-2 py-1.5 rounded"
              style={{
                color: `${color}DD`,
                background: `${color}10`,
                border: `1px solid ${color}33`,
              }}
            >
              Click to spend 1 point and unlock this ascension bonus.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
