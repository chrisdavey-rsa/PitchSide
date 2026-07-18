# PitchSide — New Game Rules & Restructure Specification

**Purpose:** Blueprint for transitioning from single-competition leagues to overarching multi-sport social leagues with rolling seasons and monthly sprints.
**Date:** July 2026
**Status:** Approved for Implementation

---

## 1. Core Paradigm Shifts

### Shift A: Leagues are for People, Filters are for Sports
- **Old Rule:** A league is locked to a single competition (`leagues.competition_id`).
- **New Rule:** A league is a permanent social group (e.g., "The Office League"). The `leagues.competition_id` column is deprecated or set to `null` (or a global flag). A single league tracks a user's predictions across **all** sports and competitions seamlessly.

### Shift B: Universal Predictions
- Predictions remain strictly one per player per match (`predictions` table). 
- A player's prediction automatically applies across the entire platform: it counts for their Global ranking, their private mini-leagues, and any active sport-specific leaderboards simultaneously.

---

## 2. Updated User Workflow

1. **Auto-Enrollment (The Global Gatekeeper):**
   - Upon successful account registration, a Supabase database trigger or function must automatically add the new player to the **Global PitchSide League** (a system-generated public league with a fixed ID like `GLOBAL_LEAGUE`).
   - *Product Benefit:* This immediately satisfies the UI rule that a player must be in a league to predict. They can jump straight into the dashboard from day one.

2. **Frictionless Social Invites:**
   - When a user joins a friend's mini-league using an invite link or code, they join *one* league. They are immediately in the competitive pool for both Football and Rugby.

---

## 3. The New Mini-League Leaderboard Architecture

When a player opens a League Hub, they will no longer see a single aggregated leaderboard. Instead, they will interact with a highly optimized, dual-pillar leaderboard environment.

### Primary Pillars: The Sport Tabs
- The leaderboard screen displays two prominent top-level tabs: **Football** and **Rugby**. 
- There is **no** "Overall/Combined" score tab, removing any point volume imbalances between the sports.

### The "Unlock" Cross-Pollination Mechanic
- To keep the views intensely relevant to the player, a sport's ranking list is conditionally locked.
- **Rule:** If a member has `0` predictions submitted for a sport in the current scope, they do not appear in that sport's ranking list.
- **UI State:** Instead of a leaderboard, they see a clean, motivating empty state: *"You haven't entered the [Football/Rugby] arena yet. Lock in your first prediction to unlock this leaderboard and challenge your group!"*
- As soon as they submit `1` prediction for that sport, their profile is instantly injected into the rankings.

### The Rolling Season & "Mini Sprints" (Time Sub-Filters)
To maintain long-term retention and keep trailing players engaged, each Sport Tab contains a secondary horizontal filter bar for time horizons:

1. **2026 Season (Default):** Cumulative total of all points earned in that sport since the launch. Rewards long-term consistency.
2. **This Month (The Reset Sprint):** Filters points strictly to matches settled within the current calendar month. Resets to zero on the 1st of every month at 00:00 UTC. Gives trailing players a fresh chance to win "Manager of the Month".
3. **This Week (Game-Week Sprint):** Filters points strictly to matches settled within the last 7 days or the current API round.

---

## 4. Technical Implementation Directives for Cursor

When implementing these changes, adhere to the following guidelines:

- **Database Aggregations:** When fetching a league's leaderboard, query the `predictions` table for all `user_id`s present in that league's `league_members`. Group and sum `points_won` dynamically based on the active UI filters:
  - Filter by `sport` (`football` vs `rugby`).
  - Filter by `created_at` / match settlement timestamp for the chosen time horizon (Season, Month, Week).
- **Default State Memory:** The UI should remember the user's `preferred_sport` from their profile and automatically default to that tab when they open a league.