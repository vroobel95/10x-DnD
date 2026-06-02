<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Create Battle

- **Plan**: context/changes/create-battle/plan.md
- **Scope**: Phase 1–4 of 4
- **Date**: 2026-05-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — Unplanned route rename: /dashboard → /battles

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline + Plan Adherence
- **Location**: src/pages/battles/index.astro
- **Detail**: The plan specified overhauling src/pages/dashboard.astro in Phase 2 and adding "/battles" alongside "/dashboard" in PROTECTED_ROUTES in Phase 4. Instead, dashboard.astro was deleted and its content moved to src/pages/battles/index.astro. This cascaded across 5 files: middleware dropped "/dashboard" from PROTECTED_ROUTES, Topbar.astro updated its nav link, [id].astro redirects to /battles instead of /dashboard, eslint.config.js gained an Astro parser workaround, and battles/index.astro was created. The old /dashboard URL now 404s with no redirect.
- **Fix A ⭐ Recommended**: Add a redirect from /dashboard to /battles
  - Strength: Preserves the rename (better UX — all battle routes under /battles/) while covering bookmarked URLs.
  - Tradeoff: One extra file (src/pages/dashboard.astro as a redirect stub).
  - Confidence: HIGH — standard practice for route renames.
  - Blind spot: None significant.
- **Fix B**: Revert the rename — restore dashboard.astro
  - Strength: Matches the plan exactly.
  - Tradeoff: Loses cleaner /battles URL structure. High churn.
  - Confidence: LOW — may break existing links to /battles.
  - Blind spot: May break if anything already links to /battles.
- **Decision**: FIXED via Fix A — added src/pages/dashboard.astro redirect stub

### F2 — No input length or range bounds on form fields

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/battles.ts:29-40
- **Detail**: name and location accept unbounded text (megabytes via crafted POST). party_level validates > 0 but has no upper bound — D&D levels cap at 20; extreme values could cause display issues or downstream bugs in S-02 enemy generation.
- **Fix**: Add bounds checks after line 31: name.length > 200 → error, location.length > 200 → error, parsed > 30 → error (30 accommodates homebrew rules).
- **Decision**: FIXED — added name/location length caps (200) and party_level upper bound (30)

### F3 — CreateBattleForm skips client-side validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/components/battles/CreateBattleForm.tsx
- **Detail**: The plan explicitly said "No client-side validation — server handles it." The implementation follows the plan. However, the existing SignInForm and SignUpForm both implement client-side validation with validate() functions, inline error display, and onSubmit handlers. This creates inconsistent UX: auth forms validate inline, the battle form requires a full round-trip for validation errors.
- **Fix A ⭐ Recommended**: Add client-side validation matching SignInForm pattern
  - Strength: Consistent UX across all forms; reduces server round-trips; follows established project pattern.
  - Tradeoff: Diverges from plan text. Adds ~20 lines.
  - Confidence: HIGH — identical pattern exists in SignInForm.tsx and SignUpForm.tsx.
  - Blind spot: None significant.
- **Fix B**: Accept as-is (plan-compliant)
  - Strength: Matches the plan exactly; server validation works.
  - Tradeoff: UX inconsistency persists.
  - Confidence: HIGH — functionally correct.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — added validate()/handleSubmit/error state matching SignInForm pattern

### F4 — Supabase error messages exposed to end users

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/battles.ts:55
- **Detail**: Raw Supabase error.message forwarded into redirect URL and displayed to users via ServerError. Can leak table names, constraint names. Pre-existing pattern from auth routes — not introduced by this change, just carried forward.
- **Fix**: Map known error codes to user-friendly messages. (Project-wide concern — better addressed as a separate change.)
- **Decision**: FIXED + ACCEPTED-AS-RULE: Sanitize external service errors before exposing to users

### F5 — Campaign lookup duplicated in 3 locations

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/battles.ts:15, :72; src/pages/battles/index.astro:13
- **Detail**: The same campaign lookup query appears in 3 places. If the lookup logic changes, all 3 must be updated in lockstep.
- **Fix**: Extract a getUserCampaign(supabase, userId) helper into src/lib/supabase.ts or a new src/lib/campaigns.ts module.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Extract shared data-access helpers to avoid query duplication
