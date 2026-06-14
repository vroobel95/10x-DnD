<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Campaign New Page

- **Plan**: context/changes/campaign-new-page/plan.md
- **Scope**: All phases (Phase 1 + Phase 2)
- **Date**: 2026-06-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  4 warnings  1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Plan "What We're NOT Doing" section conflicts with actual implementation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: context/changes/campaign-new-page/plan.md lines 28-32, 40
- **Detail**: The plan's "What We're NOT Doing" section explicitly said no form-POST redirect pattern and no serverError query-param flow. Both were implemented correctly (to fix a hydration-gap bug in the fetch/JSON approach) but the plan text was never updated. Future readers see contradictions between stated intent and actual implementation.
- **Fix A ⭐ Recommended**: Rewrite the plan's "What We're NOT Doing" and "Critical Implementation Details" sections to describe the redirect/form-POST architecture that was actually built.
- **Fix B**: Leave plan as-is — it's a pre-pivot artifact; git history captures the real decisions.
- **Decision**: FIXED via Fix A — updated plan.md to remove contradictory guardrails and document the architectural pivot.

### F2 — campaigns/index.astro crashes on DB error instead of showing error banner

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/campaigns/index.astro:16
- **Detail**: Pre-existing concern: rawCampaigns.map() called without null guard. Upon investigation, getUserCampaigns (src/lib/campaigns.ts:9) already applies `data ?? []` before returning, so rawCampaigns is always an array — TypeScript confirms this. No crash risk. The error banner at lines 42-48 handles the error state correctly.
- **Decision**: SKIPPED — false alarm; getUserCampaigns already guards at the source.

### F3 — POST /api/campaigns: insert error field discarded

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/campaigns/index.ts:56-60
- **Detail**: The Supabase insert call used a type cast to discard the error field. Fixed by switching to `.single<Campaign>()` (no type cast), matching the typed Supabase pattern. TypeScript types the error field as always-null for this call type (a Supabase-js generics characteristic), so only `!campaign` is checked.
- **Fix**: Use `.single<Campaign>()` without a manual type cast; guard on `if (!campaign)`.
- **Decision**: FIXED — removed type cast; now uses `.single<Campaign>()`.

### F4 — CampaignList renders error strings from /api/campaigns/[id] verbatim

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/campaigns/CampaignList.tsx:37, 65
- **Detail**: setActionError(data.error ?? ...) renders whatever string the PATCH/DELETE endpoints return. Upon investigation, /api/campaigns/[id].ts returns only hard-coded sanitized strings on all error paths — no raw Supabase messages are forwarded. Compliant with the project lesson.
- **Fix A ⭐ Recommended**: Verified /api/campaigns/[id].ts sanitizes errors at source — already safe.
- **Decision**: FIXED via Fix A — verified clean; /api/campaigns/[id].ts confirmed safe.

### F5 — CreateBattleForm missing isLoading spinner

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/battles/CreateBattleForm.tsx
- **Detail**: CreateCampaignForm correctly passes `isLoading={isSubmitting}` to SubmitButton per the component's own comment. CreateBattleForm (the reference pattern) did not, giving the battles submit button no spinner. Campaigns form is the more complete implementation.
- **Fix**: Add `isSubmitting` state to CreateBattleForm and pass `isLoading={isSubmitting}`.
- **Decision**: FIXED — added isSubmitting state and isLoading prop to CreateBattleForm.
