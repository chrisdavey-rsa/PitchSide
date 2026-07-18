import React, { useId } from 'react';

interface PitchSideMarkProps {
  /** Rendered width/height in pixels. */
  size?: number;
  /** Play the splash perimeter-trace + glow intro once on mount. */
  animate?: boolean;
  className?: string;
}

/** Corner radius for the inner perimeter (viewBox units). Soft enough that corners are pure arcs. */
const CORNER_RX = 160;
const INSET = 6;
const BOX = 500; // width/height of the inset frame

/**
 * The PitchSide "P." brand mark. The "P" and green fullstop are static.
 * When `animate` is set, a green rounded-rect stroke traces clockwise from
 * the top-center (accelerating), then the completed outline glows brighter
 * until the splash screen ends (~2.2s total, matching App.tsx).
 */
export default function PitchSideMark({ size = 96, animate = false, className }: PitchSideMarkProps) {
  const uid = useId().replace(/:/g, '');
  const bgId = `psBg-${uid}`;
  const dotId = `psDot-${uid}`;
  const glowId = `psGlow-${uid}`;
  const perimeterGlowId = `psPerimGlow-${uid}`;

  const x0 = INSET;
  const y0 = INSET;
  const x1 = INSET + BOX;
  const y1 = INSET + BOX;
  const r = CORNER_RX;
  const midX = (x0 + x1) / 2;

  // Clockwise from top-center; every corner is a full quarter-circle (no miters).
  const perimeterD = [
    `M ${midX} ${y0}`,
    `L ${x1 - r} ${y0}`,
    `A ${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
    `L ${x1} ${y1 - r}`,
    `A ${r} ${r} 0 0 1 ${x1 - r} ${y1}`,
    `L ${x0 + r} ${y1}`,
    `A ${r} ${r} 0 0 1 ${x0} ${y1 - r}`,
    `L ${x0} ${y0 + r}`,
    `A ${r} ${r} 0 0 1 ${x0 + r} ${y0}`,
    `L ${midX} ${y0}`,
  ].join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="PitchSide"
      className={className}
      overflow="visible"
    >
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0f1e2e" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <linearGradient id={dotId} x1="300" y1="336" x2="372" y2="408" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="12" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Soft radial blur for the perimeter glow — follows curves, no boxy corners */}
        <filter
          id={perimeterGlowId}
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="0" y="0" width="512" height="512" rx={CORNER_RX + INSET} fill={`url(#${bgId})`} />
      <rect
        x={INSET}
        y={INSET}
        width={BOX}
        height={BOX}
        rx={CORNER_RX}
        fill="none"
        stroke="#1e2b3d"
        strokeWidth="2"
      />

      {animate && (
        <>
          {/* Soft glow layer (same rounded path) — fades in after the trace completes */}
          <path
            className="ps-mark-perimeter-glow"
            d={perimeterD}
            pathLength={1}
            fill="none"
            stroke="#34d399"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${perimeterGlowId})`}
          />
          {/* Crisp green perimeter trace */}
          <path
            className="ps-mark-perimeter"
            d={perimeterD}
            pathLength={1}
            fill="none"
            stroke="#10b981"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* Static "P." — no draw-in */}
      <text
        x="150"
        y="368"
        fontFamily='"Futura", "Outfit", ui-sans-serif, system-ui, sans-serif'
        fontWeight={900}
        fontSize="360"
        fill="#ffffff"
      >
        P
      </text>

      <circle
        cx="360"
        cy="360"
        r="32"
        fill={`url(#${dotId})`}
        filter={`url(#${glowId})`}
      />
    </svg>
  );
}
