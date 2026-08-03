import React from "react";
import CompetitionGlyph from "./CompetitionGlyph";
import { getCompetitionTitle } from "../../constants/competitions";

type Props = {
  competitionId?: string | null;
  competitionName?: string | null;
  className?: string;
  showTitle?: boolean;
  titleClassName?: string;
  size?: number;
};

/**
 * Competition indicator — flagcdn flags, Trophy for FIFA / Rugby World Cup.
 */
export default function CompetitionFlag({
  competitionId,
  competitionName,
  className = "",
  showTitle = true,
  titleClassName = "",
  size = 16,
}: Props) {
  const title = getCompetitionTitle(competitionId, competitionName);

  return (
    <span
      className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}
      title={showTitle ? title : undefined}
    >
      <CompetitionGlyph
        competitionId={competitionId}
        alt={title}
        size={size}
        className="rounded-sm overflow-hidden shadow-sm shadow-black/40"
      />
      {showTitle ? (
        <span className={`truncate ${titleClassName}`}>{title}</span>
      ) : (
        <span className="sr-only">{title}</span>
      )}
    </span>
  );
}
