import { useState, useEffect } from 'react';
import { getClassSpriteStyle, COA_SPRITE_URL } from '@/lib/class-icons';

// ── ClassPortrait ─────────────────────────────────────────────────────────────
// Single source-of-truth component for rendering a CoA class icon.
//
// Uses the official Ascension CoA sprite sheet (ascension.gg/icon/coa-builder-icon.webp).
// Falls back to a letter badge with class color if the sprite hasn't loaded.
//
// Props:
//   classId   - e.g. "suncleric", "witchdoctor"
//   name      - class display name (used for fallback letter + alt text)
//   color     - class accent color hex
//   size      - rendered px size (default 36)
//   glow      - whether to show the class-color outer glow ring
//   selected  - adds gold selected outline + intensified glow
//   muted     - reduces opacity to 0.45 (locked/unavailable state)
//   rimWidth  - override rim width in px (default = size * 0.055)

export interface ClassPortraitProps {
  classId: string;
  name: string;
  color: string;
  size?: number;
  glow?: boolean;
  selected?: boolean;
  muted?: boolean;
  rimWidth?: number;
  className?: string;
}

/** Module-level sprite load state — shared across all instances. */
let spriteLoadState: 'pending' | 'ok' | 'err' = 'pending';
const spriteListeners: Array<() => void> = [];
function subscribeToSprite(cb: () => void) {
  if (spriteLoadState !== 'pending') { cb(); return; }
  spriteListeners.push(cb);
}
function notifySprite() { spriteListeners.forEach(fn => fn()); spriteListeners.length = 0; }

// Kick off sprite probe as soon as the module loads.
if (typeof window !== 'undefined' && spriteLoadState === 'pending') {
  const probe = new window.Image();
  probe.onload  = () => { spriteLoadState = 'ok';  notifySprite(); };
  probe.onerror = () => { spriteLoadState = 'err'; notifySprite(); };
  probe.src = COA_SPRITE_URL;
}

export function ClassPortrait({
  classId,
  name,
  color,
  size = 36,
  glow = false,
  selected = false,
  muted = false,
  rimWidth,
  className,
}: ClassPortraitProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    subscribeToSprite(() => setTick(t => t + 1));
  }, []);

  const spriteStyle = getClassSpriteStyle(classId);
  const spriteOk = spriteLoadState === 'ok' && !!spriteStyle;

  const rim = rimWidth ?? Math.max(2, Math.round(size * 0.055));
  const rimColor = selected ? '#ffd100' : '#9e7c30';

  const shadow = selected
    ? `0 0 ${Math.round(size * 0.65)}px ${color}77,
       0 0 ${Math.round(size * 0.32)}px ${color}44,
       0 0 0 ${rim + 1}px #ffd10044,
       0 2px 10px rgba(0,0,0,0.8)`
    : glow
    ? `0 0 ${Math.round(size * 0.5)}px ${color}55,
       0 0 ${Math.round(size * 0.25)}px ${color}28,
       0 2px 8px rgba(0,0,0,0.7)`
    : `0 2px 8px rgba(0,0,0,0.55)`;

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: `${rim}px solid ${rimColor}`,
    boxShadow: shadow,
    flexShrink: 0,
    overflow: 'hidden',
    opacity: muted ? 0.45 : 1,
    transition: 'box-shadow 0.18s, border-color 0.18s, opacity 0.18s',
    display: 'inline-block',
    verticalAlign: 'middle',
  };

  if (!spriteOk) {
    return (
      <div
        className={className}
        style={{
          ...containerStyle,
          background: `radial-gradient(circle at 35% 35%, ${color}44 0%, ${color}11 60%, #09080f 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.38,
          fontWeight: 800,
          color,
          letterSpacing: '-0.02em',
          userSelect: 'none',
        }}
        title={name}
        aria-label={name}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        ...containerStyle,
        ...spriteStyle,
      }}
      title={name}
      aria-label={name}
    />
  );
}
