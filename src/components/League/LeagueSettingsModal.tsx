import React, { useEffect, useState } from "react";
import { Lock, Settings, X } from "lucide-react";
import type { League } from "../../types";

export interface LeagueSettingsPayload {
  isPrivate: boolean;
  maxPlayers: number;
  password: string;
}

interface LeagueSettingsModalProps {
  league: League;
  memberCount: number;
  onClose: () => void;
  onSave: (payload: LeagueSettingsPayload) => Promise<void>;
}

/**
 * Admin-only editor for visibility, capacity, and join password.
 */
export default function LeagueSettingsModal({
  league,
  memberCount,
  onClose,
  onSave,
}: LeagueSettingsModalProps) {
  const minPlayers = Math.max(1, memberCount);
  const [isPrivate, setIsPrivate] = useState(!!league.isPrivate);
  const [maxPlayers, setMaxPlayers] = useState(
    Math.min(20, Math.max(minPlayers, league.maxPlayers ?? league.maxParticipants ?? 20)),
  );
  const [password, setPassword] = useState(league.password || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsPrivate(!!league.isPrivate);
    setMaxPlayers(
      Math.min(20, Math.max(minPlayers, league.maxPlayers ?? league.maxParticipants ?? 20)),
    );
    setPassword(league.password || "");
  }, [league, minPlayers]);

  const handleSave = async () => {
    const bounded = Math.min(20, Math.max(minPlayers, Number(maxPlayers) || minPlayers));
    if (bounded < minPlayers) {
      setError(`Max players cannot be below the current member count (${minPlayers}).`);
      return;
    }
    if (isPrivate && !password.trim()) {
      setError("Private leagues need a join password.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        isPrivate,
        maxPlayers: bounded,
        password: password.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save league settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button
        type="button"
        aria-label="Close league settings"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />

      <div className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <Settings className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold font-display text-white truncate">
                League Settings
              </h2>
              <p className="text-[10px] font-mono text-slate-500 truncate">{league.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Visibility */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`py-2.5 rounded-xl text-xs font-mono font-bold uppercase border transition-colors cursor-pointer ${
                  !isPrivate
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                }`}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`py-2.5 rounded-xl text-xs font-mono font-bold uppercase border transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                  isPrivate
                    ? "bg-slate-800 border-slate-600 text-slate-200"
                    : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Private
              </button>
            </div>
            <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
              Private leagues stay out of the global directory. Members can still join via invite
              link or league code.
            </p>
          </div>

          {/* Max players */}
          <div className="space-y-2">
            <label
              htmlFor="league-max-players"
              className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500"
            >
              Max Players
            </label>
            <input
              id="league-max-players"
              type="number"
              min={minPlayers}
              max={20}
              value={maxPlayers}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isNaN(next)) return;
                setMaxPlayers(Math.min(20, Math.max(minPlayers, next)));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500/50"
            />
            <p className="text-[10px] text-slate-500 font-sans">
              Between {minPlayers} (current members) and 20.
            </p>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label
              htmlFor="league-password"
              className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500"
            >
              Password
            </label>
            <input
              id="league-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set or change join password"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
            />
          </div>

          {error && (
            <p className="text-[11px] text-red-300 bg-red-950/30 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
