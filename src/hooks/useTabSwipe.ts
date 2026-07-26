import { useCallback, useRef, type TouchEvent } from "react";

/** Visual left→right tab order for mobile swipe navigation. */
export const TAB_SWIPE_ORDER = [
  "leagues",
  "boards",
  "predictions",
  "account",
  "rules",
] as const;

export type SwipeTab = (typeof TAB_SWIPE_ORDER)[number];

const MIN_DELTA_X = 60;
const HORIZONTAL_RATIO = 1.5;

function shouldIgnoreTouchTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  if (target.closest('[data-no-swipe="true"]')) return true;
  if (target.closest("button, a, input, textarea, select, label, [role='button']")) {
    return true;
  }
  // @dnd-kit drag handles / sortable items
  if (
    target.closest(
      "[data-dndkit-disabled], [aria-roledescription='draggable'], [data-sortable-id], .touch-none",
    )
  ) {
    return true;
  }

  return false;
}

type Options = {
  activeTab: SwipeTab;
  onChangeTab: (tab: SwipeTab) => void;
  enabled?: boolean;
};

/**
 * Horizontal swipe between mobile bottom-nav tabs on the main content surface.
 */
export function useTabSwipe({ activeTab, onChangeTab, enabled = true }: Options) {
  const startRef = useRef<{ x: number; y: number; ignore: boolean } | null>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const onChangeTabRef = useRef(onChangeTab);
  onChangeTabRef.current = onChangeTab;

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      const touch = e.changedTouches[0] ?? e.touches[0];
      if (!touch) return;
      startRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        ignore: shouldIgnoreTouchTarget(e.target),
      };
    },
    [enabled],
  );

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      const start = startRef.current;
      startRef.current = null;
      if (!start || start.ignore) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (Math.abs(deltaX) <= MIN_DELTA_X) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_RATIO) return;

      const idx = TAB_SWIPE_ORDER.indexOf(activeTabRef.current);
      if (idx < 0) return;

      // Swipe left → next tab; swipe right → previous tab
      const nextIdx = deltaX < 0 ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= TAB_SWIPE_ORDER.length) return;

      onChangeTabRef.current(TAB_SWIPE_ORDER[nextIdx]);
    },
    [enabled],
  );

  return { onTouchStart, onTouchEnd };
}
