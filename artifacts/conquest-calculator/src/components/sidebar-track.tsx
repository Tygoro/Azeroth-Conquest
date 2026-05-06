import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import type { SidebarNode } from '@workspace/api-client-react';

interface SidebarTrackProps {
  nodes: SidebarNode[];
  color: string;
  level: number;
}

const NODE_SIZE = 52;
const TRACK_WIDTH = 104;
const TRACK_PAD_TOP = 44;
const TRACK_PAD_BOTTOM = 44;
const TRACK_HEIGHT = 650;
const MILESTONE_LEVELS = [10, 20, 30, 40, 50];

/**
 * Path of Ascension sidebar.
 * Per Ascension CoA rules: AUTO-unlocks at level milestones [10, 20, 30, 40, 50].
 * NOT clickable — purely visual progression separate from tree point investment.
 */
export function SidebarTrack({ nodes, color, level }: SidebarTrackProps) {
  if (!nodes.length) return null;

  const lastMilestone = MILESTONE_LEVELS[Math.min(nodes.length - 1, MILESTONE_LEVELS.length - 1)] ?? 50;
  const fillPct = Math.min(Math.max((level - MILESTONE_LEVELS[0]) / (lastMilestone - MILESTONE_LEVELS[0]), 0) * 100, 100);
  const railTop = TRACK_PAD_TOP + NODE_SIZE / 2;
  const railHeight = TRACK_HEIGHT - TRACK_PAD_TOP - TRACK_PAD_BOTTOM - NODE_SIZE;
  const nodeCount = Math.max(nodes.length - 1, 1);

  return (
    <aside
      className="flex-none relative flex flex-col items-center px-2 py-5"
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

      <div className="relative" style={{ width: TRACK_WIDTH - 16, height: TRACK_HEIGHT }}>
        {/* Vertical progress track */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full overflow-hidden"
          style={{
            top: railTop,
            width: 4,
            height: railHeight,
            background: '#1a1a26',
            border: `1px solid ${color}22`,
            zIndex: 1,
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
          const milestoneLevel = MILESTONE_LEVELS[i] ?? (10 + i * 10);
          const unlocked = level >= milestoneLevel;
          const top = TRACK_PAD_TOP + (i / nodeCount) * railHeight;
          return (
            <SidebarNodeComponent
              key={sb.id}
              node={sb}
              tierLabel={['I', 'II', 'III', 'IV', 'V'][i] ?? `${i + 1}`}
              milestoneLevel={milestoneLevel}
              unlocked={unlocked}
              color={color}
              top={top}
              size={NODE_SIZE}
              level={level}
            />
          );
        })}
      </div>

      <div className="mt-1 text-[8px] font-mono uppercase tracking-[0.18em] text-muted-foreground/50">
        Level milestones
      </div>
    </aside>
  );
}

// ── Single sidebar node ─────────────────────────────────────────────────────

interface SidebarNodeComponentProps {
  node: SidebarNode;
  tierLabel: string;
  milestoneLevel: number;
  unlocked: boolean;
  color: string;
  top: number;
  size: number;
  level: number;
}

function SidebarNodeComponent({
  node, tierLabel, milestoneLevel, unlocked, color, top, size, level,
}: SidebarNodeComponentProps) {
  const [hovered, setHovered] = useState(false);
  // Cursor-following tooltip: track viewport-space mouse coords so the arrow
  // points at the cursor instead of the node center.
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };
  const handleMouseEnter = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    setHovered(true);
  };

  const borderColor = unlocked ? color : '#252535';

  const boxShadow = unlocked
    ? `0 0 0 1px ${color}55, 0 0 18px ${color}AA, 0 0 36px ${color}55, inset 0 0 12px ${color}33`
    : 'none';

  const bgStyle: React.CSSProperties = {
    background: unlocked
      ? `radial-gradient(circle at 40% 35%, ${color}55 0%, ${color}18 50%, #0d0d18 100%)`
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
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Outer animated glow when unlocked */}
      {unlocked && (
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
        animate={unlocked ? { scale: [1, 1.04, 1] } : {}}
        transition={unlocked
          ? { duration: 2.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
          : { type: 'spring', stiffness: 300 }
        }
        className="w-full h-full relative overflow-hidden select-none flex items-center justify-center"
        style={{
          ...bgStyle,
          borderRadius: '50%',
          border: `2px solid ${borderColor}`,
          boxShadow,
          opacity: unlocked ? 1 : 0.45,
          transition: 'border-color 0.25s, box-shadow 0.25s, opacity 0.25s',
        }}
      >
        {!unlocked ? (
          <Lock className="w-4 h-4" style={{ color: `${color}55` }} />
        ) : (
          <span
            className="text-base font-bold"
            style={{
              color: '#fff',
              textShadow: `0 0 8px ${color}`,
            }}
          >
            {tierLabel}
          </span>
        )}

        {unlocked && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${color}28 0%, transparent 60%)`,
            }}
          />
        )}
      </motion.div>

      {/* Threshold label */}
      <div
        className="absolute text-[9px] font-mono font-bold whitespace-nowrap"
        style={{
          left: size + 8,
          top: size / 2 - 7,
          color: unlocked ? `${color}CC` : '#444459',
          opacity: unlocked ? 0.9 : 0.58,
        }}
      >
        {milestoneLevel}
      </div>

      {/* Tooltip — follows the cursor */}
      <AnimatePresence>
        {hovered && (
          <SidebarTooltip
            node={node}
            unlocked={unlocked}
            color={color}
            milestoneLevel={milestoneLevel}
            level={level}
            mousePos={mousePos}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tooltip ─────────────────────────────────────────────────────────────────

interface SidebarTooltipProps {
  node: SidebarNode;
  unlocked: boolean;
  color: string;
  milestoneLevel: number;
  level: number;
  mousePos: { x: number; y: number };
}

function cleanSidebarTooltipText(text: string): string {
  return text
    .replace(/\[?Interface\\[^)\]\s]+]?/gi, '')
    .replace(/\bInterface\\[^\s]+/gi, '')
    .replace(/\b[A-Z][A-Za-z]+_[A-Za-z0-9_]+\b/g, '')
    .replace(/\b[a-z0-9-]+_(class|spec|left|right|l|r|sb)_[a-z0-9_-]+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function SidebarTooltip({ node, unlocked, color, milestoneLevel, level, mousePos }: SidebarTooltipProps) {
  // Portaled to document.body to escape the CSS-transformed ScaleStage
  // ancestor (otherwise `position: fixed` would be anchored to the stage).
  // Layout: prefer above the cursor; flip below if there's no room. Center
  // horizontally on the cursor, then clamp into the viewport. The arrow's x
  // is decoupled from the tooltip's x so it always points at the cursor.
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 256, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
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
  let topPx = mousePos.y - h - cursorOffset;
  if (topPx < margin) {
    placement = 'bottom';
    topPx = mousePos.y + cursorOffset;
  }
  if (topPx + h > vh - margin) topPx = Math.max(margin, vh - margin - h);

  let leftPx = mousePos.x - w / 2;
  if (leftPx < margin) leftPx = margin;
  else if (leftPx + w > vw - margin) leftPx = vw - margin - w;

  const arrowX = Math.max(10, Math.min(w - 10, mousePos.x - leftPx));
  const isTop = placement === 'top';
  const description = cleanSidebarTooltipText(node.description);

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.12 }}
      className="fixed z-[100] pointer-events-none w-64"
      style={{
        left: leftPx,
        top: topPx,
        visibility: h === 0 ? 'hidden' : 'visible',
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
              Level {milestoneLevel} Passive
            </span>
          </div>
        </div>

        <div className="px-3 py-2.5 space-y-2">
          {description && (
            <p className="text-xs leading-relaxed" style={{ color: '#c8c8d8' }}>
              {description}
            </p>
          )}

          {!unlocked ? (
            <div
              className="text-[10px] leading-snug px-2 py-1.5 rounded"
              style={{
                color: '#ff5050',
                background: 'rgba(255,50,50,0.08)',
                border: '1px solid rgba(255,50,50,0.2)',
              }}
            >
              <span className="font-bold">Unlocks at</span>{' '}
              <span className="font-bold">level {milestoneLevel}</span>{' '}
              ({level}/{milestoneLevel})
            </div>
          ) : (
            <div
              className="text-[10px] leading-snug px-2 py-1.5 rounded"
              style={{
                color: `${color}DD`,
                background: `${color}10`,
                border: `1px solid ${color}33`,
              }}
            >
              <span className="font-bold">Active.</span> This bonus is granted automatically.
            </div>
          )}
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
