<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Battle Environment Generation

- **Plan**: context/changes/battle-environment/plan.md
- **Scope**: Full plan (4 phases)
- **Date**: 2026-06-12
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  4 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — SubmitButton removes useFormStatus without updating callers

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline / Pattern Consistency
- **Location**: src/components/auth/SubmitButton.tsx
- **Detail**: Unplanned change removes useFormStatus entirely and adds `isLoading?: boolean` (default false). All 5 callers — SignInForm, SignUpForm, ForgotPasswordForm, ResetPasswordForm, CreateBattleForm — pass no `isLoading` prop, so the button's spinner and disabled state are permanently dead. Important nuance: useFormStatus only works with React 19 form actions, NOT native method="POST" forms. These forms all use native POST, so `pending` was already always false. The spinner was never showing in practice. The SSR crash was real and the fix was correct. The behavioral regression is theoretical, not currently observable.
- **Fix A ⭐ Recommended**: Accept as-is, add a comment in SubmitButton.tsx explaining that `isLoading` must be wired by the caller.
  - Strength: No code churn; the SSR crash is fixed; the status quo is accurate (spinners never worked with native forms).
  - Tradeoff: Future maintainers may not know to wire `isLoading`.
  - Confidence: HIGH — `useFormStatus` was never returning true here.
  - Blind spot: If someone switches a form to React Server Actions later, they'll need to remember to pass `isLoading`.
- **Fix B**: Restore useFormStatus + keep isLoading as an override (OR semantics), guarding the hook call to survive SSR.
  - Strength: Preserves forward compatibility with Server Actions.
  - Tradeoff: try/catch around a hook is unconventional React; the SSR guard is fragile across React version upgrades.
  - Confidence: LOW — React hook behavior in try/catch may break in future versions.
  - Blind spot: React 19 may fix the SSR crash upstream anyway.
- **Decision**: FIXED via Fix A — added comment to SubmitButton.tsx explaining `isLoading` must be wired by callers using native forms.

### F2 — Generated environment lost on UPDATE failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/battles/[id]/environment.ts:49-68
- **Detail**: `generateEnvironment()` can succeed (AI call completes, result validated) and then the Supabase UPDATE fails. The endpoint returns 500 and the generated content is silently discarded — the full AI API call is wasted and the user sees "Could not save environment." with no way to retry just the save.
- **Fix**: On UPDATE failure, return the generated environment in the error response body so the client can display it without the DB being the source of truth for that render. Update EnvironmentSection.tsx to check for `environment` in error responses.
  - Strength: The client already handles environment from the response — a small change to EnvironmentSection.tsx would give the user the content even when persistence fails.
  - Tradeoff: Slightly complicates the error contract on the client.
  - Confidence: MEDIUM — depends on how important "never lose a generation" is for this app.
  - Blind spot: Haven't benchmarked how often Supabase UPDATE fails in practice on this stack.
- **Decision**: FIXED — environment.ts returns environment in UPDATE error body; EnvironmentSection.tsx displays it on error.

### F3 — undefined environment guard missing in EnvironmentSection

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/battles/EnvironmentSection.tsx:33-35
- **Detail**: When `res.ok` is true but `data.environment` is undefined (e.g. the API returns `{}` due to a bug), `setEnvironment(undefined ?? null)` silently clears a previously displayed environment. The user sees the 5-field grid disappear with no error message — looks like data loss even though the server returned 200.
- **Fix**: Add a guard before `setEnvironment`: `if (!data.environment) { setError("Generation failed. Please try again."); return; }`. Matches the defensive pattern in EnemiesSection.
- **Decision**: FIXED — guard added in EnvironmentSection.tsx; missing environment on 200 now surfaces an error message.

### F4 — Battle fetch on [id].astro silently redirects on DB error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/battles/[id].astro:16-23
- **Detail**: The battle fetch ignores the `error` field entirely. A real Supabase error (503, network timeout, schema failure) produces the same outcome as "battle not found": a silent redirect to /campaigns. This was pre-existing before the battle-environment change — this change touched the file and added an import but did not fix it.
- **Fix**: Destructure `error`, check `error.code`: if error exists and it is NOT "PGRST116" (row not found), return a 500 response instead of redirecting — same pattern used in the API routes added in this change.
- **Decision**: FIXED — battles/[id].astro now distinguishes PGRST116 (not found → redirect) from real DB errors (→ 500).

### F5 — No max-length on AI-generated string fields

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/schemas/environment.ts:3-9
- **Detail**: Five string fields have `.min(1)` but no `.max()`. A misbehaving model could produce multi-kilobyte strings. Consistent with EnemySchema (same gap exists there), so not a new regression.
- **Fix**: Add `.max(2000)` to each field, matching the user prompt validation cap already enforced in generate.ts.
- **Decision**: FIXED — added .max(2000) to all 5 fields in environment.ts.

### F6 — types.ts re-export creates two canonical import paths for BattleEnvironment

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/types.ts:5-7
- **Detail**: generate.ts imports BattleEnvironment directly from `@/lib/schemas/environment`; the battle page imports it via `@/types`. No circular dependency, no runtime risk — just two valid paths to the same type.
- **Fix**: No action required unless the team wants to enforce a single canonical import source.
- **Decision**: FIXED — generate.ts now imports BattleEnvironment from @/types; all consumers go through the central hub.

### F7 — PGRST116 on UPDATE is semantically misleading

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/pages/api/battles/[id]/environment.ts:63-67
- **Detail**: After a successful UPDATE with `.select("id").single()`, Supabase returns PGRST116 only if the row was deleted between the ownership check and the write (a real but rare race). The pattern is correct and secure. A comment explaining this race-condition scenario would help future readers.
- **Fix**: Add a one-line comment above the PGRST116 branch.
- **Decision**: FIXED — added one-line comment above the PGRST116 branch in environment.ts.
