---
name: AdminPanel feature-slice architecture
description: AdminPanel.tsx split into feature slices under src/components/admin/; covers hook, layout shell, and all tab components.
---

## Architecture

- `AdminPanel.tsx` — thin entry; owns `activeTab`, `fixtureFilter`, `successMsg`, `errorMsg`; renders `AdminLayout` + one tab component per `activeTab`.
- `admin/useAdminData.ts` — custom hook; owns DB fetching for fixtures/leagues/archives; triggered by `activeTab` changes.
- `admin/AdminLayout.tsx` — modal shell + animated tab bar; receives `fixtureCount`, `playerCount`, `archiveCount` as props.
- Tab slices: `AdminDashboard`, `PredictionsViewer`, `PlayerManager`, `FixturesManager`, `CompetitionsManager`, `ArchivesManager`, `Communications`, `AdminLeagueManager`.

## Key decisions

**Why `onSuccess`/`onError` callbacks:** Success/error messages are shown in the tab bar ribbon (in AdminLayout), so they must live in AdminPanel and be passed down.

**Why FixturesManager owns local `groupFixtures` state:** It initialises from `initialFixtures` prop and syncs via `useEffect`; this allows optimistic updates (add fixture shows immediately) while still receiving re-fetched data from parent refresh.

**Why PlayerManager calls `onArchivesRefresh` after delete:** Archive count in the tab bar is sourced from `useAdminData`; deletion archives the user, so the count must refresh.

**How to apply:** When adding a new tab, add an entry to `TABS` in AdminLayout, add a state branch in AdminPanel, and create a new slice component in `src/components/admin/`.
