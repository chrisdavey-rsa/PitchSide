# PitchSide — Project Documentation

> **PitchSide** is a sports score-prediction platform for Football and Rugby. Players join private or public leagues, predict scorelines for upcoming fixtures, lock their guesses before kick-off, and climb per-sport leaderboards. Points are settled automatically once results are entered.

**Stack:** React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · `motion` (Framer Motion) · lucide-react · TanStack React Query 5 · Supabase (PostgreSQL + Auth + RPC).

**Scripts:** `npm run dev` (Vite on `127.0.0.1:5000`) · `npm run build` · `npm run lint` (`tsc --noEmit`).

---

## Table of Contents
1. [User-Facing Features](#1-user-facing-features)
2. [Gameplay Mechanics](#2-gameplay-mechanics)
3. [Advanced Game States](#3-advanced-game-states)
4. [Database & Technical Architecture](#4-database--technical-architecture)
5. [Technical Debt & Immediate Blindspots](#5-technical-debt--immediate-blindspots)

---

## 1. User-Facing Features

### 1.1 Authentication Flow

Authentication is orchestrated in `src/App.tsx` and the dedicated views under `src/components/auth/`. The guest experience is driven by a single `guestAuthView` state machine:

| State | View | Purpose |
|-------|------|---------|
| `login` | `LoginView.tsx` | Default. Username **or** email + password. |
| `signup` | `AuthFlow.tsx` | Signup-only registration form. |
| `reset-request` | `ResetPasswordView.tsx` (mode `request`) | Enter email to receive a reset link. |
| `reset-update` | `ResetPasswordView.tsx` (mode `update`) | Set a new password after clicking the email link. |

Shared helpers live in `src/components/auth/authSession.ts`; the shared visual shell is `AuthCard.tsx`.

**Login by nickname or email.** `performLogin()` accepts either. If the input isn't an email, it resolves the nickname to an email via the `get_email_by_nickname` RPC, then calls `supabase.auth.signInWithPassword`.

**Password reset (two states).**
- **State A (Request):** `requestPasswordReset()` calls `resetPasswordForEmail` with `redirectTo: window.location.origin`.
- **State B (Update):** A Supabase `PASSWORD_RECOVERY` event (or a `type=recovery` URL hash) forces the app into `reset-update`. After the new password is saved the user is signed out and returned to `login` with a success banner.

**Email verification (best-UX routing).** After a user clicks the verify-email link:
1. `readAuthHash()` detects `type=signup/email/invite` tokens in the URL hash and skips the splash screen.
2. On the `SIGNED_IN` event the app builds the profile (`profileFromSession`), routes straight to the **Dashboard**, and shows a **"Welcome to PitchSide, {nickname}!"** toast. This also triggers the first-run onboarding tour.
3. **Fallback:** if the session fails to auto-establish within ~2.5s, the user is routed to `LoginView` with the message *"Email verified! Please log in."*

Clicking the logo on any auth view replays the splash animation; users can always navigate back to Login/splash from isolated auth views.

### 1.2 The Match Predictor

`src/components/Dashboard/MatchPredictor.tsx` is the core prediction surface. It is only rendered when the user belongs to at least one league (`isUserInAnyLeague`).

**Flow:** Two large sport tiles (Football / Rugby) → competition filter grid → per-fixture prediction cards grouped by date.

- **Football fixtures:** stepper inputs (`+`/`−` and a numeric field) for a home and away scoreline.
- **Rugby fixtures:** a winner selector (Home / Draw / Away) plus a winning-margin dropdown — reflecting rugby's margin-based scoring.

**The "Padlock" Lock Guess button** (`src/components/Dashboard/LockGuessButton.tsx`):
- Idle state renders a stylized PitchSide **"P."** mark (including the brand's green full-stop dot).
- On click, the "P" **spring-morphs into a closed padlock** (`motion` + `AnimatePresence`, lucide `Lock`) to signify the prediction is locked.
- When `prediction.submitted === true` the button settles into a **solid green, bordered "Locked"** state.
- Fixtures that have kicked off without a submission show a "Match Started" chip instead.

**The "Anticipation" / Hidden Consensus mechanic:**
- While `prediction.submitted === false`, the card shows **only the score inputs**.
- Once the guess is **locked**, a muted **"Community Consensus"** area animates in below the inputs, currently rendering placeholder copy: *"Consensus revealing soon…"*. This reserves the layout for a future crowd-consensus reveal and reinforces that intel is withheld until a player has committed — preventing herd-following.

Email-unverified users see a "Verify email to play" state instead of the lock button.

### 1.3 The League Hub

Leagues are the player's home base; the Match Predictor stays locked until the user joins one.

- **Management** (`LeagueManagementPanel.tsx` / `LeagueManager.tsx`): list your leagues, join with a code + password, browse public leagues, or create a private competition. Opened via a radial-expansion modal.
- **Detail view** (`LeagueHub.tsx`): a league header, a **Standings** table (ranked members with points, picks and accuracy, expandable per-player stats), the join code, join/leave controls, and a **Live Tournament Predictor Comparison** matrix showing every member's locked picks per fixture (opponents' picks stay hidden until kick-off) with live points once results are in.
- A green shimmer highlights the Leagues navigation entry when a user isn't in any league yet.

**Dashboard leaderboard scope — "My League" vs "Global"** (`Dashboard/Leaderboard.tsx`):
- A tab toggle appears when the user is in a private league.
- The view **defaults to "My League"**, showing the standings of the user's **most populated private league**; **Global** requires a click.
- **Neighborhood view:** on the global board, if the current user ranks outside the Top 5, the table condenses to ranks **1–3**, an **ellipsis divider**, then the player **directly above**, **the user** (★-highlighted), and the player **directly below** — giving everyone a local target to chase.
- A Football/Rugby sport toggle switches which per-sport totals are shown.

### 1.4 JIT Contextual Onboarding

Two complementary onboarding systems:

- **First-run tour** (`OnboardingTour.tsx`): a guided walkthrough shown once per user (`hasCompletedOnboarding_{userId}` in `localStorage`) pointing out the Match Predictor, Leagues, and Rules/Account navigation.
- **Just-in-time sport intro** (`src/components/onboarding/SportIntroModal.tsx`): the first time a player opens a **Football** or **Rugby** competition, a compact, highly-visual modal explains that sport's scoring brackets and forgiveness rule, dismissed with a **"Let's Play"** button. Tracked per sport via `hasSeenFootballIntro` / `hasSeenRugbyIntro` in `localStorage`. The Football modal highlights the Drops mechanic; the Rugby modal explicitly states **there are no drops in Rugby**.

---

## 2. Gameplay Mechanics

Scoring runs authoritatively server-side (see §4) with a matching client-side fallback in `src/utils.ts`. The two implementations are kept in sync.

### 2.1 Football Scoring

Outcome (win/draw/loss) must be correct first — a wrong outcome scores 0.

| Points | Condition |
|:------:|-----------|
| **5** | Exact scoreline correct (e.g. predict 2–0, result 2–0). |
| **3** | Correct outcome **and** correct goal margin, but wrong scoreline (e.g. predict 3–1, result 2–0). |
| **1** | Correct outcome only (wrong margin). Includes correctly-called draws with a different scoreline (e.g. predict 2–0, result 1–0). |
| **0** | Wrong outcome. |

> Implemented in `pitchside_football_points` (SQL), `calculateFootballPoints` (`src/utils.ts`), and `supabase/functions/sync-settlement/index.ts`. Documented in-app in `RulesInfo.tsx` and the Football `SportIntroModal`.

### 2.2 Rugby Scoring (updated brackets)

Rugby is margin-based. The winner must be correct first; then the score depends on the **margin difference** — the absolute gap between the predicted winning margin and the actual winning margin.

| Points | Condition (margin difference) |
|:------:|-------------------------------|
| **5** | Exact — margin difference of **0**. |
| **3** | Margin difference **≤ 7**. |
| **1** | Margin difference **≤ 10**. |
| **0** | Wrong winner, or margin difference **> 10**. |

> These brackets replaced the previous ±3 / ±5 point system. They are implemented in `pitchside_rugby_points` (SQL) and `calculateRugbyPoints` (`src/utils.ts`), and documented in-app in `RulesInfo.tsx` and the Rugby `SportIntroModal`.

### 2.3 The Football Forgiveness Mechanic ("Drops")

To keep long football seasons fair, each football competition has a **drop allowance** — a player's worst results are excluded from their official total once they've played enough games.

- **Per-competition allowances:** Premier League = 4, Championship = 6, Scottish Premiership = 4, other football competitions = 0.
- **Rugby:** no drops — every rugby prediction counts toward the total.
- **Formula (per competition):**
  - `drops_used = LEAST(drops_allowed, GREATEST(0, settled_games − drops_allowed))`
  - `best_points = sum(all settled points) − sum(the worst drops_used results)`
  - `ghost_points = sum(all settled points)` (nothing dropped)
- A player always keeps at least `drops_allowed` games before any drop applies, so low-participation players are never zeroed out. For a full 38-game EPL season with a 4-drop allowance this reproduces the classic "best 34 of 38".
- **Leaderboard surfacing:** the official total is `best_points`; **Ghost Points** (the undropped total) are shown in muted text, and a **"Drops: N"** badge shows remaining forgiveness per sport (rugby shows "No drops").

The allowance table is defined in three synchronized places: the SQL `pitchside_competition_drops()` function, `COMPETITION_DROPS_ALLOWED` in `src/supabase.ts`, and mirrored logic in the client fallback.

---

## 3. Advanced Game States

### 3.1 "High Stakes" Fixture Tags

Fixtures can carry an optional `matchTag` (`Match.matchTag` in `src/types.ts`; `matches.match_tag` column in the DB) — e.g. **"Barrage Bout"**, **"Derby"**, **"Cup Run"**.

When present, the fixture card renders a premium **gold/neon outline badge** with a subtle pulsing glow at the top-left, and the card border shifts to amber. This is deliberate visual groundwork for upcoming **point-multiplier** mechanics on marquee games. The column exists and the UI supports it; tag assignment/multiplier logic is not yet wired.

### 3.2 The Power-Up Wallet

A minimal **Power-Up Wallet** strip sits above the fixture list in the Match Predictor. It surfaces the player's strategic assets as a constant psychological reminder. Two chips currently ship (hardcoded status for now):

- **URC Shield Bank** — bank a locked result and shield it from a bad round (status: *"1 Available"*).
- **UCL Joker** — nominate one Champions League team for double points (status: *"Arsenal"*).

Chips are clickable and open the explainer modal.

### 3.3 Centralized Power-Up Explanations (PowerUpModal)

A single source of truth drives every power-up surface:

- **Data dictionary** — `src/data/powerUps.ts` exports `POWER_UPS` and `getPowerUp(id)`. Each entry defines `id`, `name`, `tagline`, `icon`, `description`, `howToEarn`, `howToUse`, `gameImpact`, and a visual `theme`.
- **Reusable modal** — `src/components/powerups/PowerUpModal.tsx` renders a game-styled pop-up (hero icon + glow, gradient accent bar, and "How to Earn / How to Use / Game Impact" cards) for any power-up ID.
- **Shared usage** — both the Match Predictor **wallet chips** and the **Rules page** ("Power-Up Chips" section in `RulesInfo.tsx`) open the *exact same* modal, so explanations never drift.

Persistence groundwork exists in the `power_up_wallet` table (see §4); the wallet is not yet reading/writing live inventory.

---

## 4. Database & Technical Architecture

### 4.1 Supabase Client & Data Access

`src/supabase.ts` initializes the client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` and exposes all DB operations as typed `dbX()` functions (players, predictions, matches, leagues, membership, archives, leaderboard). If env vars are absent, `supabase` is `null` and calls degrade gracefully.

### 4.2 Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User records (id = auth uid, `username` = nickname, `preferred_sport`, `is_profile_public`, `is_admin`, …). |
| `predictions` | One row per user/match pick (`predicted_home_score`, `predicted_away_score`, `submitted`, `competition_id`, `season`, `points_won`). |
| `matches` | Fixtures & results (`kickoff_time`, `status`, `actual_home_score/away_score`, and the new **`match_tag`**). |
| `leagues` | League records (`is_public`, `max_participants`, `season`, creator, password). |
| **`league_members`** | Join table mapping players ↔ leagues. Powers membership, standings and the "My League" board. |
| **`power_up_wallet`** | Per-player power-up inventory. |
| `archived_players` | Backups of deleted accounts + their predictions. |
| `unsubscribed_emails` | Mailing suppression list. |

**`league_members`** (added in the schema-reconciliation migration): composite PK `(league_id, user_id)`, foreign keys to `leagues(id)` and `profiles(id)` (both `ON DELETE CASCADE`) — the FKs are required for PostgREST's `leagues (*)` / `profiles (*)` embeds — plus indexes on each column. **RLS:** publicly readable (standings need it); a player may only insert/delete **their own** membership (`auth.uid()::text = user_id`).

**`power_up_wallet`** (added in the same migration): `user_id → profiles(id)`, `power_up_id` (matches IDs in `src/data/powerUps.ts`), `quantity` (stackable charges, e.g. Shield Banks), `assigned_team` (targeted power-ups, e.g. the Joker), `is_active`, `season`, unique on `(user_id, power_up_id, season)`. **RLS:** strictly owner-private for both reads and writes.

### 4.3 PostgreSQL RPCs

| Function | Role |
|----------|------|
| `get_global_leaderboard(p_current_user_id)` | Computes the full leaderboard server-side: per-sport points, prediction counts, **ghost points**, and per-sport **drops used/allowed** — applying the dynamic per-competition drops mechanic. Returns all rows (the client handles Top-5/neighborhood presentation). Granted to `anon, authenticated`. |
| `get_email_by_nickname(search_nickname)` | Resolves a nickname (`profiles.username`) to an email for login-by-nickname. `SECURITY DEFINER`, pinned `search_path`, ignores freed accounts, granted to `anon` (login runs pre-auth). |
| `pitchside_football_points(...)` | Per-prediction football scoring (5/3/1/0). |
| `pitchside_rugby_points(...)` | Per-prediction rugby scoring (updated 5 / ≤7→3 / ≤10→1 / 0). |
| `pitchside_competition_drops(competition_id)` | Per-competition drop allowance (EPL 4, Championship 6, SPFL 4, else 0). |

### 4.4 Migrations

Migrations live in `supabase/migrations/` (apply in filename order):
1. `20260621121512_init_schema.sql` — base tables + permissive RLS.
2. `20260713120000_leaderboard_rpc.sql` — scoring helpers + first leaderboard RPC.
3. `20260713130000_leaderboard_best34.sql` — dynamic per-competition **Drops** leaderboard.
4. `20260714090000_rugby_points_7_10_brackets.sql` — **updated rugby brackets**.
5. `20260715_schema_reconciliation.sql` — `league_members`, `leagues` columns, `matches.match_tag`, `power_up_wallet`, `get_email_by_nickname`, and RLS for the new tables. Fully idempotent.
6. `20260715_fix_auth_trigger.sql` — corrects `handle_new_user()` metadata key mapping (so `preferred_sport`, `supported_team`, `nationality`, `phone`, `username` populate on signup), rewires the auth triggers, and back-fills existing profiles. Fully idempotent.
7. `20260715_create_competitions.sql` — `custom_competitions` table (schema only; UI not yet wired). Fully idempotent.
8. `20260715_api_automation_schema.sql` — live API-Sports columns on `matches` and `predictions` (see 4.7). Fully idempotent.
9. `20260717100000_football_points_wrong_margin_1.sql` — football wrong-margin award **2 → 1** (5/3/1/0). Keep in sync with `src/utils.ts` and `sync-settlement`.

### 4.5 Data-Fetching Strategy (React Query)

TanStack React Query is the caching/synchronization layer. Query hooks live in `src/hooks/usePitchsideQueries.ts` with centralized keys in `src/lib/queryKeys.ts`:

- `useMatchesQuery`, `usePredictionsQuery(userId)`, `useLeaguesQuery`, `useUserLeaguesQuery(userId)`, `useLeagueMembersQuery(leagueId)`, `useLeaguesMembershipQuery(leagueIds)`, `useLeaderboardQuery(userId, matches)`.
- Mutations (e.g. `useSavePredictionMutation`) invalidate the relevant keys (`predictions`, `leaderboard`) on success to keep the UI fresh.
- Presentation helpers `mapLeaderboardForSport()` (filter → sort → rank for the selected sport) and `mergeMatches()` (DB + locally-added fixtures) transform raw records for the UI.
- **Realtime:** `useSupabaseRealtime` subscribes to Postgres changes (e.g. the `profiles` channel) and invalidates queries so leaderboards/standings update live.
- **Leaderboard resilience:** `dbFetchGlobalLeaderboard` calls the RPC first and transparently falls back to a client-side computation (`computeLeaderboardClientSide`) if the RPC is unavailable, so the board always renders.

### 4.6 Component Architecture (high level)

- `App.tsx` — auth orchestration, splash, routing between guest views and the Dashboard.
- `Dashboard.tsx` — authenticated shell: navigation, Match Predictor, leaderboard scope logic, league detail, modals (Rules/Account/Admin), onboarding tour, Community Shield event.
- `Dashboard/` — `MatchPredictor`, `Leaderboard`, `LeagueHub`, `LockGuessButton`, navigation, `shared` UI atoms.
- `auth/`, `onboarding/`, `powerups/`, `events/`, `admin/`, `AccountPortal/` — feature-scoped modules.
- `data/` (`powerUps.ts`), `utils.ts` (scoring), `types.ts` (domain model).

### 4.7 Live API Data Schema

To power an **"As It Stands"** live prediction experience and **automated multipliers**, the schema is being prepared to ingest rich, live data from **API-Sports** (`20260715_api_automation_schema.sql`, fully idempotent).

The **`matches`** table now supports:

- **Provisional live scoring** — `provisional_home_score`, `provisional_away_score`, and `match_minute` carry the in-play state so players can see how their picks are tracking *before* a fixture is settled.
- **Automated odds & multipliers** — `odds_home_win`, `odds_draw`, `odds_away_win` (pre-match decimal odds) and `base_multiplier` (default `1.0`) feed automated point-multiplier mechanics that can amplify high-stakes fixtures.
- **Fixture metadata** — `round_name` and `venue_name` from the data provider.

The **`predictions`** table adds `provisional_points` (default `0`) — the live running score a prediction is currently tracking, distinct from the final settled `points_won`.

These columns are additive and nullable/defaulted, so existing manual-entry flows are unaffected. The matching TypeScript optional properties live on the `Match` and `Prediction` interfaces in `src/types.ts` (`roundName`, `venueName`, `oddsHomeWin/Draw/AwayWin`, `baseMultiplier`, `provisionalHomeScore/AwayScore`, `matchMinute`, and `provisionalPoints`). Ingestion (Edge Functions polling API-Sports) is the next step and is not yet wired.

---

## 5. Technical Debt & Immediate Blindspots

### 5.1 Manual Admin Score Entry (primary blindspot)

Results are **entered by hand** today. An administrator opens the Admin panel (`FixturesManager`) and types each fixture's final score; saving sets the match to `completed`, which triggers the leaderboard RPC to settle points.

**Risks:** human latency (leaderboards lag real life until an admin acts), typos that mis-settle points, and no coverage if an admin is unavailable. This is the single biggest operational bottleneck.

**Planned automation — API-Sports + Supabase Edge Functions:**
1. A scheduled **Edge Function** (cron) polls **API-Sports** for finished fixtures across tracked competitions.
2. It maps external fixtures to PitchSide `matches` and writes `actual_home_score` / `actual_away_score`, flipping `status` to `completed`.
3. Existing scoring RPCs (`pitchside_*_points`, `get_global_leaderboard`) settle points automatically — no scoring-logic changes required.
4. Manual admin entry remains as a supervised override / fallback for competitions API-Sports doesn't cover.

### 5.2 Other Known Gaps

- **Power-Up Wallet is display-only.** The `power_up_wallet` table exists, but the wallet chips show hardcoded values (`1 Available`, `Arsenal`) and no earn/deploy logic is wired yet.
- **High-Stakes multipliers not implemented.** `match_tag` renders a badge but carries no scoring effect; multiplier maths is pending.
- **Community Consensus is a placeholder.** The reserved area renders "Consensus revealing soon…"; the aggregation/reveal pipeline is future work.
- **`leagues.members` legacy column.** `league_members` is the source of truth; the older JSONB `members` column on `leagues` is effectively unused and a candidate for removal.
- **RLS is intentionally permissive on base tables.** The original schema uses broad `USING (true)` policies. Newly added tables (`league_members`, `power_up_wallet`) use tighter, owner-scoped write policies; a future pass could tighten the base tables to `auth.uid()`-scoped rules.
- **Scoring logic is duplicated** (SQL RPC + `src/utils.ts` fallback) and must be manually kept in sync whenever brackets change.
- **`preferred_sport` / nickname** live in `profiles.username`; naming is inconsistent with the app's `nickname` terminology and worth normalizing.

---

*Document owner: Technical Lead · Last reconciled with the schema-reconciliation migration (`20260715_schema_reconciliation.sql`).*
