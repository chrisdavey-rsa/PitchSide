/**
 * Match-card chrome: sport colour strip + kick-off meta.
 * Competition context lives in feed sub-headers (not in-card).
 */
import React from "react";
import CompetitionFlag from "./CompetitionFlag";
import type { SportKey } from "../../sports/emerging/types";
import { getCompetitionTitle } from "../../constants/competitions";
import { displayTeamName } from "../../lib/teamNames";

/** F1 checkered strip (user-specified repeating gradients). */
const F1_CHECKERED: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, #fff 25%, #fff 75%, #000 75%, #000)",
  backgroundPosition: "0 0, 4px 4px",
  backgroundSize: "8px 8px",
  backgroundColor: "#fff",
};

/** Shared team-name styling — wraps to a second line instead of clipping. */
export const TEAM_NAME_CLASS =
  "whitespace-normal text-center leading-tight break-words font-extrabold font-display text-[11px] sm:text-sm tracking-tight w-full max-w-full px-0.5";

export function formatTeamName(name: string | null | undefined): string {
  return displayTeamName(name);
}

function normalizeSport(sport: string | null | undefined): SportKey | string {
  const s = String(sport || "football").toLowerCase();
  if (s === "f1" || s === "formula_1") return "formula1";
  return s;
}

/** Absolute left sport colour strip on fixture cards. */
export function SportColorStrip({
  sport,
}: {
  sport: string | null | undefined;
}) {
  const key = normalizeSport(sport);

  if (key === "formula1") {
    return (
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-2 rounded-l-md z-[1]"
        style={F1_CHECKERED}
      />
    );
  }

  const tone =
    key === "rugby"
      ? "bg-orange-500"
      : key === "golf"
        ? "bg-white border-r border-slate-300/40"
        : "bg-blue-500";

  return (
    <span
      aria-hidden
      className={`absolute left-0 top-0 bottom-0 w-2 rounded-l-md z-[1] ${tone}`}
    />
  );
}

type MetaProps = {
  competitionId?: string | null;
  competitionName?: string | null;
  className?: string;
};

/**
 * Competition sub-header row for the feed (date → competition → fixtures).
 */
export function CompetitionSubHeader({
  competitionId,
  competitionName,
  className = "",
}: MetaProps) {
  if (!competitionId && !competitionName) return null;
  const title = getCompetitionTitle(competitionId, competitionName);
  return (
    <div
      className={`flex items-center gap-2 px-1 ${className}`}
      title={title}
    >
      <CompetitionFlag
        competitionId={competitionId}
        competitionName={competitionName}
        showTitle={false}
        size={14}
      />
      <span className="text-[10px] sm:text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400 truncate">
        {title}
      </span>
    </div>
  );
}

/** @deprecated Competition meta is rendered as feed sub-headers. */
export function CardCompetitionMeta({
  competitionId,
  competitionName,
  className = "",
}: MetaProps) {
  return (
    <CompetitionSubHeader
      competitionId={competitionId}
      competitionName={competitionName}
      className={className}
    />
  );
}

/** Shared size for kick-off + Locked/Unpicked bottom-corner metadata. */
export const CARD_CORNER_META_CLASS =
  "font-mono text-[10px] font-bold uppercase tracking-wider leading-none";

/** Kick-off time — bottom-left of the card, clear of team names / inputs. */
export function CardKickoffTime({
  matchDate,
  className = "",
}: {
  matchDate: string;
  className?: string;
}) {
  const label = new Date(matchDate).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <span
      className={`${CARD_CORNER_META_CLASS} tabular-nums text-slate-400 tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

/** @deprecated Prefer CompetitionSubHeader */
export function CompetitionHeaderLabel({
  competitionId,
  competitionName,
  className = "",
}: MetaProps & { sport?: SportKey }) {
  return (
    <CompetitionSubHeader
      competitionId={competitionId}
      competitionName={competitionName}
      className={className}
    />
  );
}

export function CompetitionTitleRow({
  competitionId,
  competitionName,
  className = "",
}: MetaProps) {
  if (!competitionId && !competitionName) return null;
  return (
    <span className={`truncate ${className}`}>
      {getCompetitionTitle(competitionId, competitionName)}
    </span>
  );
}

export { CompetitionFlag };
