# PitchSide Architecture Map

System map after the Aug 2026 comprehensive audit (live project `rdxilidssfrixvlylnjq`). Football/Rugby prediction paths stay isolated from emerging sports (F1/Golf) scaffolding.

---

## 1. Entry points & route interceptors

| Layer | Path | Role |
|-------|------|------|
| Bootstrap | `src/main.tsx` | React root, `BrowserRouter`, TanStack `QueryClientProvider` |
| Shell | `src/App.tsx` → `AppShell` | Splash gate, auth waterfall, overlays (Rules / Admin / Account), SPA routes |
| Cold start | `src/lib/initializePlatform.ts` | Concurrent preload: session profile + match horizon + user leagues/predictions → React Query cache |
| Auth UI | `LoginView`, `AuthFlow`, `ResetPasswordView`, `pages/Login.tsx`, `pages/UpdatePassword.tsx` | Email/password + OAuth; recovery redirect |
| Session hydrate | `src/components/auth/authSession.ts` | `profileFromSession`, nickname→email RPC, login / password reset |

### Auth / onboarding waterfall

```
Splash (MIN_SPLASH_MS + initializePlatform)
  → !authHydrated / profile loading → spinner
  → no session → guest Login | Signup | ResetPassword
       (/?auth=signup|login honored; /login, /update-password routes)
  → session + needsCompleteProfile → CompleteProfile (username/name)
  → session + needsOnboarding → OnboardingFlow (nation + sports)
  → ready → Dashboard
```

Admin / Account / Rules are **overlays** (not primary routes), except:

| Route | Component |
|-------|-----------|
| `/terms`, `/privacy` | Legal pages |
| `/join`, `/join/:leagueId` | League invite |
| `/login` | Standalone login (+ inline forgot password) |
| `/update-password` | Recovery session password update |
| `/admin` | Admin-gated **broadcast** page only (full admin = Dashboard overlay) |
| `*` | Auth shell + Dashboard |

---

## 2. Core state & global data flow

```
AppShell
  ├─ sessionUserId (Supabase Auth) — login truth
  ├─ currentUser (UserProfile) — hydrated from profiles
  ├─ registeredUsers — dbFetchPlayers (scoped PROFILE_LIST_COLUMNS)
  └─ React Query cache
       ├─ matches (horizon) + acquireMatchesRealtime (refcount channel)
       ├─ predictions (per user)
       ├─ leagues / user leagues
       └─ leaderboards (RPC)
```

| Concern | Location |
|---------|----------|
| Match list + live scores | `useMatchesQuery`, `matchesRealtime`, `useSupabaseRealtime` |
| Predictions feed | `PredictionsPage` → `MatchPredictor` (`useWindowVirtualizer`) |
| Leaderboards | `LeaderboardsPage`, `get_global_leaderboard` RPC |
| Private leagues | `LeagueHub`, `LeagueHubStandings`, `get_league_member_predictions` |
| Account | `AccountPortal` — desktop sidebar; mobile accordion (core features only) |
| Notifications | `usePushNotifications`, edge `notify-24h-unpicked`, `weekly-fixture-email` |
| Admin | `AdminPanel` tabs; broadcast via `pages/AdminDashboard` + `admin-broadcast` |
| Emerging sports | `src/sports/emerging/*` — UI scaffolding; workspace not mounted on Dashboard |
| Offline drafts | `useOfflineDraft` + `OfflineDraftBanner` |

### Accuracy / points yield

Shared helper: `formatAccuracyFromBasePoints(base, settled)` → `(base / (settled × 5)) × 100`.

Used by Player Profile, Accuracy breakdown, and Prediction History Performance HUD.

---

## 3. Offline draft & optimistic flows

```
User edits scores offline
  → useOfflineDraft.saveDraft (localStorage: pitchside:offline-draft:{userId}:{eventId})
  → OfflineDraftBanner
  → reconnect / Apply → Supabase predictions upsert
  → DB trigger prediction_lock_time_enforcement
       rejects post-kickoff writes
  → clearDraft on success
```

Other optimistic paths:

| Flow | Pattern |
|------|---------|
| Tournament opt-in | Local profile update + `dbUpdateTournamentSubscriptions` |
| Email/push toggles | Immediate `profiles` update + push subscribe RPC |
| Chip lock | Confirm modal → prediction write with `applied_chip_id` |
| Admin FT override | FixturesManager → force resettle RPC |

---

## 4. Active public tables & relationships

Live schema (27 tables). Declared FKs from Postgres; logical-only links called out.

### Core prediction domain

| Table | PK | Foreign keys / notes |
|-------|----|----------------------|
| `profiles` | `id` (text) | Conventionally = `auth.users.id` (no declared FK). Referenced by predictions, league_members, chips, push_* |
| `matches` | `id` | `home_team_id` → `teams`; `away_team_id` → `teams` |
| `predictions` | `id` | `user_id` → `profiles`; `applied_chip_id` → `user_chips`; **`match_id` → matches is logical only (no FK)** |
| `leagues` | `id` | Referenced by `league_members`, `sport_seasons.global_league_id` |
| `league_members` | `(league_id, user_id)` | → `leagues`, → `profiles` |
| `user_chips` | `id` | → `profiles`; → `sport_seasons`; `applied_fixture_id` → `matches` |
| `chip_wallet` | `id` | → `profiles` |
| `archived_players` | `id` | Soft-delete archive blob (no FKs) |
| `unsubscribed_emails` | `email` | Mailing exclusions |

### Notifications

| Table | FKs |
|-------|-----|
| `push_subscriptions` | `user_id` → `profiles` |
| `push_notification_log` | `user_id` → `profiles`; `match_id` → `matches` |

### Ingestion / ops

| Table | Role / FKs |
|-------|------------|
| `competitions`, `custom_competitions` | Catalog (no FKs) |
| `teams` | Catalog; referenced by `matches.*_team_id` |
| `sport_seasons` | `global_league_id` → `leagues`; enums: football/rugby/f1/golf |
| `api_quota_usage`, `api_fixture_checks` | API-Sports budget |
| `system_metrics` | Edge sync health |
| `preeminent_teams`, `pitchside_picks_teams` | Digest / feed curation |

### Emerging sports

| Table | FKs |
|-------|-----|
| `f1_constructors` | ← `f1_drivers.constructor_id` |
| `f1_drivers` | `constructor_id` → `f1_constructors` |
| `f1_races` | ← `f1_predictions.race_id` |
| `f1_predictions` | `race_id` → `f1_races`; `user_id` → `auth.users` |
| `golf_players` | Catalog |
| `golf_tournaments` | ← `golf_predictions.tournament_id` |
| `golf_predictions` | `tournament_id` → `golf_tournaments`; `user_id` → `auth.users` |

### Important RPCs

| RPC | Purpose |
|-----|---------|
| `delete_user_account()` | Self-serve cascade wipe + `auth.users` delete |
| `is_pitchside_admin()` | Admin gate |
| `upsert_push_subscription` | Web Push store |
| `get_global_leaderboard` / league prediction RPCs | Rankings with settled points |
| `reserve_api_quota` / `record_api_quota_headers` | Per-sport API budget |

---

## 5. Edge functions (active)

| Function | Trigger | Notes |
|----------|---------|-------|
| `weekly-fixture-email` | Cron Mon 08:00 | Max 5 curated fixtures; Resend |
| `notify-24h-unpicked` | Cron hourly | Web Push for unpicked ~24h fixtures |
| `admin-broadcast` | Admin JWT | Push + email; `Promise.all` dispatches |
| `contact-support` | Auth JWT | Resend → `admin@pitchside.pro` |
| Schedule / settle syncs | Cron / scripts | Shared football league catalog |

---

## 6. Audit outcomes (Aug 2026)

### Removed / pruned

- Unused modules: `leagueMemberBadge.ts`, `golfCoverageFilter.ts`, `SportSelectorBanner.tsx`, `CompetitionFilterRail` UI, `EMERGING_SPORT_META`
- Hook relocated: `usePersistedCompetitionFilter` → `src/hooks/usePersistedCompetitionFilter.ts`
- Trimmed unused `classifyAuthProviders` from `authProviders.ts`

### Fixed / hardened

- Seed + live-settle football catalog aligned with edge (`528` Community Shield + European leagues)
- `PROFILE_LIST_COLUMNS` includes notification / favorite team fields (typed on `ProfileRow`)
- `archived_players` select narrowed (no `SELECT *` anywhere in client)
- Admin fixtures fetch bounded to **120-day** horizon
- `/?auth=signup` / `auth=login` query handoff wired in `AppShell`
- Mobile Account: accordion (not horizontal tabs); management tabs desktop-only
- HUD accuracy = points yield (same formula as Player Profile)
- Sport icons use `loading="lazy"` + `decoding="async"`; F1 helmets keep chip fallback

### Known follow-ups (not blocking)

- Virtualize Leaderboards / HistoricScores / FixturesManager full lists (predictions feed already uses `useWindowVirtualizer`)
- Scope `dbFetchPredictions` by season for history views
- Add FK `predictions.match_id → matches(id)` after orphan cleanup
- Mount or delete F1/Golf workspace tree in one deliberate pass
- `/admin` route is broadcast-only — consider redirect into AdminPanel Broadcast tab
- Broad `any` casts remain in some `supabase.ts` mappers (league/team rows); tighten when generating typed Supabase client

---

## 7. Mobile notes

- Bottom nav + tab swipe: `data-no-swipe="true"` on interactive controls
- Account management (email/password/delete/general) **desktop-only**
- Mobile Account Hub + exclusive accordion for competitions / leagues / history / support
- Images: local `public/` sport + helmet assets; PWA icons via `manifest.json` / `sw.js`
- Dashboard / Account shells use `touch-pan-y` so vertical scroll is not blocked by gesture sensors
