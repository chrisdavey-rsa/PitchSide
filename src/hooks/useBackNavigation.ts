import { useEffect, useRef } from "react";
import { hasActiveOverlayHistory } from "../lib/overlayHistoryManager";
import { TAB_SWIPE_ORDER, type SwipeTab } from "./useTabSwipe";

type Options = {
  activeTab: SwipeTab;
  setActiveTab: (tab: SwipeTab) => void;
  /** Called when the user backs past the root of the in-session tab stack. */
  onRequestSignOut: () => void;
  enabled?: boolean;
};

function isValidTab(value: unknown): value is SwipeTab {
  return (
    typeof value === "string" &&
    (TAB_SWIPE_ORDER as readonly string[]).includes(value)
  );
}

function readTabFromState(state: unknown): SwipeTab | null {
  if (!state || typeof state !== "object") return null;
  const tab = (state as { tab?: unknown }).tab;
  return isValidTab(tab) ? tab : null;
}

/**
 * True screen-history stack for mobile tabs:
 * - Tab changes (nav / swipe) → pushState({ tab })
 * - Browser / edge-swipe back → restore event.state.tab
 * - Back past the session root → re-anchor + open SignOutModal
 */
export function useBackNavigation({
  activeTab,
  setActiveTab,
  onRequestSignOut,
  enabled = true,
}: Options) {
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const setActiveTabRef = useRef(setActiveTab);
  setActiveTabRef.current = setActiveTab;
  const onRequestSignOutRef = useRef(onRequestSignOut);
  onRequestSignOutRef.current = onRequestSignOut;

  /** When true, the next activeTab effect syncs via replaceState (popstate restore). */
  const suppressPushRef = useRef(false);
  const seededRef = useRef(false);

  // Mark the current screen as the session root (no extra buffer entry).
  useEffect(() => {
    if (!enabled) {
      seededRef.current = false;
      return;
    }
    if (seededRef.current) return;
    seededRef.current = true;

    const prev = (window.history.state as Record<string, unknown> | null) ?? {};
    // Avoid duplicating if this entry already represents the active tab.
    if (prev.tab === activeTabRef.current) return;

    window.history.replaceState({ ...prev, tab: activeTabRef.current }, "");
  }, [enabled]);

  // Push a history frame whenever the active tab changes via UI (not via popstate).
  useEffect(() => {
    if (!enabled) return;

    if (suppressPushRef.current) {
      suppressPushRef.current = false;
      const prev = (window.history.state as Record<string, unknown> | null) ?? {};
      if (prev.tab !== activeTab) {
        window.history.replaceState({ ...prev, tab: activeTab }, "");
      }
      return;
    }

    const prev = (window.history.state as Record<string, unknown> | null) ?? {};
    // Same tab (including repeat taps on the active bottom-nav item) → no new entry.
    if (prev.tab === activeTab) return;

    window.history.pushState({ ...prev, tab: activeTab }, "");
  }, [activeTab, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const handlePopState = (event: PopStateEvent) => {
      // Overlay stack owns this pop (league hub, desktop leagues modal, etc.).
      if (hasActiveOverlayHistory()) return;

      const previousTab = readTabFromState(event.state);

      if (previousTab) {
        // Restore the prior screen in the session stack.
        if (previousTab !== activeTabRef.current) {
          suppressPushRef.current = true;
          setActiveTabRef.current(previousTab);
        }
        return;
      }

      // Root of the session stack — keep the SPA alive and prompt sign-out.
      event.preventDefault();
      const currentTab = activeTabRef.current;
      const prev = (window.history.state as Record<string, unknown> | null) ?? {};
      window.history.pushState({ ...prev, tab: currentTab }, "");
      onRequestSignOutRef.current();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled]);
}
