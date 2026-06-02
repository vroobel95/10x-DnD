<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: S-05 Campaign Management

- **Plan**: context/changes/campaign-management/plan.md
- **Scope**: Phase 1–4 of 4
- **Date**: 2026-06-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Root page missing authenticated redirect to /campaigns

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/pages/index.astro
- **Detail**: Plan Phase 3 step 7 requires: "if (Astro.locals.user) return Astro.redirect('/campaigns')". The file renders `<Welcome />` unconditionally. Commit 29593b9 ("fix(landing): restore landing page for authenticated users") explicitly reverted the redirect — appears intentional. Authenticated users visiting "/" see the landing page instead of their campaigns. Post-login flow still works via dashboard.astro redirect.
- **Fix A ⭐ Recommended**: Add the redirect as planned
  - Strength: Matches plan intent; users land where they expect.
  - Tradeoff: Authenticated users can no longer view the landing page without signing out.
  - Confidence: HIGH — one-line change.
  - Blind spot: The revert was deliberate — check if there's a UX reason.
- **Fix B**: Document as intentional deviation in the plan
  - Strength: Preserves current behavior; updates plan to match reality.
  - Tradeoff: "/" remains a dead end for logged-in users.
  - Confidence: MEDIUM — depends on UX intent.
  - Blind spot: None significant.
- **Decision**: DOCUMENTED — intentional deviation; addendum added to plan Phase 3 step 7

### F2 — PATCH endpoint silently discards description field

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/campaigns/[id].ts:34
- **Detail**: The PATCH body type declares `{ name?: string; description?: string }` but the `update()` call only sends `{ name, updated_at }`. Description is parsed from request but silently dropped. A client sending a description update receives 200 while the value is never saved.
- **Fix**: Include description in the update payload and add length validation (max 500 chars) consistent with the POST endpoint.
- **Decision**: FIXED

### F3 — Four endpoints rely solely on RLS without app-level ownership checks

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/campaigns/[id].astro:18, src/pages/api/battles/[id]/index.ts:19, src/pages/api/battles.ts:54, src/pages/api/battles.ts:91
- **Detail**: These endpoints query/mutate by ID without an app-level user_id filter, relying entirely on Supabase RLS. Meanwhile, src/pages/api/campaigns/[id].ts correctly adds `.eq("user_id", user.id)` on PATCH and DELETE. The inconsistency means some routes have defense-in-depth and others don't.
- **Fix A ⭐ Recommended**: Add ownership checks to all four locations
  - Strength: Defense-in-depth; consistent with campaigns/[id].ts pattern.
  - Tradeoff: Extra query for battle routes (join through campaign).
  - Confidence: HIGH — pattern exists in this PR.
  - Blind spot: RLS is correctly configured today; this is preventive.
- **Fix B**: Accept RLS-only and document the convention
  - Strength: Less code; RLS is the designed auth layer.
  - Tradeoff: All four endpoints exposed if RLS ever misconfigured.
  - Confidence: MEDIUM — acceptable if RLS is audited.
  - Blind spot: No RLS audit process documented.
- **Decision**: FIXED via Fix A — ownership checks added to all 4 locations

### F4 — getUserCampaigns silently swallows query errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/campaigns.ts:4-9
- **Detail**: The helper destructures only `{ data }` and ignores the error object. If the Supabase query fails, the function returns `[]` — identical to "user has no campaigns." Callers show empty state with no error feedback. Violates lessons.md: "Never silently swallow fetch errors."
- **Fix**: Return `{ data, error }` and let callers surface failures (error banner on page, 500 on API).
- **Decision**: FIXED — helper returns { data, error }; API returns 500; Astro page shows error banner

### F5 — Campaign creation uses React island + JSON API instead of planned inline form

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/campaigns/CreateCampaignForm.tsx, src/pages/api/campaigns/index.ts
- **Detail**: Plan specified inline HTML form with native POST reading form data and server-side redirect. Implementation uses a separate React component sending JSON via fetch with client-side redirect to `/campaigns/${id}`. Better UX but changes API contract. The plan's `?error=` query param reading on campaigns/index.astro was not implemented since errors are handled client-side.
- **Fix**: Document as intentional improvement in the plan. No code change needed.
- **Decision**: DOCUMENTED — addendum added to plan Phase 3 step 4

### F6 — Campaign DELETE returns success for non-existent resources

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/campaigns/[id].ts:62-68
- **Detail**: DELETE handler checks `if (error)` but doesn't verify a row was deleted. Supabase `.delete()` returns no error for zero-row matches. Response is `{success: true}` for non-existent campaigns. Battle DELETE correctly uses `.select("id").single()`.
- **Fix**: Add `.select("id").single()` and check `!data` to return 404, matching battle DELETE pattern.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Confirm row deletion before returning success on DELETE endpoints

### F7 — No pagination on campaign and battle list queries

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/campaigns.ts:4, src/pages/campaigns/[id].astro:26
- **Detail**: getUserCampaigns and the battles query fetch all results with no limit. Unlikely to be a problem for a DnD campaign manager, but no upper bound exists.
- **Fix**: Add `.limit(100)` as a safety cap. Not urgent for current usage patterns.
- **Decision**: SKIPPED — will be addressed as a dedicated pagination/lazy loading slice
