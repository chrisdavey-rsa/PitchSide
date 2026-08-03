import React from "react";
import { Trophy } from "lucide-react";
import CountryFlag from "../CountryFlag";
import { getCompetitionFlagCode } from "../../constants/competitions";

const WORLD_CUP_IDS = new Set(["f-worldcup", "r-worldcup"]);

export function isWorldCupCompetition(
  competitionId: string | null | undefined,
): boolean {
  return !!competitionId && WORLD_CUP_IDS.has(competitionId);
}

type Props = {
  competitionId?: string | null;
  /** Optional override when competitionId is unknown. */
  flagCode?: string | null;
  alt?: string;
  size?: number;
  className?: string;
};

/**
 * Competition glyph: flagcdn flag, or Trophy for FIFA / Rugby World Cup.
 */
export default function CompetitionGlyph({
  competitionId,
  flagCode,
  alt = "Competition",
  size = 16,
  className = "",
}: Props) {
  if (isWorldCupCompetition(competitionId)) {
    return (
      <Trophy
        className={`shrink-0 text-amber-400 ${className}`}
        style={{ width: size, height: size }}
        aria-label={alt}
      />
    );
  }

  const code =
    flagCode !== undefined
      ? flagCode
      : getCompetitionFlagCode(competitionId);

  return (
    <CountryFlag code={code} alt={alt} size={size} className={className} />
  );
}
