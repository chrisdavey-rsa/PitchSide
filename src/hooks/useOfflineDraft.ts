import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "pitchside:offline-draft:";

/** Server / trigger message when kickoff lock has passed. */
export const EVENT_LOCKED_ERROR =
  "Event locked. Predictions can no longer be submitted.";

/** User-facing toast when a submit is rejected after lock. */
export const LOCK_TIME_PASSED_TOAST =
  "Lock time passed. Your draft could not be submitted.";

export function isEventLockedError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error &&
            typeof error === "object" &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : "";
  return /event locked|predictions can no longer be submitted/i.test(message);
}

/** Namespaced localStorage key for an offline prediction draft. */
export function offlineDraftKey(userId: string, eventId: string): string {
  return `${STORAGE_PREFIX}${userId}:${eventId}`;
}

export function saveDraft<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn("[useOfflineDraft] saveDraft failed:", err);
  }
}

export function loadDraft<T = unknown>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn("[useOfflineDraft] clearDraft failed:", err);
  }
}

export function hasDraft(key: string): boolean {
  try {
    return localStorage.getItem(key) != null;
  } catch {
    return false;
  }
}

/** Shape stored for football/rugby offline prediction drafts. */
export type OfflinePredictionDraft = {
  savedAt: string;
  entries: Record<
    string,
    {
      home: number;
      away: number;
      sport: string;
      competitionId: string;
    }
  >;
};

/**
 * Explicit offline drafting: tracks navigator online/offline and exposes
 * localStorage draft helpers for prediction (and other) flows.
 */
export function useOfflineDraft(watchKey?: string | null) {
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [draftExists, setDraftExists] = useState(() =>
    watchKey ? hasDraft(watchKey) : false,
  );
  const [draftRevision, setDraftRevision] = useState(0);

  const refreshDraftFlag = useCallback(() => {
    setDraftExists(watchKey ? hasDraft(watchKey) : false);
    setDraftRevision((n) => n + 1);
  }, [watchKey]);

  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = () => {
      setIsOffline(false);
      refreshDraftFlag();
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [refreshDraftFlag]);

  useEffect(() => {
    refreshDraftFlag();
  }, [refreshDraftFlag, watchKey]);

  const save = useCallback(
    <T,>(key: string, data: T) => {
      saveDraft(key, data);
      if (!watchKey || key === watchKey) refreshDraftFlag();
    },
    [refreshDraftFlag, watchKey],
  );

  const load = useCallback(<T,>(key: string) => loadDraft<T>(key), []);

  const clear = useCallback(
    (key: string) => {
      clearDraft(key);
      if (!watchKey || key === watchKey) refreshDraftFlag();
    },
    [refreshDraftFlag, watchKey],
  );

  return {
    isOffline,
    draftExists,
    draftRevision,
    saveDraft: save,
    loadDraft: load,
    clearDraft: clear,
    refreshDraftFlag,
  };
}
