import { useEffect, useState } from "react";

const STORAGE_KEY = "pitchside_nation_filter_v1";

function loadStoredIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** Persist nation filter selections across reloads (Predictions feed). */
export function usePersistedCompetitionFilter(storageKey = STORAGE_KEY): [
  string[],
  React.Dispatch<React.SetStateAction<string[]>>,
] {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => loadStoredIds());

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(selectedIds));
    } catch {
      /* ignore */
    }
  }, [selectedIds, storageKey]);

  return [selectedIds, setSelectedIds];
}
