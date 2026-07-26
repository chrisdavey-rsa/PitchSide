import React, { useCallback, useEffect, useState } from "react";
import { useTabSwipe, type SwipeTab } from "../hooks/useTabSwipe";
import { useBackNavigation } from "../hooks/useBackNavigation";
import SignOutModal from "./modals/SignOutModal";
import type { MobileNavTab } from "./Dashboard/MobileNavigation";

function toSwipeTab(tab: MobileNavTab): SwipeTab {
  return tab === "leaderboards" ? "boards" : tab;
}

function toMobileNavTab(tab: SwipeTab): MobileNavTab {
  return tab === "boards" ? "leaderboards" : tab;
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

type AppShellProps = {
  activeTab: MobileNavTab;
  onSelectTab: (tab: MobileNavTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
  className?: string;
};

/**
 * Mobile tab content shell: horizontal swipe between tabs + true history-stack back.
 */
export default function AppShell({
  activeTab,
  onSelectTab,
  onLogout,
  children,
  className = "md:hidden space-y-4",
}: AppShellProps) {
  const isMobile = useIsMobileViewport();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const swipeTab = toSwipeTab(activeTab);

  /** Always apply (used by history restore). */
  const applyTab = useCallback(
    (tab: SwipeTab) => {
      onSelectTab(toMobileNavTab(tab));
    },
    [onSelectTab],
  );

  /** User-driven changes — skip no-ops so the same tab never pushes history. */
  const handleUserSelectTab = useCallback(
    (tab: SwipeTab) => {
      if (tab === toSwipeTab(activeTab)) return;
      applyTab(tab);
    },
    [activeTab, applyTab],
  );

  const swipeHandlers = useTabSwipe({
    activeTab: swipeTab,
    onChangeTab: handleUserSelectTab,
    enabled: isMobile && !signOutOpen,
  });

  useBackNavigation({
    activeTab: swipeTab,
    setActiveTab: applyTab,
    onRequestSignOut: () => setSignOutOpen(true),
    enabled: isMobile,
  });

  return (
    <>
      <div className={className} {...swipeHandlers}>
        {children}
      </div>
      <SignOutModal
        open={signOutOpen}
        onCancel={() => setSignOutOpen(false)}
        onSignedOut={onLogout}
      />
    </>
  );
}
