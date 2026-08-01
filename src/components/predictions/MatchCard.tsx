/**
 * Match-card chrome: sport colour strip + in-card competition / time meta.
 */
import React from "react";
import CompetitionFlag from "./CompetitionFlag";
import type { SportKey } from "../../sports/emerging/types";
import { getCompetitionTitle } from "../../constants/competitions";

const F1_CHECKERED: React.CSSProperties = {
  backgroundColor: "#fff",
  backgroundImage: `
    repeating-linear-gradient(
      45deg,
      #000 25%,
      transparent 25%,
      transparent 75%,
      #000 75%,
      #000
    ),
    repeating-linear-gradient(
      45deg,
      #000 25%,
      #fff 25%,
      #fff 75%,
      #000 75%,
      #000
    )
  `,
  backgroundPosition: "0 0, 4px 4px",
  backgroundSize: "8px 8px",
};

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
        ? "bg-white"
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

/** Compact in-card competition flag + title (muted). */
export function CardCompetitionMeta({
  competitionId,
  competitionName,
  className = "",
}: MetaProps) {
  if (!competitionId && !competitionName) return null;
  const title = getCompetitionTitle(competitionId, competitionName);
  return (
    <span
      className={`inline-flex items-center gap-1.5 min-w-0 text-[9px] font-mono font-semibold uppercase tracking-wide text-slate-500 ${className}`}
      title={title}
    >
      <CompetitionFlag
        competitionId={competitionId}
        competitionName={competitionName}
        showTitle={false}
        size={12}
      />
      <span className="truncate">{title}</span>
    </span>
  );
}

/** Kick-off time for the in-card left column. */
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
      className={`font-mono text-[10px] sm:text-[11px] font-bold tabular-nums text-slate-400 tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

/** @deprecated Prefer CardCompetitionMeta */
export function CompetitionHeaderLabel({
  competitionId,
  competitionName,
  className = "",
}: MetaProps & { sport?: SportKey }) {
  return (
    <CardCompetitionMeta
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
