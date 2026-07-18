# PitchSide — Architecture Baseline

**Purpose:** Single source of truth for how PitchSide works today (pre–New Game Rules completion).  
**Audience:** Product, design, and engineering stakeholders.  
**Date:** July 2026  
**Related:** Approved restructure blueprint → [NEW_GAME_RULES.md](./NEW_GAME_RULES.md)

---

## 1. Current Database Schema

PitchSide stores player data in **Supabase (Postgres)**. The main game tables are below.

### Users (`profiles`)

There is no separate “users” game table. Each signed-up player has a row in `profiles`. The row id matches their login account id.

| Column | Meaning |
|--------|---------|
| `id` | Unique player id (same as login account) |
| `first_name`, `surname` | Name |
| `email` | Email (unique) |
| `username` | Display / login nickname |
| `dob` | Date of birth |
| `nationality`, `phone`, `supported_team` | Profile extras |
| `preferred_sport` | Football or rugby preference |
| `is_admin` | Admin access flag |
| `is_verified` | Email confirmed |
| `is_profile_public` | Whether others can view the profile |
| `created_at` | When the profile was created |

When someone creates an account, a database trigger copies their signup details into `profiles`.

---

### Matches (`matches`)

Fixtures and results live here. This is the source of truth for what games players can predict.

| Column | Meaning |
|--------|---------|
| `id` | Unique match id |
| `competition_id` | Which competition the match belongs to |
| `competition_name` | Human-readable competition name (when synced) |
| `sport` | `football` or `rugby` |
| `home_team`, `away_team` | Team names |
| `kickoff_time` | When the match starts |
| `status` | `upcoming`, `live`, or `completed` |
| `actual_home_score`, `actual_away_score` | Final score (when finished) |
| `round_name` | Round / game-week label from the data feed |
| `venue_name` | Stadium (optional) |
| `provisional_home_score`, `provisional_away_score` | Live in-play score |
| `match_minute` | Live clock text |
| Odds / multiplier fields | Optional pricing and point multiplier data |
| `is_visible` | Whether the fixture is shown in the app |
| `created_at`, `updated_at` | Timestamps |

---

### Predictions (`predictions`)

One prediction per player per match.

| Column | Meaning |
|--------|---------|
| `id` | Usually `{userId}_{matchId}` |
| `user_id` | Links to `profiles.id` (deletes if profile is deleted) |
| `match_id` | Which match this prediction is for |
| `sport` | Football or rugby |
| `competition_id` | Competition of that match |
| `season` | Season label (defaults to `2026`) |
| `predicted_home_score`, `predicted_away_score` | The player’s pick |
| `submitted` | `false` = draft; `true` = locked in |
| `points_won` | Settled points (when written) |
| `provisional_points` | Live “as it stands” points |
| `created_at` | When the row was created |

**Note:** Predictions link to matches by `match_id` text. There is no hard database foreign key from predictions to matches.

---

### Leagues (`leagues`)

A league is a social group of players. Under New Game Rules, leagues are **not** locked to a single competition (`competition_id` may be `null` = all sports).

| Column | Meaning |
|--------|---------|
| `id` | League code (e.g. `LG_XXXXX`, or `GLOBAL_LEAGUE`) |
| `name` | League display name |
| `password` | Join password |
| `competition_id` | Optional / deprecated lock; `null` = all sports |
| `creator_id`, `creator_name` | Who created / administers the league |
| `is_private` / `is_public` | Visibility (kept in sync with each other) |
| `max_players` / `max_participants` | Member cap (≤ 20 for mini-leagues; `null` = uncapped, e.g. Global) |
| `season` | Season label |
| `members` (JSONB) | **Legacy / unused** — the app no longer reads this |
| `created_at`, `updated_at` | Timestamps |

---

### League Members (`league_members`)

This is the **real** list of who is in each league.

| Column | Meaning |
|--------|---------|
| `league_id` | Links to `leagues.id` |
| `user_id` | Links to `profiles.id` |
| `joined_at` | When they joined |

Primary key: `(league_id, user_id)` — a player can only appear once per league.

```
profiles  ←── predictions.user_id
matches   ←── predictions.match_id  (by id text)
leagues   ←── league_members.league_id
profiles  ←── league_members.user_id
leagues.competition_id  ≈  matches.competition_id  (legacy; new leagues use null)
```

---

## 2. The User Journey (Signup → First Prediction)

1. **Land on PitchSide**  
   Guest sees splash, then login / create account.

2. **Create account**  
   Player enters details (name, email, username, password, age 16+, terms).  
   The app creates a login account and the database creates their `profiles` row.

3. **Confirm email**  
   Player verifies email. Profile is marked verified.

4. **Log in**  
   They can sign in with email or username. The app loads their profile and opens the dashboard.

5. **League membership (required for predicting)**  
   The match predictor only appears after the player is in **at least one league**.  
   New Game Rules: signup auto-enrolls them into **Global PitchSide League** (`GLOBAL_LEAGUE`).

6. **Open the predictor**  
   Choose Football or Rugby → pick a competition that has live/upcoming fixtures → see matches for the next ~9 days.

7. **Enter a pick**  
   - Football: home and away scores  
   - Rugby: winner and margin (stored as scores under the hood)

8. **Save draft (optional)**  
   Changing scores can save an unlocked draft to the database and local device storage.

9. **Lock the prediction**  
   Player taps lock / submit. The prediction is marked `submitted = true`. After kickoff (or once live), the pick stays locked.

That locked row is their first official prediction.

---

## 3. Current League Mechanics

### Create a league

1. Open **Leagues** from the top navigation.
2. Go to the **Create** tab.
3. Enter name, password, season, and optional privacy / size limits (no single-competition lock).
4. The app creates a `leagues` row and automatically adds the creator to `league_members`.
5. The player is taken into the League Hub for that league.

### Join a league

There are three common paths:

| Path | How it works |
|------|----------------|
| **In-app Join tab** | Enter league code (or name) + password. Capacity is checked, then a `league_members` row is added. |
| **From League Hub** | Non-members can join with the password from the hub side panel. |
| **Invite link** | Share `/join/{leagueId}`. Guests are asked to log in first; after login they can join. Invite join does **not** currently re-ask for the password. |

Private leagues are hidden from the global browse list unless the viewer is already a member.  
The Global League cannot be left or deleted.

### Interact with a league (League Hub)

Once inside a league, a member can:

- See **standings** for people in that league only  
- Compare **live picks** for fixtures in the prediction horizon (all sports when the league is unlocked)  
- Copy / share the **league code** and **invite friends**  
- Open **League Settings** (creator only, not Global): public/private, max players, password  
- **Leave** the league (members) or **Delete** the league (creator) — not available on Global

---

## 4. Current Leaderboard Logic

### How points are earned (per finished match)

**Football**

| Result of the pick | Points |
|--------------------|--------|
| Exact score correct | 5 |
| Correct winner + correct goal difference | 3 |
| Correct winner (or correct draw) but wrong margin | 1 |
| Wrong outcome | 0 |

**Rugby**

| Result of the pick | Points |
|--------------------|--------|
| Correct winner + exact margin | 5 |
| Correct winner + margin within a set band | 3 or 1 (by band) |
| Wrong outcome | 0 |

Points are calculated from the prediction and the match’s final score. The global leaderboard prefers a database function that recalculates scores when it loads.

### “Drops” (forgiveness)

For some long football competitions, the worst results can be dropped:

| Competition id | Drops allowed |
|----------------|---------------|
| English Premier League (`f-epl`) | 4 |
| Championship (`f-championship`) | 6 |
| Scottish Premiership (`f-spfl`) | 4 |
| Everything else (including rugby / cups) | 0 |

The leaderboard shows the improved “best” total and can also show the raw total before drops.

### Where leaderboards appear

| Place | What you see |
|-------|----------------|
| **Dashboard leaderboard** | Global rankings, filterable by football/rugby. Can switch to a “My League” view based on a private league the user belongs to. May show live provisional points while matches are in play. |
| **League Hub standings** | Same underlying scores, but **only members of that league**. |

Important: League standings are not a separate points table. They reuse global scoring and then filter to the league’s member list.

---

## 5. Data Fetching (Competitions & Matches)

### Matches

- The app loads matches from the `matches` table.
- It then keeps only fixtures that matter for the current prediction cycle:
  - matches that are **live**, or  
  - kickoffs roughly from a few hours ago through the **next 9 days**
- Admin tools can load the full unfiltered list when needed.

### Competitions shown in the predictor

- Competitions are **not** taken from a fixed “always show Premier League / Six Nations” list on the dashboard.
- The app looks at which competitions actually have **live or upcoming** matches in that 9-day window.
- Choosing Football or Rugby only shows those active competitions for that sport.
- If none exist, the UI shows: *“No active fixtures available for this game-week.”*

### Filtering inside the predictor

1. Select sport  
2. Select competition chip  
3. Show that competition’s matches in the horizon window  
4. Sort by kickoff (and round label when present)

---

## 6. Summary for Restructuring

These are the current “rules of the road” any redesign should treat carefully:

1. **Membership** lives in `league_members`, not the old JSON list on `leagues`.  
2. **Predicting is gated in the UI** until the player joins a league (Global auto-enroll satisfies this).  
3. **Leaderboard points** are computed from predictions + finished matches, not from a separate season scorecard table.  
4. **League rankings** are filtered global scores, not independent league scoring engines.  
5. **Fixture discovery** is driven by live database matches in a short rolling window.  
6. **Invite join** and **password join** currently behave differently for password checks.  
7. Full dual-pillar / month / week hub leaderboards are specified in [NEW_GAME_RULES.md](./NEW_GAME_RULES.md) and may not all be shipped yet.

---

*End of architecture baseline.*
