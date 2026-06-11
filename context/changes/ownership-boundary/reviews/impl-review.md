<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Ownership Boundary

- **Plan**: context/changes/ownership-boundary/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-06-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Bare-PATCH contract undocumented

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/enemies/[id].ts:89
- **Detail**: The confirm path (bare PATCH with no Content-Type) is a non-obvious protocol contract. Without a comment, future readers have no way to know the intentional isJson=false branch is not dead code.
- **Fix**: Add a one-line comment above the confirm path documenting the bare-PATCH = confirm contract and cross-referencing EnemiesSection.tsx:53.
  - Strength: Zero-cost documentation; prevents the branch from being "fixed" into a bug.
  - Tradeoff: None.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED — added `// Bare PATCH (no Content-Type: application/json) is the confirm contract — see EnemiesSection.tsx:53.`

### F2 — form.get() null guard missing in auth routes

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signin.ts, src/pages/api/auth/signup.ts
- **Detail**: `form.get()` returns `string | null`; both routes cast the result as `string` without a null check. A request missing either field would produce a runtime error rather than a clean redirect.
- **Fix**: Guard with `typeof email !== "string" || typeof password !== "string"` before use; redirect with safe error message on failure.
  - Strength: Closes a real crash path; adds a "missing fields" integration test confirming the guard.
  - Tradeoff: None.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED — null guards added, missing-field tests added (94 → 96 tests).

### F3 — DELETE handler used del* variable prefix

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/enemies/[id].ts (DELETE handler)
- **Detail**: PATCH handler named destructured variables `userCampaigns / campaignsError / campaignIds / userBattles / battlesError / battleIds`. DELETE handler named the same variables `delCampaigns / delCampaignsError / delCampaignIds / delBattles / delBattlesError / delBattleIds`. The `del*` prefix is a reader-hostile diff from the PATCH handler and adds no information.
- **Fix**: Rename DELETE handler variables to match PATCH handler names.
- **Decision**: FIXED — variables renamed.

### F4 — IDOR test relies on empty-battles as the sentinel

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/integration/api/enemies-id.test.ts
- **Detail**: The IDOR tests mock `battles: { data: [], error: null }` and expect a 404. This works but is an implicit timing oracle — if the ownership chain is ever restructured so that an empty battles array is no longer the 404 trigger, the test would pass for the wrong reason. A more explicit sentinel would be to mock `battles` with a non-empty array whose IDs don't match the target enemy's battle_id.
- **Fix**: Restructure the IDOR mock to return a non-matching battle ID and verify the DB filter rejects it.
  - Strength: Test is self-documenting and immune to ownership-chain refactors.
  - Tradeoff: Requires the mock to have knowledge of the enemy's battle_id, adding coupling to the mock shape.
  - Confidence: MEDIUM — current approach works correctly; this is a robustness improvement.
  - Blind spot: `makeSupabaseMock` returns the same result for all chained calls on a table, so the current approach may be the only clean option given the helper's design.
- **Decision**: SKIPPED — current approach is correct; restructure would require mock helper changes beyond this phase's scope.

### F5 — prerender = false missing from enemies/[id].ts and generate.ts

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/enemies/[id].ts, src/pages/api/battles/[id]/generate.ts
- **Detail**: Most API routes in this repo carry `export const prerender = false` for explicitness under Astro SSR mode. Both files modified in this change lacked it, while sibling routes (e.g., battles/[id].ts, battles/index.ts) carry it.
- **Fix**: Add `export const prerender = false;` to both files.
- **Decision**: FIXED — added to both files.

## Triage Summary

- **Fixed**: F1, F2, F3, F5
- **Skipped**: F4 (timing oracle concern noted; current approach is functionally correct)
- **Triage commit**: acd021b
