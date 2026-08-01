/**
 * Match-card chrome: sport colour strip + kick-off meta.
 * Competition context lives in feed sub-headers (not in-card).
 */
import React from "react";
import CompetitionFlag from "./CompetitionFlag";
import type { SportKey } from "../../sports/emerging/types";
import { getCompetitionTitle } from "../../constants/competitions";
import { displayTeamName } from "../../lib/teamNames";
import { isLiveMatch } from "../../lib/matchStatus";
import type { Match } from "../../types";

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

/** Centre-column status for upcoming fixtures. */
export function MatchCentreStatusLabel({
  match,
}: {
  match: Pick<Match, "status">;
}) {
  if (isLiveMatch(match)) {
    return (
      <span className="inline-flex items-center justify-center gap-1.5 text-rose-400 font-mono text-[10px] uppercase tracking-widest font-bold">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
        </span>
        IN PLAY
      </span>
    );
  }
  if (match.status === "completed") {
    return (
      <span className="text-green-500 font-mono text-[10px] uppercase tracking-widest font-bold">
        Finished
      </span>
    );
  }
  return (
    <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest font-bold">
      To be played
    </span>
  );
}

/** Live score block for the centre column between team names. */
export function MatchLiveScoreCentre({
  homeScore,
  awayScore,
  matchMinute,
}: {
  homeScore?: number | null;
  awayScore?: number | null;
  matchMinute?: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-display font-black text-xl sm:text-2xl tracking-widest text-white tabular-nums leading-none">
        {homeScore != null ? homeScore : "–"}
        <span className="mx-1.5 text-slate-500">–</span>
        {awayScore != null ? awayScore : "–"}
      </span>
      {matchMinute ? (
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-rose-300/90">
          {matchMinute}
        </span>
      ) : null}
    </div>
  );
}

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
