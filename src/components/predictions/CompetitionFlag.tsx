import React from "react";
import CountryFlag from "../CountryFlag";
import {
  getCompetitionFlagCode,
  getCompetitionTitle,
} from "../../constants/competitions";

type Props = {
  competitionId?: string | null;
  competitionName?: string | null;
  className?: string;
  /** Show title text next to the flag (default true). */
  showTitle?: boolean;
  titleClassName?: string;
  /** Pixel width passed to CountryFlag (flagcdn). */
  size?: number;
};

/**
 * Competition indicator using the same CountryFlag / flagcdn renderer
 * as nationality UI — rectangular rounded assets, Globe for world cups.
 */
export default function CompetitionFlag({
  competitionId,
  competitionName,
  className = "",
  showTitle = true,
  titleClassName = "",
  size = 16,
}: Props) {
  const code = getCompetitionFlagCode(competitionId);
  const title = getCompetitionTitle(competitionId, competitionName);

  return (
    <span
      className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}
      title={showTitle ? title : undefined}
    >
      <CountryFlag
        code={code}
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
