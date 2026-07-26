# PitchSide Architecture Map

Concise system map after the Jul 2026 audit. Keep Football/Rugby prediction paths isolated from emerging sports (F1/Golf).

---

## 1. Main entry points & route interceptors

| Layer | Path | Role |
|-------|------|------|
| Bootstrap | `src/main.tsx` | React root, `BrowserRouter`, TanStack `QueryClientProvider` |
| Shell | `src/App.tsx` → `AppShell` | Splash gate, auth state, overlays (Rules / Admin / Account), SPA routes |
| Cold start | `src/lib/initializePlatform.ts` | Concurrent preload: session profile + 9-day match horizon + user leagues/predictions → seeds React Query cache |
| Auth screens | `AuthFlow`, `LoginView`, `ResetPasswordView` | Email/password + Google/Apple OAuth (`OAuthButtons`) |
| Session hydrate | `src/components/auth/authSession.ts` | `profileFromSession`, nickname→email RPC, login |

### Auth / onboarding gatekeeper

```
Splash (MIN_SPLASH_MS)
  → initializePlatform()
  → no session → guest Login / Register
  → session + needsOnboarding(profile) → OnboardingFlow
       (nationality ≠ Global, selected_sports non-empty)
  → else → Dashboard
```

`needsOnboarding()` lives in `src/components/OnboardingFlow.tsx`. OAuth users get null country / empty `selected_sports` via `handle_new_user` migration so they always hit onboarding.

### Routes (`react-router-dom`)

| Route | Component |
|-------|-----------|
| `/join`, `/join/:leagueId` | `JoinLeague` invite flow |
| `*` | Auth shell + Dashboard SPA (admin/account/rules are overlays, not routes) |

---

## 2. Unified workspace engine (sport routing)

```
Dashboard
  ├─ SportSelectorBanner / EmergingSportNav  (selected_sports)
  ├─ Football | Rugby → PredictionsPage → MatchPredictor
  ├─ Formula 1 → EmergingSportWorkspace → F1GridPredictor
  └─ Golf → EmergingSportWorkspace → GolfTierPredictor (+ GolfMulliganPanel)
```

| Concern | Location |
|---------|----------|
| Feature flags / role | `src/sports/emerging/featureFlags.ts` |
| Catalog hooks | `useF1DriversQuery`, `useF1ConstructorsQuery`, `useGolfPlayersQuery` |
| Helmet assets | `HELMET_MAP` → local `public/*.png` via `F1HelmetIcon` |
| Core fixtures | `useMatchesQuery` (horizon) + `acquireMatchesRealtime` |
| Leaderboards / leagues | `LeaderboardsPage`, `LeagueHub`, `LeagueHubStandings` |

Football/Rugby lock-guess + scoring stay in `MatchPredictor` / `utils.calculatePoints`. F1/Golf predictors are UI-first; persistence tables (`f1_predictions`, `golf_predictions`) exist in Supabase for upcoming write paths.

---

## 3. Offline drafting engine

```
User edits scores offline
  → useOfflineDraft.saveDraft(localStorage key: pitchside:offline-draft:{userId}:{eventId})
  → OfflineDraftBanner (PredictionsPage)
  → on reconnect / Apply: write predictions via Supabase
  → DB trigger (prediction_lock_time_enforcement)
       rejects post-kickoff writes with "Event locked…"
  → Frontend maps that to LOCK_TIME_PASSED_TOAST
  → clearDraft on success
```

Key files: `src/hooks/useOfflineDraft.ts`, `src/components/OfflineDraftBanner.tsx`, migration `20260723120000_prediction_lock_time_enforcement.sql`.

---

## 4. Data fetching & realtime (post-audit)

| Fetch | Window / scope |
|-------|----------------|
| Matches (player) | `MATCH_HORIZON_DAYS = 9` + live status; explicit `MATCH_LIST_COLUMNS` |
| Completed (standings) | `STANDINGS_COMPLETED_HORIZON_DAYS = 180` |
| Predictions (user) | User-scoped column list (still full history — consider season window later) |
| Profiles list / members | Explicit `PROFILE_LIST_COLUMNS` (no `SELECT *`) |
| F1 / Golf catalogs | Explicit columns; client filters outdated driver ids |
| Realtime matches | Ref-counted channel in `matchesRealtime.ts` (safe unmount) |
| Realtime profiles/leagues | `useSupabaseRealtime.ts` — `removeChannel` on cleanup |

---

## 5. Active database tables & foreign keys

### Tables (`public`)

| Table | Purpose |
|-------|---------|
| `profiles` | User contestant profile + sports prefs + mulligans |
| `matches` | Football/Rugby fixtures + live fields |
| `predictions` | Score predictions per user/match |
| `leagues` | Private/public social leagues |
| `league_members` | Membership junction |
| `competitions` / `custom_competitions` | Competition catalog |
| `teams` | Team cache (logos / FK targets) |
| `power_up_wallet` | Power-up inventory (launch-locked UI) |
| `archived_players` / `unsubscribed_emails` | Soft-delete / marketing opt-out |
| `api_quota_usage` / `api_fixture_checks` | API-Sports ops |
| `f1_constructors` / `f1_drivers` / `f1_races` / `f1_predictions` | F1 domain |
| `golf_players` / `golf_tournaments` / `golf_predictions` | Golf domain |

### Foreign keys

| From | Column | To |
|------|--------|-----|
| `f1_drivers` | `constructor_id` | `f1_constructors.id` |
| `f1_predictions` | `race_id` | `f1_races.id` |
| `golf_predictions` | `tournament_id` | `golf_tournaments.id` |
| `league_members` | `league_id` | `leagues.id` |
| `league_members` | `user_id` | `profiles.id` |
| `matches` | `home_team_id` / `away_team_id` | `teams.id` |
| `power_up_wallet` | `user_id` | `profiles.id` |
| `predictions` | `user_id` | `profiles.id` |

Auth users live in `auth.users`; `profiles.id` mirrors auth uid (created by `handle_new_user`).

### F1 2026 grid (canonical)

22 drivers / 11 teams. Outdated ids (`doohan`, `tsunoda`, `drugovich`) are deleted via migration and filtered client-side.

---

## 6. Audit leftovers (intentional keep / follow-ups)

**Kept on purpose**
- `FALLBACK_DRIVERS` / constructors / golfers — empty-table / offline catalog safety
- `SUPPORTED_TEAMS`, `POWER_UPS`, competition catalog dual-source until fully DB-driven
- Admin “soon” metric placeholders

**Follow-ups**
- Window or paginate per-user prediction history on cold start
- Persist F1/Golf predictor confirms into `f1_predictions` / `golf_predictions`
- Narrow `dbFetchPlayers` further (or replace with nickname RPC) so Dashboard does not hydrate full profile lists for every child
- Dedicated drag handles on F1 pool cards to further improve mobile scroll vs DnD
