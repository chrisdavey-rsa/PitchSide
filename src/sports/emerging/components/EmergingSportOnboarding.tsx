/**
 * Onboarding sport picker for emerging sports (isolated from AuthFlow).
 * Players: Football/Rugby selectable; Golf/F1 disabled + Coming Soon.
 * Admins: all four selectable; F1/Golf unlock favorite comboboxes.
 */

import React, { useMemo, useState } from 'react';
import { isSportAccessible } from '../featureFlags';
import {
  EMERGING_SPORT_META,
  type EmergingSportKey,
  type SportKey,
  type UserRole,
} from '../types';
import {
  saveEmergingPreferences,
  useF1ConstructorsQuery,
  useGolfPlayersQuery,
} from '../hooks/useEmergingSports';
import EmergingSearchCombobox from './EmergingSearchCombobox';
import { SportIcon } from '../sportIcons';

type Props = {
  userId: string;
  userRole: UserRole;
  initialSports?: SportKey[];
  initialFavoriteF1Team?: string | null;
  initialFavoriteGolfer?: string | null;
  onSaved?: (selected: SportKey[]) => void;
};

const CORE: { key: SportKey; label: string }[] = [
  { key: 'football', label: 'Football' },
  { key: 'rugby', label: 'Rugby' },
];

const EMERGING: EmergingSportKey[] = ['golf', 'formula1'];

export default function EmergingSportOnboarding({
  userId,
  userRole,
  initialSports = ['football', 'rugby'],
  initialFavoriteF1Team = null,
  initialFavoriteGolfer = null,
  onSaved,
}: Props) {
  const [selected, setSelected] = useState<SportKey[]>(initialSports);
  const [favoriteF1, setFavoriteF1] = useState<string | null>(initialFavoriteF1Team);
  const [favoriteGolfer, setFavoriteGolfer] = useState<string | null>(
    initialFavoriteGolfer,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: constructors = [] } = useF1ConstructorsQuery();
  const { data: golfers = [] } = useGolfPlayersQuery();

  const ctorOptions = useMemo(
    () =>
      constructors.map((c) => ({
        id: c.id,
        label: c.name,
        countryCode: c.countryCode,
        swatchHex: c.teamColorHex,
      })),
    [constructors],
  );

  const golferOptions = useMemo(
    () =>
      golfers.map((g) => ({
        id: g.id,
        label: g.name,
        countryCode: g.countryCode,
      })),
    [golfers],
  );

  const toggle = (key: SportKey) => {
    if (key === 'golf' || key === 'formula1') {
      if (!isSportAccessible(key, userRole)) return;
    }
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveEmergingPreferences({
        userId,
        selectedSports: selected,
        favoriteF1Team: selected.includes('formula1') ? favoriteF1 : null,
        favoriteGolfer: selected.includes('golf') ? favoriteGolfer : null,
      });
      onSaved?.(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Choose your sports</h2>
        <p className="text-xs text-slate-500 mt-1">
          {userRole === 'admin'
            ? 'Admin preview: Golf and Formula 1 are fully unlocked.'
            : 'Football and Rugby are live. Golf and F1 arrive Spring 2027.'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CORE.map((sport) => {
          const on = selected.includes(sport.key);
          return (
            <button
              key={sport.key}
              type="button"
              onClick={() => toggle(sport.key)}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                on
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
              }`}
            >
              <SportIcon sport={sport.key} colored className="h-6 w-6" />
              <div className="mt-1 text-sm font-semibold">{sport.label}</div>
              <div className="text-[10px] font-mono text-slate-500">Live now</div>
            </button>
          );
        })}

        {EMERGING.map((key) => {
          const meta = EMERGING_SPORT_META[key];
          const accessible = isSportAccessible(key, userRole);
          const on = selected.includes(key);

          if (!accessible) {
            return (
              <div
                key={key}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3 opacity-45 grayscale select-none pointer-events-none"
              >
                <SportIcon sport={key} colored={false} className="h-6 w-6" />
                <div className="mt-1 text-sm font-semibold text-slate-400">
                  {meta.label}
                </div>
                <div className="text-[10px] font-mono text-slate-500 italic">
                  Coming soon…
                </div>
              </div>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                on
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
              }`}
            >
              <SportIcon sport={key} colored className="h-6 w-6" />
              <div className="mt-1 text-sm font-semibold">{meta.label}</div>
              <div className="text-[10px] font-mono text-violet-400/80">
                Admin unlocked
              </div>
            </button>
          );
        })}
      </div>

      {selected.includes('formula1') && isSportAccessible('formula1', userRole) && (
        <EmergingSearchCombobox
          label="Favorite Team"
          placeholder="Search constructors…"
          options={ctorOptions}
          value={favoriteF1}
          onChange={setFavoriteF1}
        />
      )}

      {selected.includes('golf') && isSportAccessible('golf', userRole) && (
        <EmergingSearchCombobox
          label="Favorite Golfer"
          placeholder="Search golfers…"
          options={golferOptions}
          value={favoriteGolfer}
          onChange={setFavoriteGolfer}
        />
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <button
        type="button"
        disabled={saving || selected.length === 0}
        onClick={() => void save()}
        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2.5 text-sm font-semibold text-white"
      >
        {saving ? 'Saving…' : 'Save preferences'}
      </button>
    </div>
  );
}
