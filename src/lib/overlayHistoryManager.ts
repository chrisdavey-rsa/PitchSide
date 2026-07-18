import { useEffect, useRef } from 'react';

const OVERLAY_KEY = 'pitchsideOverlay';

interface StackEntry {
  id: string;
  onClose: () => void;
}

const stack: StackEntry[] = [];
let historyActive = false;
let suppressNextPop = false;
/** While > 0, skip history.back() so overlay swaps don't flash-close the next view. */
let retainHistoryPopCount = 0;
let retainTimer: ReturnType<typeof setTimeout> | null = null;

let listenerInstalled = false;

function pushBrowserHistory() {
  if (historyActive) return;
  const prev = (window.history.state as Record<string, unknown> | null) ?? {};
  window.history.pushState(
    { ...prev, [OVERLAY_KEY]: stack[stack.length - 1]?.id ?? true },
    '',
    window.location.href,
  );
  historyActive = true;
}

/** Strip the overlay marker without navigating away from the SPA document. */
function clearOverlayHistoryMarker() {
  historyActive = false;
  suppressNextPop = true;
  try {
    const prev = (window.history.state as Record<string, unknown> | null) ?? {};
    if (OVERLAY_KEY in prev) {
      const next = { ...prev };
      delete next[OVERLAY_KEY];
      window.history.replaceState(next, '', window.location.href);
    }
  } catch {
    /* ignore */
  }
}

function popBrowserHistory() {
  if (!historyActive) return;
  // Never history.back() here — that can leave PitchSide when the prior
  // entry is an external referrer. replaceState keeps the user on Dashboard.
  clearOverlayHistoryMarker();
}

function handlePopState() {
  if (suppressNextPop) {
    suppressNextPop = false;
    return;
  }

  if (stack.length === 0) {
    historyActive = false;
    return;
  }

  const top = stack.pop()!;
  // Keep historyActive true if more overlays remain (they share one synthetic entry).
  if (stack.length === 0) {
    historyActive = false;
  }
  top.onClose();
}

function ensureListener() {
  if (listenerInstalled) return;
  window.addEventListener('popstate', handlePopState);
  listenerInstalled = true;
}

function registerOverlay(id: string, onClose: () => void) {
  ensureListener();

  const existingIdx = stack.findIndex((entry) => entry.id === id);
  if (existingIdx !== -1) {
    stack[existingIdx].onClose = onClose;
    return;
  }

  stack.push({ id, onClose });
  pushBrowserHistory();
}

function unregisterOverlay(id: string) {
  const idx = stack.findIndex((entry) => entry.id === id);
  if (idx === -1) return;

  const wasTop = idx === stack.length - 1;
  stack.splice(idx, 1);

  // When the stack empties, always clear historyActive so the next overlay
  // can pushState. Prefer replaceState over history.back() so X / close
  // never exits the app.
  if (stack.length === 0 && wasTop) {
    if (retainHistoryPopCount > 0) {
      clearOverlayHistoryMarker();
      return;
    }
    popBrowserHistory();
  }
}

/**
 * Prevents a programmatic overlay swap from calling history.back() between
 * close and open (e.g. Leagues modal → League hub, Account → Rules).
 * Uses a longer window so React Strict Mode remounts / batched effects stay covered.
 */
export function retainOverlayHistoryDuringTransition(ms = 500) {
  retainHistoryPopCount += 1;
  if (retainTimer) clearTimeout(retainTimer);
  retainTimer = setTimeout(() => {
    retainHistoryPopCount = 0;
    retainTimer = null;
  }, ms);
}

/**
 * Atomically hand the current history entry from one overlay to another
 * without calling history.back() / pushState (avoids React Router remount races).
 */
export function transferOverlay(fromId: string, toId: string, onClose: () => void) {
  ensureListener();
  retainOverlayHistoryDuringTransition();

  const fromIdx = stack.findIndex((entry) => entry.id === fromId);
  if (fromIdx !== -1) stack.splice(fromIdx, 1);

  const toIdx = stack.findIndex((entry) => entry.id === toId);
  if (toIdx !== -1) {
    stack[toIdx].onClose = onClose;
  } else {
    stack.push({ id: toId, onClose });
  }

  // Preserve the existing synthetic history entry for swipe-back.
  if (stack.length > 0) {
    historyActive = true;
  }
}

export function useOverlayHistory(isOpen: boolean, onClose: () => void, overlayId: string) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    registerOverlay(overlayId, () => onCloseRef.current());

    return () => {
      unregisterOverlay(overlayId);
    };
  }, [isOpen, overlayId]);
}
