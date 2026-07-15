import React, { useId } from 'react';

interface PitchSideMarkProps {
  /** Rendered width/height in pixels. */
  size?: number;
  /** Play the draw-in intro animation once on mount. */
  animate?: boolean;
  className?: string;
}

/**
 * The PitchSide "P." brand mark. The "P" is rendered as live SVG text using the
 * exact same font stack as the PitchSide wordmark (`font-display`), so the
 * letterform always matches the site. When `animate` is set, the glyph outline
 * draws itself in (CSS stroke-dash), then the fill and the green fullstop dot
 * pop in.
 */
export default function PitchSideMark({ size = 96, animate = false, className }: PitchSideMarkProps) {
  const uid = useId().replace(/:/g, '');
  const bgId = `psBg-${uid}`;
  const dotId = `psDot-${uid}`;
  const glowId = `psGlow-${uid}`;

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
      </defs>

      <rect x="0" y="0" width="512" height="512" rx="116" fill={`url(#${bgId})`} />
      <rect x="6" y="6" width="500" height="500" rx="110" fill="none" stroke="#1e2b3d" strokeWidth="2" />

      {/* "P" in the site's display font, drawn as an outline then filled */}
      <text
        x="150"
        y="368"
        fontFamily='"Futura", "Outfit", ui-sans-serif, system-ui, sans-serif'
        fontWeight={900}
        fontSize="360"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinejoin="round"
        className={animate ? 'ps-mark-letter' : undefined}
      >
        P
      </text>

      <circle
        cx="360"
        cy="360"
        r="32"
        fill={`url(#${dotId})`}
        filter={`url(#${glowId})`}
        className={animate ? 'ps-mark-dot' : undefined}
      />
    </svg>
  );
}
