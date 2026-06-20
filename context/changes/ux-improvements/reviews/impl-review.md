<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UX Improvements

- **Plan**: context/changes/ux-improvements/plan.md
- **Scope**: All phases (1–5)
- **Date**: 2026-06-20
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  3 warnings  6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Phase 2 navigation feedback implemented via React state, not Astro script

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/campaigns/CampaignBattleList.tsx:13,80-86 (actual) vs src/components/battles/BattleCard.astro (planned)
- **Detail**: BattleCard.astro has no `data-battle-card`, no `<style>`, no `<script>`. Instead `navigatingId` React state in CampaignBattleList.tsx drives `opacity-60 cursor-wait pointer-events-none`. Plan said Astro bundled script; "What We're NOT Doing" said no new React islands. Feature works and was user-confirmed.
- **Fix A ⭐ Recommended**: Accept — document actual mechanism in plan.md
  - Strength: Feature works; React state scoped to list owner is cleaner.
  - Tradeoff: Plan's constraint section becomes inaccurate.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A) — implementation note added to Phase 2 Progress section.

### F2 — 7 files use `bg-gradient-to-r` (Tailwind v3) instead of `bg-linear-to-r` (Tailwind v4)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/Welcome.astro:40,103 · src/pages/auth/confirm-email.astro:27 · src/pages/auth/forgot-password.astro:16,26 · src/pages/auth/reset-password.astro:16 · src/pages/battles/new.astro:18
- **Detail**: Tailwind v4 renamed `bg-gradient-to-*` → `bg-linear-to-*`. 5 files updated during implementation but 7 occurrences in 5 files missed. V3 alias may be dropped.
- **Fix**: Replace all 7 occurrences with `bg-linear-to-r`.
- **Decision**: FIXED — all 7 occurrences replaced.

### F3 — Orphaned `public/images/gm-hero-image.png` not referenced anywhere

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: public/images/gm-hero-image.png
- **Detail**: Added for split-layout auth design, then design was reverted. File shipped in deploy but referenced nowhere in src/.
- **Fix**: Delete the file.
- **Decision**: FIXED — file deleted.

### F4 — Topbar spec drifts: not sticky, no "Not signed in" text (both user-approved)

- **Severity**: 👁 OBSERVATION
- **Dimension**: Plan Adherence
- **Location**: src/components/Topbar.astro
- **Detail**: Plan said sticky full-width header + "Not signed in" for logged-out. Implemented as floating pill + hidden when logged-out. Both explicitly approved by user.
- **Decision**: SKIPPED.

### F5 — Buttons use arbitrary hex (#701c3b) instead of Tailwind token rose-800

- **Severity**: 👁 OBSERVATION
- **Dimension**: Plan Adherence
- **Location**: 13 files — all interactive buttons
- **Detail**: Plan said `bg-rose-800 hover:bg-rose-700`. User requested darker maroon and specified hex values. Consistent throughout.
- **Decision**: SKIPPED.

### F6 — Cosmic orb recolored despite plan saying "do NOT touch"

- **Severity**: 👁 OBSERVATION
- **Dimension**: Plan Adherence
- **Location**: src/components/Welcome.astro:15
- **Detail**: Plan preserved `bg-purple-500/20`; implementation changed to `bg-rose-900/25`. User approved.
- **Decision**: SKIPPED — implementation note added to Phase 5 Progress.

### F7 — campaigns/new.astro and battles/new.astro missing in-page auth guards

- **Severity**: 👁 OBSERVATION
- **Dimension**: Safety & Quality
- **Location**: src/pages/campaigns/new.astro, src/pages/battles/new.astro
- **Detail**: Middleware covers both paths but no in-page `if (!user) redirect` guard exists, unlike all other protected pages.
- **Fix**: Add explicit auth guard to both pages.
- **Decision**: FIXED — guard added to both pages.

### F8 — forgot-password.astro success heading missing text-center

- **Severity**: 👁 OBSERVATION
- **Dimension**: Pattern Consistency
- **Location**: src/pages/auth/forgot-password.astro:16
- **Detail**: Form-state h1 has `text-center`; success-state h1 does not.
- **Fix**: Add `text-center`.
- **Decision**: FIXED.

### F9 — FormField.tsx purple→rose not listed in Phase 5 Changes Required

- **Severity**: 👁 OBSERVATION
- **Dimension**: Scope Discipline
- **Location**: src/components/auth/FormField.tsx
- **Detail**: Change applied correctly but not documented in the plan.
- **Fix**: Add note to plan.md Progress section.
- **Decision**: FIXED — implementation note added to Phase 5 Progress.
