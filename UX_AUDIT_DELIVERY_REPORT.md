# PitchSide UX Audit — Delivery Report

*Date: 25 Jul 2026 · Scope: Critical pass → Medium pass → follow-up polish*

---

## Summary

Implemented the audit’s **Critical** and **Medium** workstreams, then a follow-up pass for Leagues/Login/sport visibility. F1 and Golf remain available to **admins only** for build preview; players see Football and Rugby only.

---

## Critical fixes (pass 1)

| Item | Change |
|------|--------|
| Rules nav copy | “top navigation” → **“main menu”** so copy is correct on mobile + desktop (`RulesInfo.tsx`) |
| League gate empty state | Clear CTA: **Join a league to unlock predictions** + **Browse Leagues — Join or Create** (`PredictionsPage.tsx`) |
| Fixtures empty state | Distinguishes “leagues unlocked, waiting on fixtures” from a broken app (`MatchPredictor.tsx`) |
| Truncation | League names + power-up taglines **wrap** instead of clipping |
| Live / post-kickoff UI | **Predictions closed** / **Prediction locked** banner; +/− steppers hidden when locked |
| Leaderboard sort label | `Hi`/`Lo` → **High→Low** / **Low→High** with tooltip |
| Coming soon tabs | Later superseded by hiding F1/Golf for players entirely |

---

## Medium fixes (pass 2)

| Item | Change |
|------|--------|
| Mobile nav label | **Boards → Leaderboards** |
| Leagues Join/Create | Filled emerald **action buttons** (not plain text tabs) |
| Account season chips | Outlined filter chips (no solid blue CTA look) |
| Mobile login value prop | Tagline + *Predict Football & Rugby scores…* under logo (`AuthCard.tsx`) |
| Login nudge | *New to PitchSide? Create an account* |
| Power-Up wallet | Slim one-line **coming soon** strip on prediction screen |
| Preferred sport | Temporarily showed F1/Golf as coming soon — **removed for players** in final pass |

---

## Follow-up (this pass)

| Item | Change |
|------|--------|
| Leagues membership | Removed **“Joined”** text; membership still shown via **green bordered row** |
| Leagues typography | Names / member counts at **`text-[12px]`**; headers slightly smaller |
| Mobile leagues columns | **League + Members** only; privacy via **lock icon**; Scope/Sport/Privacy remain on desktop |
| Auth tabs | Active **Login / Create Account** label + underline **centered** in each half |
| F1 / Golf visibility | Hidden for non-admins in sport banner, Predictions dropdown nav, signup, and onboarding; **admins keep full preview** (`isSportAccessible`) |
| Phone placeholder | Example format **`+44 7911 123456`** |

---

## F1 / Golf visibility rules

```
isSportAccessible(sport, role)
  → football / rugby: always
  → formula1 / golf: admin only
```

Surfaces updated:

- `SportSelectorBanner` — filters pills; 2-column layout for players  
- `EmergingSportNav` — emerging rows only if admin  
- `AuthFlow` / `OnboardingFlow` — no F1/Golf options for new players  
- `Dashboard` — already resets active sport if inaccessible  

---

## Intentionally not done (deferred)

These remain backlog from the audit’s Low / larger Medium items:

- Full **2-step signup** (profile fields after first content)
- Drop Confirm Email / raise password minimum
- Desktop Account & Rules out of hamburger into top nav
- Leagues/Account as routed pages (not modals)
- Ghost Points column / prediction history view
- Full semantic colour system redesign
- Predictions nav icon swap (brand mark → scoreboard pictogram)
- Mobile personalized stats header parity with desktop

---

## Key files touched

- `src/components/RulesInfo.tsx`
- `src/components/Dashboard/PredictionsPage.tsx`
- `src/components/Dashboard/MatchPredictor.tsx`
- `src/components/Dashboard/LeaderboardsPage.tsx`
- `src/components/Dashboard/LeagueManagementPanel.tsx`
- `src/components/Dashboard/MobileNavigation.tsx`
- `src/components/auth/LoginView.tsx`, `AuthCard.tsx`
- `src/components/AuthFlow.tsx`
- `src/components/OnboardingFlow.tsx`
- `src/components/AccountPortal/MyLeagues.tsx`, `HistoricScores.tsx`
- `src/sports/emerging/components/SportSelectorBanner.tsx`
- `src/sports/emerging/components/EmergingSportNav.tsx`
- `ARCHITECTURE_MAP.md` (earlier architecture audit)

---

## Round 2 follow-up (25 Jul 2026)

- **Create Account** streamlined to Full name, Username, Nationality | Preferred sport + Supported team, Email, Password (8+ + strength), optional phone, age + terms checkboxes. Confirm email/password and DOB picker removed.
- **Apple OAuth removed** entirely; Google only.
- **Supabase** `handle_new_user` accepts `full_name` / `age_confirmed_16`; `dob` and `phone` optional (`20260725100000_signup_streamlined_profile_defaults.sql`).
- Login Tab order: Username → Password → Forgot Password (visual position unchanged).
- Live points widget label: **Live standings** (score line keeps “As it stands”).

---

## How to verify quickly

1. **Player login (mobile)** — value prop under logo; centered Login underline; no F1/Golf on Predictions.  
2. **Admin login** — F1/Golf still appear on sport banner / Predictions menu.  
3. **Leagues (mobile)** — two columns; lock on private; green ring if member; no “Joined” label; `12px` names.  
4. **Live fixture** — steppers gone after kickoff; closed/locked messaging visible.  
5. **Not in a league** — Predictions shows unlock CTA into Leagues.
6. **Create Account** — no confirm email/password/DOB; Apple gone; Google only; Tab on Login hits Password before Forgot Password.
