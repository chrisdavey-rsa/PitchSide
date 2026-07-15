# PitchSide — Admin Panel Architecture Audit

_Last updated: 2026-07-15_

This document is a complete, function-by-function audit of the PitchSide Admin Panel
(`src/components/admin/*` plus the `src/components/AdminPanel.tsx` shell). Its purpose is
to let you decide **what stays, what goes, and what needs to be wired up**.

Each action below is tagged:

- **[WIRED]** — actually reads from / writes to the Supabase database (persists).
- **[LOCAL]** — persists only to the browser's `localStorage` (sandbox / single-device).
- **[STUB]** — fires a success toast / `alert()` / console log with **no backend logic**. Nothing is saved.

---

## 1. High-Level Architecture

```
AdminPanel.tsx            ← orchestrator: owns activeTab, toast state, wires props
├── useAdminData.ts       ← shared data hook (fixtures, leagues, archives)
├── AdminLayout.tsx       ← modal shell, tab bar, success/error ribbons
└── Tab content components:
    ├── AdminDashboard.tsx        (tab: dashboard)
    ├── PlayerManager.tsx         (tab: players)
    ├── FixturesManager.tsx       (tab: fixtures)
    ├── CompetitionsManager.tsx   (tab: competitions)
    ├── ArchivesManager.tsx       (tab: backups)
    ├── Communications.tsx        (tab: communications)
    ├── AdminLeagueManager.tsx    (tab: leagues)
    └── PredictionsViewer.tsx     (tab: predictions)
```

### `AdminPanel.tsx` (shell / controller)
- Holds `activeTab`, `fixtureFilter`, and transient `successMsg` / `errorMsg`.
- `triggerSuccess()` / `triggerError()` display an auto-dismissing ribbon (5s / 8s). **These are UI-only** — most child "actions" simply call these, which is why so many features _look_ successful without saving.
- Passes `registeredUsers`, `onToggleAdmin`, `onDeleteUser` down from the parent app (these three are the genuinely wired user-management callbacks defined outside the admin folder).

### `useAdminData.ts` (data hook)
- `fetchFixtures()` → **[WIRED]** `dbFetchMatches()`.
- `fetchLeagues()` → **[WIRED]** `dbFetchLeagues()` **+ now hydrates real member IDs via `dbFetchLeaguesMembership()`** (see Bug Fix #2 below).
- `fetchArchives()` → **[WIRED]** `dbFetchArchivedPlayers()`.
- Lazy-loads leagues/archives only when their tab is opened; fixtures load on mount.

### `AdminLayout.tsx` (presentational)
- Pure layout: header, tab buttons, notification ribbons. No data logic. Tab counts (`Players (n)`, `Fixtures (n)`, `Archived (n)`) are passed in as props.

---

## 2. Tab-by-Tab Breakdown

### 2.1 Dashboard — `AdminDashboard.tsx`
**Purpose:** At-a-glance metric cards; each card is a shortcut into another tab.

| Element | Data source | Status |
|---|---|---|
| Total Players | `count` on `profiles` | **[WIRED]** |
| Predictions Cast | `count` on `predictions` where `match_id in (upcoming)` and `submitted=true` | **[WIRED]** |
| Upcoming Matches | `count` on `matches` where `status='upcoming'` | **[WIRED]** |
| Completed Matches | `count` on `matches` where `status='completed'` | **[WIRED]** |
| Card clicks | `onNavigate()` → switches tab (+ fixture filter) | **[WIRED]** (navigation) |

**Verdict:** Fully functional and read-only. Safe to keep as-is.

---

### 2.2 Players — `PlayerManager.tsx`
**Purpose:** Directory of all registered users + a deep "Player Admin" modal with 4 sub-tabs.

**Directory table**
| Action | Status | Notes |
|---|---|---|
| Search (UUID/nickname/name/email) | **[WIRED]** | client-side filter over the fetched list |
| `AUDIT / EDIT` opens modal | **[WIRED]** | fetches that user's prediction ledger |
| `MAKE/REVOKE ADMIN` | **[WIRED]** | calls `onToggleAdmin` (parent → DB) |
| Delete (trash icon) | **[WIRED]** | calls `onDeleteUser` (parent → DB + archive) |
| Refresh Node | **[WIRED]** | re-fetches fixtures list |

**Player Admin modal → sub-tabs**
| Sub-tab | Feature | Status | Notes |
|---|---|---|---|
| Identity | View profile fields | **[WIRED]** (read) | Fields are display-only in the UI. |
| Identity | `handleUpdatePlayerInfo()` (exists in code) | **[BROKEN/WIRED]** | ⚠️ Writes camelCase columns (`firstName`, `surname`, `nickname`) that **do not exist** on `profiles` (real columns are `first_name`, `surname`, `username`). This update will silently fail / error. No "Save" button currently calls it in the Identity view either. See "Known Issues". |
| Ledger (Predictions) | Fetch player predictions w/ joined match data | **[WIRED]** (read) | Filters by upcoming/completed, sport, search — all client-side. |
| Ledger | **Manual Point Adjustment** (Apply) | **[STUB]** | Toast only. Nothing written to DB. |
| Security | **Manually Verify Email** | **[STUB]** | Toast only. |
| Security | **Force Password Reset** | **[STUB]** | Toast only — does not call `supabase.auth.resetPasswordForEmail`. |
| Security | **Grant/Revoke Admin** | **[WIRED]** | calls `onToggleAdmin`. |
| Security | **Suspend User / Restore** | **[STUB]** | Local component state only; `adminPassword` is hard-coded to `'admin'`. Never persisted. |
| Communications | **Send Secure Message** | **[LOCAL]** | Writes to `localStorage['pitchside_messages']`. Not in DB; not cross-device. |

**Verdict:** Read/browse features are solid. Almost every _write_ action in the modal (point adjustments, verify, password reset, suspension, messaging) is a stub or localStorage-only. These are the biggest "looks done but isn't" risks.

---

### 2.3 Fixtures & Scoring — `FixturesManager.tsx`
**Purpose:** Register fixtures and enter final scores (this is the manual scoring engine).

| Action | Status | Notes |
|---|---|---|
| Register Game Fixture | **[WIRED]** | `dbSaveMatch()` inserts into `matches`. |
| Fixture list (manage) | **[WIRED]** | from `dbFetchMatches`, blended with `localStorage['added_fixtures']`. |
| **Update Result** (per fixture) | **[WIRED]** | `dbSaveMatch()` sets status/scores, then loops `predictions` for that match and writes `points_won` via `calculatePoints()`. |
| Points write-back to `localStorage` | **[LOCAL]** | mirrors scoring into `simulated_*` / `points_*` keys for the sandbox. |
| **Settle All Completed Matches** | **[WIRED]** | recomputes `points_won` across all completed fixtures. |

**Verdict:** The most important admin tab and it **is** wired. ⚠️ Note the field-name coupling: it reads `predRow.predicted_home_score` / `predicted_away_score` (correct). This is the core of the current "manual admin scoring" model that will eventually be replaced by API-Sports + Edge Functions.

---

### 2.4 Competitions — `CompetitionsManager.tsx`
**Purpose:** Add a new competition.

| Action | Status | Notes |
|---|---|---|
| Register Competition | **[LOCAL]** | calls `addCompetition()` from `src/competitions.ts`. Persists to the in-memory/localStorage competitions module, **not** a Supabase table. |

**Verdict:** Functional for the client session but not database-backed. Decide whether competitions should become a real table.

---

### 2.5 Archived Backups — `ArchivesManager.tsx`
**Purpose:** View users who were deleted (archived) and export their data.

| Action | Status | Notes |
|---|---|---|
| Archive list | **[WIRED]** (read) | `dbFetchArchivedPlayers()`. |
| Download All / JSON Bundle | **[WIRED]** (client) | builds a JSON file download in the browser. |
| **Restore** | **[STUB]** | `alert('Account restoration initiated')`. |
| **Purge** | **[STUB]** | `alert('Permanently Purge initiated')`. |
| "UNSUBSCRIBED" mailing badge | **[STUB]** | hard-coded label; no mailing-list system exists. |

**Verdict:** Viewing + export work. Restore and Purge are pure stubs.

---

### 2.6 Communications — `Communications.tsx`
**Purpose:** Broadcast an announcement to a user segment.

| Action | Status | Notes |
|---|---|---|
| Dispatch Broadcast | **[STUB]** | Toast only. No email service, no DB write, target audience unused. |

**Verdict:** Entirely a UI stub. Nothing is sent or stored.

---

### 2.7 Mini-Leagues — `AdminLeagueManager.tsx`
**Purpose:** Directory of private leagues + a details modal listing members.

| Action | Status | Notes |
|---|---|---|
| League list | **[WIRED]** (read) | `dbFetchLeagues()`. |
| **Members count** | **[WIRED]** ✅ | **Fixed** — now hydrated from `league_members` (was reading the empty legacy JSONB column, hence the "0 members" bug). |
| League details modal (members) | **[WIRED]** (read) | maps hydrated member IDs to `registeredUsers`. |
| **Transfer ownership** | **[STUB]** | `window.confirm` → toast only. |
| **Delete league** | **[STUB]** | `window.confirm` → toast only. No `dbDeleteLeague` call. |

**Verdict:** Read + counts now correct. Transfer and Delete are stubs.

---

### 2.8 Predictions — `PredictionsViewer.tsx`
**Purpose:** Site-wide prediction browser (upcoming vs historical).

| Action | Status | Notes |
|---|---|---|
| Fetch predictions w/ joined `matches` + `profiles` | **[WIRED]** (read) | uses FK joins (relies on the reconciliation-migration foreign keys). |
| Upcoming filter (`submitted=true`) | **[WIRED]** | |
| Search / detail modal | **[WIRED]** (client) | read-only. |

**Verdict:** Fully functional read-only viewer. Safe to keep.

---

## 3. Bugs Fixed In This Pass

### Bug #1 — Registration metadata not saving  ✅
- **Cause:** `handle_new_user()` DB trigger read the wrong `raw_user_meta_data` keys (`nickname`, `country`, `supportedTeam`) and never read `preferred_sport`. The client (`AuthFlow.tsx`) was already sending the correct keys (`username`, `nationality`, `supported_team`, `preferred_sport`), so **no client change was needed**.
- **Fix:** `supabase/migrations/20260715_fix_auth_trigger.sql` — `CREATE OR REPLACE FUNCTION public.handle_new_user()` reads the correct keys (with legacy fallbacks), (re)creates the INSERT + UPDATE triggers, and back-fills existing profiles from `auth.users` metadata.

### Bug #2 — Admin league member counts showing 0  ✅
- **Cause:** `AdminLeagueManager` rendered `league.members?.length`, but `dbFetchLeagues()` returns the empty legacy `members` JSONB column. Real membership lives in `league_members`.
- **Fix:** `useAdminData.fetchLeagues()` now hydrates each league's `members` array from `dbFetchLeaguesMembership()`, so counts and the member modal are accurate.

---

## 4. Known Issues / Recommendations (not yet fixed)

1. **`handleUpdatePlayerInfo()` (PlayerManager)** writes non-existent camelCase columns (`firstName`, `surname`, `nickname`). If profile editing is desired, remap to `first_name`, `surname`, `username`. Currently there is no button wired to it in the Identity tab.
2. **Stub actions to either wire or remove:** Manual Point Adjustment, Manually Verify Email, Force Password Reset, Suspend/Restore, Communications broadcast, League Transfer/Delete, Archive Restore/Purge.
3. **localStorage-only features** (Secure Messages, sandbox scoring mirror, added fixtures, competitions) are single-device and will not survive on other browsers — decide which should be promoted to real tables.
4. **Hard-coded admin password** `'admin'` in the suspend flow (`PlayerManager`) should be removed before production.
5. **Manual scoring dependency:** all points flow through the Fixtures tab's manual score entry. This is the documented technical-debt item earmarked for API-Sports + Supabase Edge Function automation.
