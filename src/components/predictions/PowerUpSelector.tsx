import React, { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import {
  POWER_UPS,
  getPowerUp,
  type PowerUpId,
  type PowerUpSportType,
  type UserPowerUpInstance,
} from "../../constants/powerups";
import { SportIcon } from "../../sports/emerging/sportIcons";
import type { SportKey } from "../../sports/emerging/types";

function sportKeyFromPowerUp(sport: PowerUpSportType): SportKey {
  if (sport === "f1") return "formula1";
  return sport;
}

/** Hard accent border color per chip (used for dashed / solid states). */
const ACCENT_BORDER: Record<PowerUpId, string> = {
  double_bubble: "border-sky-400",
  safety_net: "border-emerald-400",
  sniper: "border-rose-400",
  banker: "border-slate-300",
  pitchside_master: "border-amber-300",
};

type Props = {
  sportType: PowerUpSportType;
  instances: UserPowerUpInstance[];
  /** Power-up currently waiting for a fixture tap. */
  assigningPowerUpId?: PowerUpId | null;
  /** Power-up types already assigned to a fixture (local state). */
  assignedPowerUpIds?: PowerUpId[];
  /** False when every visible fixture is closed / locked. */
  hasOpenFixtures?: boolean;
  onSelect?: (powerUpId: PowerUpId) => void;
  className?: string;
};

/**
 * Prediction workspace power-up chip grid — 5 equal chips, dashed/solid borders.
 */
export default function PowerUpSelector({
  sportType,
  instances,
  assigningPowerUpId = null,
  assignedPowerUpIds = [],
  hasOpenFixtures = true,
  onSelect,
  className = "",
}: Props) {
  const [tipId, setTipId] = useState<PowerUpId | null>(null);
  const byId = useMemo(() => {
    const map = new Map<PowerUpId, UserPowerUpInstance>();
    instances.forEach((row) => map.set(row.powerUpId, row));
    return map;
  }, [instances]);

  const assignedSet = useMemo(
    () => new Set(assignedPowerUpIds),
    [assignedPowerUpIds],
  );

  return (
    <div className={`space-y-2 ${className}`} data-no-swipe="true">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Power-Ups
          <span className="text-slate-600 normal-case tracking-normal font-sans text-[9px]">
            {" "}
            · tap a chip, then a fixture
          </span>
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2 w-full">
        {POWER_UPS.map((def) => {
          const instance = byId.get(def.id);
          const unlocked =
            !!instance?.unlocked &&
            instance.status !== "locked" &&
            instance.status !== "expired" &&
            instance.status !== "consumed";
          const consumed = instance?.status === "consumed";
          const assigned = assignedSet.has(def.id);
          const assigning = assigningPowerUpId === def.id;
          const Icon = def.icon;
          const unlockTip =
            instance?.progressHint ||
            def.unlockCriteria ||
            "Complete unlock criteria to earn this chip.";
          const accent = ACCENT_BORDER[def.id];
          const noOpenFixtures = unlocked && !hasOpenFixtures;

          let borderClass = "border border-transparent";
          if (unlocked && hasOpenFixtures && (assigned || assigning)) {
            borderClass = `border-2 border-solid ${accent} shadow-lg`;
          } else if (unlocked && hasOpenFixtures) {
            borderClass = `border-2 border-dashed ${accent}`;
          }

          return (
            <div key={def.id} className="relative min-w-0">
              <button
                type="button"
                disabled={consumed || (unlocked && !hasOpenFixtures)}
                title={
                  !unlocked
                    ? unlockTip
                    : noOpenFixtures
                      ? "No open fixtures"
                      : def.tagline
                }
                onClick={() => {
                  if (!unlocked) {
                    setTipId((cur) => (cur === def.id ? null : def.id));
                    return;
                  }
                  if (!hasOpenFixtures) {
                    setTipId(def.id);
                    return;
                  }
                  setTipId(null);
                  onSelect?.(def.id);
                }}
                className={[
                  "relative flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2.5 transition-all cursor-pointer",
                  unlocked && hasOpenFixtures
                    ? def.isPremium
                      ? "bg-linear-to-br from-amber-200/25 via-yellow-500/15 to-slate-950"
                      : def.theme.bg
                    : "bg-slate-900/50 opacity-40 grayscale",
                  borderClass,
                  assigning && hasOpenFixtures ? "ring-2 ring-violet-400/50" : "",
                ].join(" ")}
              >
                <span className="relative inline-flex">
                  <span
                    className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border ${
                      unlocked && hasOpenFixtures
                        ? def.isPremium
                          ? "border-amber-200/50 bg-slate-950/70"
                          : `${def.theme.border} bg-slate-950/50`
                        : "border-slate-700 bg-slate-950/40"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        unlocked && hasOpenFixtures
                          ? def.isPremium
                            ? "text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                            : def.theme.iconText
                          : "text-slate-500"
                      }`}
                    />
                  </span>
                  <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-700 bg-slate-950 shadow-md overflow-hidden">
                    <SportIcon
                      sport={sportKeyFromPowerUp(sportType)}
                      className="h-2.5 w-2.5"
                    />
                  </span>
                </span>
                <span
                  className={`text-[7px] sm:text-[8px] font-bold font-display leading-tight text-center truncate w-full px-0.5 ${
                    unlocked && hasOpenFixtures
                      ? def.isPremium
                        ? "text-amber-100"
                        : def.theme.accentText
                      : "text-slate-500"
                  }`}
                >
                  {def.name}
                </span>
                {assigned && unlocked && hasOpenFixtures && (
                  <span className="text-[7px] font-mono uppercase tracking-wider text-emerald-400">
                    Armed
                  </span>
                )}
                {noOpenFixtures && (
                  <span className="text-[6px] font-mono uppercase tracking-wide text-slate-500 leading-tight text-center px-0.5">
                    No open fixtures
                  </span>
                )}
                {consumed && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/55">
                    <Lock className="h-4 w-4 text-slate-300" />
                  </span>
                )}
              </button>

              {tipId === def.id && (
                <div
                  role="tooltip"
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-20 w-44 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-[10px] text-slate-300 shadow-xl font-sans leading-snug"
                >
                  {!unlocked
                    ? consumed
                      ? "Already used this season. Earn another to use again."
                      : unlockTip
                    : noOpenFixtures
                      ? "No open fixtures"
                      : getPowerUp(def.id)?.tagline}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
