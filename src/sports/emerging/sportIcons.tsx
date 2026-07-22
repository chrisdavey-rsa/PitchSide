/**
 * Public-folder sport icons for nav / onboarding / announcements.
 * Paths resolve from Vite `public/` (served at site root).
 *
 * Colour variants (`*-colour.png`) are used for live / unlocked sports.
 * Base assets are used when a sport is greyscale / inactive.
 */

import type { SportKey } from './types';

/** Full-colour icons (live Football/Rugby; unlocked Golf/F1 for admins). */
export const SPORT_ICON_SRC: Record<SportKey, string> = {
  football: '/football.png',
  rugby: '/rugby-ball.png',
  golf: '/golf-ball-colour.png',
  formula1: '/racing-helmet-colour.png',
};

/** Muted / silhouette assets for inactive Golf & F1. */
export const SPORT_ICON_SRC_MUTED: Partial<Record<SportKey, string>> = {
  golf: '/golf-ball.png',
  formula1: '/racing-helmet.png',
};

export type SportIconProps = {
  sport: SportKey;
  className?: string;
  alt?: string;
  /** When false, use muted asset if available (Golf/F1 inactive). Default true. */
  colored?: boolean;
};

export function SportIcon({
  sport,
  className = 'h-5 w-5',
  alt,
  colored = true,
}: SportIconProps) {
  const src =
    !colored && SPORT_ICON_SRC_MUTED[sport]
      ? SPORT_ICON_SRC_MUTED[sport]!
      : SPORT_ICON_SRC[sport];

  return (
    <img
      src={src}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      className={`object-contain shrink-0 ${className}`}
      draggable={false}
    />
  );
}
