import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, X, Zap } from "lucide-react";
import { getCountryFlag } from "../AccountPortal/data";
import {
  dbFetchPlayerChipUsage,
  dbFetchPlayerRecentForm,
  formatAccuracy,
  formatStrikeRate,
  safeNum,
  type LeaderboardRecord,
} from "../../supabase";
import { getChip } from "../../constants/chips";
import { formatPlayerRealName } from "./LeaderboardPlayerLabel";
import AccuracyBreakdownModal, {
  type AccuracySportTab,
} from "./AccuracyBreakdownModal";

type ProfileSportTab = AccuracySportTab;

interface LeaderboardPlayerProfileModalProps {
  playerId: string;
  /** Season (or horizon) leaderboard rows — used for live sport breakdowns. */
  records: LeaderboardRecord[];
  nickname: string;
  firstName?: string;
  surname?: string;
  nationality?: string;
  onClose: () => void;
}

function StatCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3">
      <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-display font-extrabold text-white tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[10px] font-mono text-slate-600">{hint}</p>
      ) : null}
    </div>
  );
}

export default function LeaderboardPlayerProfileModal({
  playerId,
  records,
  nickname,
  firstName,
  surname,
  nationality,
  onClose,
}: LeaderboardPlayerProfileModalProps) {
  const [sportTab, setSportTab] = useState<ProfileSportTab>("all");
  const [chipOpen, setChipOpen] = useState(false);
  const [accuracyOpen, setAccuracyOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement | null>(null);

  const record = useMemo(
    () => records.find((r) => r.playerId === playerId) ?? null,
    [records, playerId],
  );

  const { data: chipRows = [], isLoading: chipsLoading } = useQuery({
    queryKey: ["playerChipUsage", playerId],
    queryFn: () => dbFetchPlayerChipUsage(playerId),
    enabled: !!playerId,
    staleTime: 60_000,
  });

  const { data: recentForm = [], isLoading: recentFormLoading } = useQuery({
    queryKey: ["playerRecentForm", playerId],
    queryFn: () => dbFetchPlayerRecentForm(playerId, 5),
    enabled: !!playerId,
    staleTime: 60_000,
  });

  const formDots = useMemo(() => {
    const sportFiltered =
      sportTab === "all"
        ? recentForm
        : recentForm.filter((r) => r.sport === sportTab);
    return sportFiltered.slice(0, 5);
  }, [recentForm, sportTab]);

  useEffect(() => {
    if (!chipOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        chipRef.current &&
        !chipRef.current.contains(e.target as Node)
      ) {
        setChipOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChipOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [chipOpen]);

  const stats = useMemo(() => {
    if (!record) {
      return {
        points: 0,
        settled: 0,
        basePoints: 0,
        accuracy: "0%",
        strikeRate: 0,
      };
    }
    if (sportTab === "football") {
      const settled = safeNum(record.settledPredictionsFootball);
      const basePoints = safeNum(record.basePointsFootball);
      const points = safeNum(record.pointsFootball);
      return {
        points,
        settled,
        basePoints,
        accuracy: formatAccuracy(basePoints, settled),
        strikeRate: formatStrikeRate(points, settled),
      };
    }
    if (sportTab === "rugby") {
      const settled = safeNum(record.settledPredictionsRugby);
      const basePoints = safeNum(record.basePointsRugby);
      const points = safeNum(record.pointsRugby);
      return {
        points,
        settled,
        basePoints,
        accuracy: formatAccuracy(basePoints, settled),
        strikeRate: formatStrikeRate(points, settled),
      };
    }
    const settled =
      safeNum(record.settledPredictionsFootball) +
      safeNum(record.settledPredictionsRugby);
    const basePoints =
      safeNum(record.basePointsFootball) + safeNum(record.basePointsRugby);
    const points = safeNum(record.points);
    return {
      points,
      settled,
      basePoints,
      accuracy: formatAccuracy(basePoints, settled),
      strikeRate: formatStrikeRate(points, settled),
    };
  }, [record, sportTab]);

  const filteredChips = useMemo(() => {
    const rows =
      sportTab === "all"
        ? chipRows
        : chipRows.filter((r) => r.sport === sportTab);
    const byType = new Map<string, number>();
    for (const row of rows) {
      byType.set(
        row.chipType,
        (byType.get(row.chipType) ?? 0) + row.timesUsed,
      );
    }
    return [...byType.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [chipRows, sportTab]);

  const chipsDeployed = filteredChips.reduce((n, r) => n + r.count, 0);

  const realName = formatPlayerRealName(firstName, surname);

  return (
    <>
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-950/80 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-title"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                Player profile
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {nationality ? (
                  <span className="text-base leading-none" title={nationality}>
                    {getCountryFlag(nationality)}
                  </span>
                ) : null}
                <h3
                  id="player-profile-title"
                  className="text-lg font-display font-extrabold text-white truncate"
                >
                  {nickname}
                </h3>
              </div>
              {realName ? (
                <p className="text-[11px] font-light tracking-[0.04em] text-slate-500 mt-0.5">
                  {realName}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Sport breakdown"
            className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-950/70 border border-slate-800"
          >
            {(
              [
                { id: "all" as const, label: "All Sports" },
                { id: "football" as const, label: "Football" },
                { id: "rugby" as const, label: "Rugby" },
              ] as const
            ).map((tab) => {
              const active = sportTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSportTab(tab.id)}
                  className={`py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    active
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <StatCell label="Total Points" value={String(stats.points)} />
            <StatCell
              label="Completed Picks"
              value={String(stats.settled)}
              hint="Completed picks only"
            />
            <button
              type="button"
              onClick={() => setAccuracyOpen(true)}
              className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3 text-left hover:border-sky-500/40 hover:bg-sky-500/5 transition-colors cursor-pointer group"
              aria-label="Open accuracy breakdown"
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 group-hover:text-sky-400/80">
                  Accuracy
                </p>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-sky-400" />
              </div>
              <p className="mt-1 text-lg font-display font-extrabold text-white tabular-nums">
                {stats.accuracy}
              </p>
              <p className="mt-0.5 text-[10px] font-mono text-slate-600">
                {safeNum(stats.basePoints)}/{safeNum(stats.settled) * 5} base
                pts · tap for detail
              </p>
            </button>
            <StatCell
              label="Strike Rate"
              value={stats.strikeRate.toFixed(2)}
              hint="Pts / completed pick"
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3">
            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
              Recent Form
            </p>
            <p className="mt-0.5 text-[10px] font-mono text-slate-600">
              Last 5 Completed Picks
            </p>
            {recentFormLoading ? (
              <p className="mt-3 text-[11px] font-mono text-slate-500">Loading…</p>
            ) : formDots.length === 0 ? (
              <p className="mt-3 text-[11px] font-mono text-slate-500">
                No Completed Picks yet.
              </p>
            ) : (
              <div className="mt-3 flex items-center gap-2" role="list" aria-label="Recent form">
                {formDots.map((pick) => {
                  const color =
                    pick.outcomeTier === "perfect"
                      ? "bg-emerald-500"
                      : pick.outcomeTier === "correct"
                        ? "bg-amber-400"
                        : "bg-slate-600";
                  const label =
                    pick.outcomeTier === "perfect"
                      ? "Perfect Prediction"
                      : pick.outcomeTier === "correct"
                        ? "Correct Winner"
                        : "Wrong";
                  return (
                    <span
                      key={pick.matchId}
                      role="listitem"
                      title={`${pick.homeTeam} ${pick.actualHome}-${pick.actualAway} ${pick.awayTeam} · Predicted ${pick.predictedHome}-${pick.predictedAway} · ${label}`}
                      className={`h-3.5 w-3.5 rounded-full ${color} ring-1 ring-white/10`}
                    />
                  );
                })}
              </div>
            )}
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-mono text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Perfect
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Winner
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-600" /> Wrong
              </span>
            </div>
          </div>

          <div
            ref={chipRef}
            className="relative"
            onMouseEnter={() => setChipOpen(true)}
            onMouseLeave={() => setChipOpen(false)}
          >
            <button
              type="button"
              className="w-full rounded-xl border border-violet-500/30 bg-violet-500/5 px-3 py-3 text-left hover:bg-violet-500/10 transition-colors cursor-pointer"
              aria-expanded={chipOpen}
              aria-controls="chip-breakdown"
              onClick={() => setChipOpen((v) => !v)}
              onFocus={() => setChipOpen(true)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-violet-300" />
                  <span className="text-[9px] font-mono uppercase tracking-widest text-violet-300/90">
                    Chips Deployed
                  </span>
                </span>
                <span className="text-lg font-display font-extrabold text-white tabular-nums">
                  {chipsLoading ? "…" : chipsDeployed}
                </span>
              </div>
              <p className="mt-1 text-[10px] font-mono text-slate-500">
                Hover or tap for breakdown
              </p>
            </button>

            {chipOpen && (
              <div
                id="chip-breakdown"
                role="tooltip"
                className="absolute left-0 right-0 bottom-[calc(100%+0.5rem)] z-10 rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-xl"
              >
                {filteredChips.length === 0 ? (
                  <p className="text-xs text-slate-500 font-sans text-center py-1">
                    No Chips deployed yet
                    {sportTab !== "all" ? ` in ${sportTab}` : ""}.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {filteredChips.map(({ type, count }) => {
                      const def = getChip(type);
                      return (
                        <li
                          key={type}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-slate-200 font-sans">
                            {def?.name ?? type}
                          </span>
                          <span className="font-mono font-bold text-violet-300 tabular-nums">
                            {count} used
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {record &&
          (record.predictionsFootball > 0 || record.predictionsRugby > 0) ? (
            <p className="text-[10px] font-mono text-slate-600 text-center">
              Activity · {record.predictionsFootball + record.predictionsRugby}{" "}
              total locks
              {sportTab === "all"
                ? ` (${record.predictionsFootball} FB · ${record.predictionsRugby} RU)`
                : ""}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold uppercase cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {accuracyOpen && (
        <AccuracyBreakdownModal
          nickname={nickname}
          record={record}
          initialSportTab={sportTab}
          onClose={() => setAccuracyOpen(false)}
        />
      )}
    </>
  );
}
