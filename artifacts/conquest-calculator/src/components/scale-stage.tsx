import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

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
 * Responsive viewport-fitting scaling system.
 *
 * Computes a uniform `fitScale` that maps the intrinsic (baseWidth × baseHeight)
 * content into the available container, then applies it as a CSS transform.
 * The content is horizontally centered and top-aligned so the tree starts at
 * the top of the viewport, matching Dragonflight/PoE-style talent panels.
 */
export function ScaleStage({
  children,
  baseWidth = 1280,
  baseHeight = 820,
  minScale = 0.45,
  maxScale = 1.3,
  padding = 12,
}: ScaleStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const { width: vpW, height: vpH } = el.getBoundingClientRect();
      const usableW = Math.max(1, vpW - padding * 2);
      const usableH = Math.max(1, vpH - padding * 2);
      const fitScaleX = usableW / baseWidth;
      const fitScaleY = usableH / baseHeight;
      const fitScale = Math.min(fitScaleX, fitScaleY);
      const clamped = Math.max(minScale, Math.min(maxScale, fitScale));

      // DEV logging: viewport-fit metrics
      if (process.env.NODE_ENV !== 'production') {
        console.info('[ScaleStage] viewport fit:', {
          viewport: { width: Math.round(vpW), height: Math.round(vpH) },
          intrinsic: { width: baseWidth, height: baseHeight },
          fitScaleX: +fitScaleX.toFixed(4),
          fitScaleY: +fitScaleY.toFixed(4),
          fitScale: +fitScale.toFixed(4),
          clampedScale: +clamped.toFixed(4),
          renderedSize: {
            width: Math.round(baseWidth * clamped),
            height: Math.round(baseHeight * clamped),
          },
        });
      }

      setScale(clamped);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth, baseHeight, minScale, maxScale, padding]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <div
        style={{
          position: 'relative',
          width: baseWidth,
          height: baseHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          // Center horizontally within container; top-align vertically.
          margin: `${padding}px auto 0`,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
