import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TalentTree as TalentTreeType, TalentNode as TalentNodeType } from '@workspace/api-client-react';

interface TalentTreeProps {
  tree: TalentTreeType;
  getNodeState: (nodeId: string, tree: TalentTreeType) => { status: string; currentPoints: number };
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string) => void;
}

const CELL_WIDTH = 80;
const CELL_HEIGHT = 80;
const PADDING = 40;

export function TalentTree({ tree, getNodeState, onNodeClick, onNodeContextMenu }: TalentTreeProps) {
  const { nodes } = tree;

  // Calculate grid dimensions
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(node => {
      if (node.position.x < minX) minX = node.position.x;
      if (node.position.x > maxX) maxX = node.position.x;
      if (node.position.y < minY) minY = node.position.y;
      if (node.position.y > maxY) maxY = node.position.y;
    });
    return { minX, maxX, minY, maxY };
  }, [nodes]);

  const width = (bounds.maxX - bounds.minX + 1) * CELL_WIDTH + PADDING * 2;
  const height = (bounds.maxY - bounds.minY + 1) * CELL_HEIGHT + PADDING * 2;

  const getPos = (x: number, y: number) => ({
    x: (x - bounds.minX) * CELL_WIDTH + PADDING + CELL_WIDTH / 2,
    y: (y - bounds.minY) * CELL_HEIGHT + PADDING + CELL_HEIGHT / 2,
  });

  return (
    <div className="relative w-full h-full overflow-auto bg-background/50 rounded-lg border border-border shadow-inner p-4 custom-scrollbar">
      <div
        className="relative mx-auto my-0"
        style={{ width, height, minWidth: width, minHeight: height }}
      >
        <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {nodes.map(node => {
            return node.prerequisites.map(prereqId => {
              const prereq = nodes.find(n => n.id === prereqId);
              if (!prereq) return null;

              const start = getPos(prereq.position.x, prereq.position.y);
              const end = getPos(node.position.x, node.position.y);

              const prereqState = getNodeState(prereqId, tree);
              const isPrereqMet = prereqState.currentPoints === prereq.maxPoints;

              return (
                <line
                  key={`${prereqId}-${node.id}`}
                  x1={start.x}
                  y1={start.y + 20}
                  x2={end.x}
                  y2={end.y - 20}
                  stroke={isPrereqMet ? tree.color : "hsl(var(--muted-foreground))"}
                  strokeWidth={isPrereqMet ? 3 : 1.5}
                  strokeOpacity={isPrereqMet ? 0.8 : 0.3}
                  filter={isPrereqMet ? "url(#glow)" : undefined}
                />
              );
            });
          })}
        </svg>

        {nodes.map(node => {
          const pos = getPos(node.position.x, node.position.y);
          const state = getNodeState(node.id, tree);
          
          return (
            <TalentNodeComponent
              key={node.id}
              node={node}
              state={state}
              color={tree.color}
              x={pos.x}
              y={pos.y}
              onClick={() => onNodeClick(node.id)}
              onContextMenu={() => onNodeContextMenu(node.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface TalentNodeComponentProps {
  node: TalentNodeType;
  state: { status: string; currentPoints: number };
  color: string;
  x: number;
  y: number;
  onClick: () => void;
  onContextMenu: () => void;
}

function TalentNodeComponent({ node, state, color, x, y, onClick, onContextMenu }: TalentNodeComponentProps) {
  const { status, currentPoints } = state;
  const isSquare = node.type === 'active';
  const isHex = node.type === 'passive';
  const isChoice = node.type === 'choice'; // Usually octagonal or circular

  const isLocked = status === 'locked';
  const isAvailable = status === 'available';
  const isActive = status === 'active';
  const isMaxed = status === 'maxed';

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
      style={{ left: x, top: y }}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu();
      }}
    >
      <div className={`relative w-12 h-12 flex items-center justify-center cursor-pointer 
        ${isLocked ? 'opacity-50 grayscale' : 'opacity-100'} 
        transition-all duration-200`}
      >
        <motion.div
          whileHover={!isLocked ? { scale: 1.1 } : {}}
          whileTap={!isLocked ? { scale: 0.95 } : {}}
          className={`absolute inset-0 bg-secondary
            ${isSquare ? 'rounded-md' : isChoice ? 'rounded-full' : 'clip-hexagon'}
            border-2 ${isMaxed ? 'border-primary' : isAvailable ? 'border-primary/50' : 'border-border'}
            ${isMaxed || isActive ? 'shadow-[0_0_15px_var(--tw-shadow-color)]' : ''}
          `}
          style={{ 
            '--tw-shadow-color': (isMaxed || isActive) ? color : 'transparent',
            borderColor: (isMaxed || isAvailable) ? color : undefined,
          } as any}
        >
          {node.icon ? (
            <img src={node.icon} alt={node.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-muted-foreground/20 flex items-center justify-center text-xs font-bold text-foreground/50">
              {node.name.substring(0,2)}
            </div>
          )}
        </motion.div>

        {/* Point Pip */}
        <div className="absolute -bottom-2 -right-2 bg-background border border-border text-foreground text-[10px] font-mono px-1 py-0.5 rounded shadow-sm z-10 pointer-events-none">
          {currentPoints}/{node.maxPoints}
        </div>

        {/* Tooltip Hover */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover border border-border rounded shadow-xl text-xs z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
          <div className="font-bold text-primary mb-1">{node.name}</div>
          <div className="text-muted-foreground mb-1">{node.description}</div>
          <div className="text-foreground/70 font-mono">
            Points: {currentPoints} / {node.maxPoints}
          </div>
          {node.prerequisites.length > 0 && (
             <div className="mt-1 pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
               Requires: {node.prerequisites.join(', ')}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
