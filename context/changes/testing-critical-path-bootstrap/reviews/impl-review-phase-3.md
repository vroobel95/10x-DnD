<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test Runner Bootstrap and Critical-Path Contracts

- **Plan**: context/changes/testing-critical-path-bootstrap/plan.md
- **Scope**: Phase 3 of 5
- **Date**: 2026-06-05
- **Verdict**: NEEDS ATTENTION → APPROVED after triage
- **Findings**: 0 critical  4 warnings  2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Campaigns query error swallowed in battles DELETE handler

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/battles/[id]/index.ts:19–24
- **Detail**: Phase 3 fixed the battles DELETE error path but the campaigns ownership query in the same handler swallowed DB errors → false 404.
- **Fix**: Destructure `error` from campaigns query; return 500 if truthy; change `userCampaigns ?? []` to `userCampaigns` (non-null after guard).
- **Decision**: FIXED — added `campaignsError` guard + updated battles-id.test.ts ownership check mock to use PGRST116

### F2 — Campaigns ownership checks swallow errors in battles GET and POST handlers

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/battles.ts:22–30 (POST), 102–110 (GET)
- **Detail**: Both ownership `.single()` queries only destructured `data`, ignoring `error`. DB errors → 404 instead of 500.
- **Fix**: Applied PGRST116 pattern to both — PGRST116 → 404, other error → 500. Updated battles.test.ts ownership test mock to use PGRST116.
- **Decision**: FIXED

### F3 — No regression test for F1's gap

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/api/battles-id.test.ts
- **Detail**: No test covered the campaigns DB error path that F1 fixed.
- **Fix**: Added test case `campaigns: { data: null, error: { message: "DB error" } }` → 500.
- **Decision**: FIXED

### F4 — Error fixtures missing code field in campaigns-id.test.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/api/campaigns-id.test.ts:60–65, 111
- **Detail**: 500-path error fixtures have no `code` field; the test passes because `undefined !== "PGRST116"`, but intent is implicit.
- **Fix**: Use `{ code: "23505", message: "..." }` for clarity.
- **Decision**: SKIPPED

### F5 — makeSupabaseMock can't distinguish two calls to the same table

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: tests/helpers/supabase.ts (design constraint)
- **Detail**: Single-builder-per-table design; for two-result-same-table cases, use mockReturnValueOnce instead.
- **Decision**: SKIPPED

### F6 — Pre-existing: battles.ts POST embeds infra error in redirect URL

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/battles.ts:7
- **Detail**: POST null-client guard redirects with error in URL param; pre-existing, out of Phase 3 scope.
- **Decision**: SKIPPED
