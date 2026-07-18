/**
 * Persistent feature-tour flags stored on profiles.seen_features (JSONB).
 * Add new keys here when shipping targeted tutorials (e.g. Golf).
 */

export const SeenFeature = {
  /** Full dashboard OnboardingTour — first login only. */
  MainWalkthrough: "main_walkthrough",
  /** Just-in-time Football scoring intro. */
  FootballIntro: "football_intro",
  /** Just-in-time Rugby scoring intro. */
  RugbyIntro: "rugby_intro",
  // Future examples (uncomment when shipping):
  // GolfTutorial: "golf_tutorial",
} as const;

export type SeenFeatureKey =
  | (typeof SeenFeature)[keyof typeof SeenFeature]
  | (string & {});

export type SeenFeatures = Record<string, boolean>;

export function parseSeenFeatures(raw: unknown): SeenFeatures {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SeenFeatures = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === true) out[key] = true;
  }
  return out;
}

export function hasSeenFeature(
  features: SeenFeatures | null | undefined,
  key: SeenFeatureKey,
): boolean {
  return !!features?.[key];
}
