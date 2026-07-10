---
name: preferredSport field
description: Where preferredSport lives in types, supabase, AuthFlow, and Dashboard.
---

## What was done

- `UserProfile.preferredSport?: SportType` added to `src/types.ts`.
- `dbFetchPlayers` maps `d.preferred_sport as SportType | undefined`.
- `dbCreatePlayer` sends `preferred_sport: profile.preferredSport || null`.
- `AuthFlow` login path maps `userProfileData.preferred_sport as SportType | undefined` into the returned profile.
- `AuthFlow` signup: `preferredSport` state auto-derives from `supportedTeam` via `useEffect` (MAJOR_TEAMS_LIST `.sport` field); user can override via a Football/Rugby toggle shown after the team dropdown.
- `supabase.auth.signUp` options.data includes `preferred_sport: preferredSport`.
- `Dashboard.tsx` initialises `selectedSport` with `user?.preferredSport ?? null` instead of `null`.

## Why

Personalises the landing sport view for each user without requiring a separate onboarding step.

## How to apply

`preferred_sport text` column must exist on the `profiles` Supabase table (run a migration if not present). The frontend degrades gracefully if the column is absent — field just returns `undefined`.
