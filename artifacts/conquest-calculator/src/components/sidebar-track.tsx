import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import type { SidebarNode } from '@workspace/api-client-react';
import { stripWowMarkup } from '@/data/talent-engine/wow-tooltip-parser';

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
              milestoneIndex={i}
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
  milestoneIndex: number;
  unlocked: boolean;
  color: string;
  top: number;
  size: number;
  level: number;
}

function SidebarNodeComponent({
  node, tierLabel, milestoneLevel, milestoneIndex, unlocked, color, top, size, level,
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

  const isAbilityNode = detectsAbility(cleanSidebarTooltipText(node.description));
  // Ability-teaching nodes use a square/rounded-rect frame; pure passives use circle.
  const borderRadius = isAbilityNode ? '6px' : '50%';

  const borderColor = unlocked ? color : '#252535';

  const boxShadow = unlocked
    ? `0 0 0 1px ${color}77, 0 0 5px ${color}55, inset 0 0 4px ${color}18`
    : 'none';

  const bgStyle: React.CSSProperties = {
    background: unlocked
      ? `radial-gradient(circle at 40% 35%, ${color}38 0%, ${color}12 50%, #0d0d18 100%)`
      : `radial-gradient(circle at 40% 35%, #12121d 0%, #0a0a14 100%)`,
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
      {/* Outer animated ring when unlocked — subtle pulse only */}
      {unlocked && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ scale: [1, 1.12, 1], opacity: [0.22, 0, 0.22] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            border: `1px solid ${color}66`,
            borderRadius,
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
          borderRadius,
          border: `2px solid ${borderColor}`,
          boxShadow,
          opacity: unlocked ? 1 : 0.58,
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
            milestoneIndex={milestoneIndex}
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
  milestoneIndex: number;
  mousePos: { x: number; y: number };
}

function cleanSidebarTooltipText(text: string): string {
  return stripWowMarkup(text)
    .replace(/\[?Interface\\[^)\]\s]+]?/gi, '')
    .replace(/\bInterface\\[^\s]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect whether a sidebar node teaches an ability (vs pure passive).
 * Heuristic: description contains "Teaches you", "teaches you", or starts with
 * a known ability-teaching pattern. Ability nodes get square icon framing.
 */
function detectsAbility(description: string): boolean {
  const lower = description.toLowerCase();
  return lower.includes('teaches you') || lower.includes('grants you') || lower.includes('learn ');
}

/**
 * For ability-teaching nodes, extract the ability name from description.
 * Looks for "Teaches you X." or "Grants you X." patterns.
 */
function extractAbilityName(description: string): string | null {
  const m = description.match(/(?:teaches|grants) you ([^.]+)\./i);
  return m ? m[1].trim() : null;
}

function SidebarTooltip({ node, unlocked, color, milestoneLevel, milestoneIndex, mousePos }: SidebarTooltipProps) {
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

  const description = cleanSidebarTooltipText(node.description)
    .replace(/\bLevel:\s*\d+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const isAbility = detectsAbility(description);
  const abilityName = isAbility ? extractAbilityName(description) : null;
  const nodeTypeLabel = isAbility ? 'Ability' : 'Passive';
  // TE spent requirement: 5 per milestone after the first (0, 5, 10, 15, 20)
  const teRequired = milestoneIndex * 5;

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.12 }}
      className="fixed z-[100] pointer-events-none"
      style={{
        left: leftPx,
        top: topPx,
        width: 272,
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
        {/* ── Header ── */}
        <div
          className="px-3 pt-2.5 pb-2"
          style={{
            background: `linear-gradient(90deg, ${color}18 0%, ${color}06 100%)`,
            borderBottom: `1px solid ${color}30`,
          }}
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="text-sm font-bold leading-tight tracking-wide"
              style={{ color: '#ffd100', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
            >
              {node.name}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="text-[9px] uppercase tracking-[0.15em] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: `${color}22`,
                color: `${color}CC`,
                border: `1px solid ${color}33`,
              }}
            >
              auto-passive
            </span>
            <span className="text-[10px]" style={{ color: '#e07820' }}>
              Requires Level {milestoneLevel}
            </span>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-3 pt-2 pb-2.5">
          {/* Level X Passive / Level X Ability */}
          <div className="text-[11px] font-semibold mb-1.5" style={{ color: `${color}CC` }}>
            Level {milestoneLevel} {nodeTypeLabel}
          </div>

          {/* TE spent requirement — only milestones 2-5 */}
          {teRequired > 0 && (
            <div className="text-[11px] leading-snug mb-2" style={{ color: '#ff8040' }}>
              requires {teRequired} Talent Essence in spec tree
            </div>
          )}

          {/* Description — for ability nodes show only the ability description, not the "teaches you" line */}
          {description && !isAbility && (
            <p className="text-[12px] leading-relaxed" style={{ color: '#c8c8d8' }}>
              {description}
            </p>
          )}

          {/* Ability-teaching nodes: second section with divider */}
          {isAbility && (
            <>
              {/* "Teaches you X." lead-in */}
              <p className="text-[12px] leading-relaxed mb-2" style={{ color: '#c8c8d8' }}>
                Teaches you {abilityName ?? node.name}.
              </p>

              {/* Divider */}
              <div
                className="my-2"
                style={{
                  height: 1,
                  background: `linear-gradient(90deg, transparent 0%, ${color}44 20%, ${color}44 80%, transparent 100%)`,
                }}
              />

              {/* Ability spell block */}
              <div className="flex items-start gap-2">
                {/* Ability icon — square framed */}
                <div
                  className="flex-none rounded"
                  style={{
                    width: 36,
                    height: 36,
                    background: `${color}18`,
                    border: `1px solid ${color}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span className="text-[10px] font-bold" style={{ color: `${color}AA` }}>
                    {(abilityName ?? node.name).split(' ').map(w => w[0]).join('').slice(0, 3)}
                  </span>
                </div>
                <div>
                  <div className="text-[12px] font-bold leading-tight mb-0.5" style={{ color: '#ffd100' }}>
                    {abilityName ?? node.name}
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: '#c8c8d8' }}>
                    {description}
                  </p>
                </div>
              </div>
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
