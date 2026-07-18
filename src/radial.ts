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

