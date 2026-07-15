/**
 * Shared helpers for the "radial expansion" modal reveal.
 *
 * A modal overlay is revealed by animating a CSS `clip-path: circle()` from a
 * zero-radius circle at the click coordinates out to a radius large enough to
 * cover the whole viewport, and collapsed back on close. This gives every
 * pop-up (Leagues, Account, Rules) the same snappy, ease-out ripple that
 * originates from wherever the user clicked.
 */

export interface RadialOrigin {
  x: number;
  y: number;
}

/** Snappy, smooth ease-out curve (~300ms). */
export const RADIAL_TRANSITION = {
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1] as const,
};

/** Falls back to the viewport centre when no click coordinates are available. */
function viewportCenter(): RadialOrigin {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/**
 * Reads the cursor position from a mouse/pointer event so the reveal can
 * originate from the exact click point. Programmatic triggers (no event) get
 * the viewport centre instead.
 */
export function radialOriginFromEvent(
  e?: { clientX?: number; clientY?: number } | null,
): RadialOrigin {
  if (e && typeof e.clientX === "number" && typeof e.clientY === "number") {
    return { x: e.clientX, y: e.clientY };
  }
  return viewportCenter();
}

/** Distance from the origin to the furthest viewport corner (covers the screen). */
function coverRadius(origin: RadialOrigin): number {
  if (typeof window === "undefined") return 2000;
  const dx = Math.max(origin.x, window.innerWidth - origin.x);
  const dy = Math.max(origin.y, window.innerHeight - origin.y);
  return Math.hypot(dx, dy) + 8;
}

/**
 * Motion props for a full-screen overlay that ripples open/closed from a point.
 * Spread onto a `motion.div` (`{...radialClip(origin)}`).
 */
export function radialClip(origin: RadialOrigin | null | undefined) {
  const o = origin ?? viewportCenter();
  const collapsed = `circle(0px at ${o.x}px ${o.y}px)`;
  const expanded = `circle(${coverRadius(o)}px at ${o.x}px ${o.y}px)`;
  return {
    initial: { clipPath: collapsed, WebkitClipPath: collapsed },
    animate: { clipPath: expanded, WebkitClipPath: expanded },
    exit: { clipPath: collapsed, WebkitClipPath: collapsed },
    transition: RADIAL_TRANSITION,
  };
}
