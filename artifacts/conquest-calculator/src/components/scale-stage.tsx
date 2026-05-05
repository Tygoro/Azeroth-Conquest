import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface ScaleStageProps {
  children: ReactNode;
  /** Logical width children render at. */
  baseWidth?: number;
  /** Logical height children render at. */
  baseHeight?: number;
  /** Lower bound for the auto-computed scale. */
  minScale?: number;
  /** Upper bound for the auto-computed scale. */
  maxScale?: number;
  /** Optional extra outer padding (px) to keep glow / tooltips clear of edges. */
  padding?: number;
}

/**
 * Centered scaling system — fits children of a fixed logical size into the
 * available container by uniformly scaling them via `transform: scale(...)`.
 *
 * Mirrors how MMO talent UIs work: never scrolls, never clips, always centered.
 */
export function ScaleStage({
  children,
  baseWidth = 1280,
  baseHeight = 820,
  minScale = 0.45,
  maxScale = 1.1,
  padding = 16,
}: ScaleStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      const usableW = Math.max(1, width - padding * 2);
      const usableH = Math.max(1, height - padding * 2);
      const next = Math.min(usableW / baseWidth, usableH / baseHeight);
      setScale(Math.max(minScale, Math.min(maxScale, next)));
    };

    update();
    // ResizeObserver alone is sufficient — it fires on container size changes,
    // including those caused by window resizes.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth, baseHeight, minScale, maxScale, padding]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
