import React, { useMemo, useState } from "react";
import { X, ChevronRight } from "lucide-react";
import {
  formatAccuracy,
  safeNum,
  type LeaderboardRecord,
} from "../../supabase";

export type AccuracySportTab = "all" | "football" | "rugby";

export type AccuracyTierBreakdown = {
  exact: number;
  close: number;
  winner: number;
  wrong: number;
  basePoints: number;
  settled: number;
  accuracy: string;
};

export function buildAccuracyBreakdown(
  record: LeaderboardRecord | null,
  sportTab: AccuracySportTab,
): AccuracyTierBreakdown {
  if (!record) {
    return {
      exact: 0,
      close: 0,
      winner: 0,
      wrong: 0,
      basePoints: 0,
      settled: 0,
      accuracy: "0%",
    };
  }

  if (sportTab === "football") {
    const exact = safeNum(record.hitsExactFootball);
    const close = safeNum(record.hitsCloseFootball);
    const winner = safeNum(record.hitsWinnerFootball);
    const wrong = safeNum(record.hitsWrongFootball);
    const settled = safeNum(record.settledPredictionsFootball);
    const basePoints = safeNum(
      record.basePointsFootball,
      exact * 5 + close * 3 + winner,
    );
    return {
      exact,
      close,
      winner,
      wrong,
      basePoints,
      settled,
      accuracy: formatAccuracy(basePoints, settled),
    };
  }

  if (sportTab === "rugby") {
    const exact = safeNum(record.hitsExactRugby);
    const close = safeNum(record.hitsCloseRugby);
    const winner = safeNum(record.hitsWinnerRugby);
    const wrong = safeNum(record.hitsWrongRugby);
    const settled = safeNum(record.settledPredictionsRugby);
    const basePoints = safeNum(
      record.basePointsRugby,
      exact * 5 + close * 3 + winner,
    );
    return {
      exact,
      close,
      winner,
      wrong,
      basePoints,
      settled,
      accuracy: formatAccuracy(basePoints, settled),
    };
  }

  const exact =
    safeNum(record.hitsExactFootball) + safeNum(record.hitsExactRugby);
  const close =
    safeNum(record.hitsCloseFootball) + safeNum(record.hitsCloseRugby);
  const winner =
    safeNum(record.hitsWinnerFootball) + safeNum(record.hitsWinnerRugby);
  const wrong =
    safeNum(record.hitsWrongFootball) + safeNum(record.hitsWrongRugby);
  const settled =
    safeNum(record.settledPredictionsFootball) +
    safeNum(record.settledPredictionsRugby);
  const basePoints = safeNum(
    safeNum(record.basePointsFootball) + safeNum(record.basePointsRugby),
    exact * 5 + close * 3 + winner,
  );

  return {
    exact,
    close,
    winner,
    wrong,
    basePoints,
    settled,
    accuracy: formatAccuracy(basePoints, settled),
  };
}

interface AccuracyBreakdownModalProps {
  nickname: string;
  record: LeaderboardRecord | null;
  initialSportTab?: AccuracySportTab;
  onClose: () => void;
}

function TierRow({
  label,
  ptsLabel,
  count,
  points,
}: {
  label: string;
  ptsLabel: string;
  count: number;
  points: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-800/70 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-slate-100 font-sans">{label}</p>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          {ptsLabel}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-display font-bold text-white tabular-nums">
          {count}
        </p>
        <p className="text-[10px] font-mono text-slate-500 tabular-nums">
          {points} pts
        </p>
      </div>
    </div>
  );
}

export default function AccuracyBreakdownModal({
  nickname,
  record,
  initialSportTab = "all",
  onClose,
}: AccuracyBreakdownModalProps) {
  const [sportTab, setSportTab] = useState<AccuracySportTab>(initialSportTab);

  const breakdown = useMemo(
    () => buildAccuracyBreakdown(record, sportTab),
    [record, sportTab],
  );

  const maxPossible = safeNum(breakdown.settled) * 5;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-950/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accuracy-breakdown-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Accuracy breakdown
            </p>
            <h3
              id="accuracy-breakdown-title"
              className="text-lg font-display font-extrabold text-white"
            >
              {nickname}
            </h3>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">
              Base points only · chips excluded
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
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
                    ? "bg-sky-500/15 text-sky-300"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3.5 py-1">
          <TierRow
            label="Perfect Predictions"
            ptsLabel="5 pts each"
            count={safeNum(breakdown.exact)}
            points={safeNum(breakdown.exact) * 5}
          />
          <TierRow
            label="Close"
            ptsLabel="3 pts each"
            count={safeNum(breakdown.close)}
            points={safeNum(breakdown.close) * 3}
          />
          <TierRow
            label="Correct Winner"
            ptsLabel="1 pt each"
            count={safeNum(breakdown.winner)}
            points={safeNum(breakdown.winner)}
          />
          <TierRow
            label="Wrong Predictions"
            ptsLabel="0 pts"
            count={safeNum(breakdown.wrong)}
            points={0}
          />
        </div>

        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-400/80">
              Total base points
            </p>
            <p className="text-xl font-display font-extrabold text-emerald-300 tabular-nums">
              {breakdown.basePoints}
              <span className="text-sm font-mono font-semibold text-slate-500">
                {" "}
                / {maxPossible}
              </span>
            </p>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
              {breakdown.settled} completed pick
              {breakdown.settled === 1 ? "" : "s"} · max 5 each
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
              Accuracy
            </p>
            <p className="text-2xl font-display font-extrabold text-white tabular-nums">
              {breakdown.accuracy}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold uppercase cursor-pointer inline-flex items-center justify-center gap-1"
        >
          Back
          <ChevronRight className="w-3.5 h-3.5 opacity-50 rotate-180" />
        </button>
      </div>
    </div>
  );
}
