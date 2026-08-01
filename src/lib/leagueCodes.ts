import { LEAGUE_ADJECTIVES, LEAGUE_NOUNS } from "../constants/leagueCodeWords";
import { supabase } from "../supabase";

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Build a speakable code like CLUTCHSTRIKER. */
export function buildSpeakableLeagueCode(): string {
  return `${pick(LEAGUE_ADJECTIVES)}${pick(LEAGUE_NOUNS)}`;
}

/**
 * Generate a unique speakable league id, retrying on rare PK collisions.
 */
export async function generateUniqueLeagueCode(
  maxAttempts = 12,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = buildSpeakableLeagueCode();
    if (!supabase) return code;
    const { data, error } = await supabase
      .from("leagues")
      .select("id")
      .eq("id", code)
      .maybeSingle();
    if (error) {
      // If the probe fails, still return a candidate — create will surface conflicts.
      console.warn("[leagueCodes] uniqueness probe failed", error.message);
      return code;
    }
    if (!data) return code;
  }
  // Extremely unlikely fallback
  return `${buildSpeakableLeagueCode()}${Math.floor(Math.random() * 90 + 10)}`;
}
