# Ownership Boundary Implementation Plan

## Overview

Phase 3 of the test rollout: close two open security risks — IDOR access to another GM's resources (Risk #5) and raw Supabase error messages leaking in API responses (Risk #6). Covers production code changes needed before tests can be written, the IDOR and error-safety integration tests themselves, and a close-out that fills the test-plan cookbook.

## Current State Analysis

- `campaigns/[id].ts` PATCH/DELETE — explicit `.eq("user_id", user.id)` filter. App-level guard is present; IDOR tests missing.
- `battles.ts` GET — explicit `.eq("user_id", user.id)` on campaign ownership lookup. App-level guard present; IDOR test label missing.
- `battles/[id]/index.ts` DELETE — indirect ownership via user's campaign IDs. App-level guard present; "user has no campaigns → 404" test already acts as an IDOR case; explicit label missing.
- `enemies/[id].ts` PATCH/DELETE — comment at lines 34 and 57: "Ownership enforced by RLS." No app-level `user_id` filter. Mock-based integration tests cannot enforce RLS; IDOR tests cannot be written without adding an app-level check first.
- `battles/[id]/generate.ts` POST — battle lookup at line 34 uses only `.eq("id", battleId)`, no user scope. Same gap as enemies.
- `signin.ts:16` and `signup.ts:21` — `error=${encodeURIComponent(error.message)}` forwards raw Supabase error strings to the redirect URL. All S-03/S-05 routes (campaigns, enemies) already return sanitized generic messages.
- No test file currently exercises a two-user IDOR scenario; all tests use a single `{ id: "user-1" }` user.

## Desired End State

`npm run test` exits 0 with:
- `enemies/[id].ts` and `generate.ts` protected by app-level ownership checks (campaigns → battles → `.in("battle_id", battleIds)` for enemies; campaign ownership verify for generate)
- `signin.ts` and `signup.ts` return only generic safe error strings
- Every route with an ownership guard has at least one IDOR-labelled test case that asserts 404 on cross-user access
- Two new auth test files (`auth-signin.test.ts`, `auth-signup.test.ts`) assert that error redirects contain safe messages
- `test-plan.md` §6.4 filled in; Phase 3 status advanced to `complete`; `change.md` closed

### Key Discoveries

- `enemies/[id].ts:34,57` — ownership delegated to RLS; no `user_id` in any query.
- `generate.ts:34` — `select("id, party_level, location")` has no `campaign_id`, blocking a campaign ownership check; field must be added.
- `battles/[id]/index.ts` (lines 19–26 + 38) — the reference pattern for indirect ownership: fetch user's campaign IDs, then filter the target table via `.in("campaign_id", campaignIds)`. Enemies mirrors this with one extra hop (`battles` between campaigns and enemies).
- `makeSupabaseMock` is keyed by table name and returns the same result for every call to `.from("tableName")` regardless of chained filters. Adding ownership checks to `enemies/[id].ts` requires two additional `.from()` calls (`campaigns`, `battles`) — all existing `enemies-id.test.ts` tests break until they include those table keys.
- Same breakage applies to `battles-generate.test.ts`: every test that hits the success path must add a `campaigns` table key and `campaign_id` to `battleData`.

## What We're NOT Doing

- Not testing `battles.ts` POST IDOR — that handler returns a `context.redirect()`, not `Response.json()`; its campaign ownership check (`.eq("user_id", user.id)` at line 26) is present and tested implicitly by the existing "campaign not found" redirect case.
- Not testing `campaigns/index.ts` GET or POST — GET returns only the authenticated user's own campaigns (no resource ID to guess); POST creates a new campaign for the user; no IDOR surface.
- Not adding rate-limit branching to `signin.ts` or `signup.ts` — the fix is purely replacing the raw `error.message` with a fixed safe string.
- Not adding or modifying RLS policies — RLS stays as defense-in-depth; this phase adds the app-layer guard.
- No E2E tests — per test-plan §7.

## Implementation Approach

Four phases in dependency order:
1. Production code first — ownership checks + auth sanitization must land before any tests against the new code paths.
2. IDOR tests — update existing test files broken by Phase 1 + add labelled IDOR cases.
3. Error safety tests — new test files for signin and signup.
4. Close-out — cookbook + status updates; no production code.

## Critical Implementation Details

**Three-query ownership check for enemies.** The enemy table has no `user_id` — ownership is indirect: enemy → `battle_id` → campaign → `user_id`. The implementation mirrors `battles/[id]/index.ts`: (1) fetch campaign IDs for `user.id`, (2) fetch battle IDs `.in("campaign_id", campaignIds)`, (3) add `.in("battle_id", battleIds)` to the existing enemy query. Return 404 early if `campaignIds` or `battleIds` is empty — do not pass an empty array to `.in()`; PostgREST behaviour with `.in(field, [])` is undefined.

**generate.ts needs `campaign_id` in the battle SELECT.** The battle fetch at line 34 currently selects `"id, party_level, location"`. Add `campaign_id` so the subsequent campaign ownership check can reference `battle.campaign_id`.

**Existing `enemies-id.test.ts` tests all break after Phase 1.** Every test that reaches the actual enemy operation now hits two upstream `.from()` calls first. Fix: add `campaigns: { data: [{ id: "camp-1" }], error: null }` and `battles: { data: [{ id: "b-1" }], error: null }` to every mock in that file.

**Existing `battles-generate.test.ts` tests break similarly.** Add `campaign_id: "camp-1"` to `battleData` and `campaigns: { data: { id: "camp-1" }, error: null }` (single-object shape, because the route uses `.single()`) to every test that reaches the battle fetch success path.

**IDOR mock pattern.** There is no real second user. Simulate cross-user access by setting `locals.user = { id: "user-a" }` and configuring the mock so the ownership lookup returns no matching row — for enemies: `battles: { data: [], error: null }` (empty battle IDs); for campaigns: `campaigns: { data: null, error: { code: "PGRST116", message: "No rows found" } }` (PGRST116 for routes that use `.single()`). The route's existing "not found" branch handles these; the test just labels them as IDOR cases.

---

## Phase 1: Production Code — Ownership Guards and Auth Error Sanitization

### Overview

Add app-level ownership checks to `enemies/[id].ts` and `generate.ts`. Replace raw `error.message` in `signin.ts` and `signup.ts` with safe generic strings. No test files change in this phase.

### Changes Required

#### 1. src/pages/api/enemies/[id].ts — PATCH handler ownership check

**File**: `src/pages/api/enemies/[id].ts`

**Intent**: Before both the stats-update and confirm-update paths in the PATCH handler, verify that the enemy's battle belongs to one of the authenticated user's campaigns. Return 404 if ownership cannot be confirmed.

**Contract**: Insert two queries at the top of the PATCH handler (after the `user` null check, before the `isJson` branch): (1) `supabase.from("campaigns").select("id").eq("user_id", user.id)` — return 500 on error, 404 if result array is empty; (2) `supabase.from("battles").select("id").in("campaign_id", campaignIds)` — return 500 on error, 404 if result array is empty. Add `.in("battle_id", battleIds)` to both the stats-update UPDATE and the confirm UPDATE chains.

#### 2. src/pages/api/enemies/[id].ts — DELETE handler ownership check

**File**: `src/pages/api/enemies/[id].ts`

**Intent**: Apply the same campaigns → battles ownership lookup to the DELETE handler before the delete operation.

**Contract**: Same two-query ownership check as in change 1, inserted after the `user` null check. Add `.in("battle_id", battleIds)` to the DELETE chain.

#### 3. src/pages/api/battles/[id]/generate.ts — add campaign_id to battle select and verify ownership

**File**: `src/pages/api/battles/[id]/generate.ts`

**Intent**: After confirming the battle exists, verify the battle's campaign belongs to the authenticated user.

**Contract**: Change the battle select at line 34 from `"id, party_level, location"` to `"id, party_level, location, campaign_id"`. After the existing `battleResult.error` check, add a campaign ownership query: `supabase.from("campaigns").select("id").eq("id", battle.campaign_id).eq("user_id", user.id).single()`. If it returns PGRST116, return 404 with `"Battle not found"`; if any other error, return 500 with `"Could not load battle. Please try again."`.

#### 4. src/pages/api/auth/signin.ts — sanitize error message

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Stop forwarding the raw Supabase `error.message` in the redirect URL.

**Contract**: Replace `error.message` at line 16 with a fixed, user-safe string (e.g., `"Sign in failed. Please try again."`).

#### 5. src/pages/api/auth/signup.ts — sanitize error message

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Stop forwarding the raw Supabase `error.message` in the redirect URL.

**Contract**: Replace `error.message` at line 21 with a fixed, user-safe string (e.g., `"Could not create account. Please try again."`).

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes with no new errors
- `npm run lint` passes with no new errors

#### Manual Verification

- `npm run test` is NOT expected to pass yet — existing `enemies-id.test.ts` and `battles-generate.test.ts` tests will fail because their mocks don't include the new `campaigns`/`battles` table keys. This is expected and resolved in Phase 2.

**After completing this phase, pause here to confirm `typecheck` and `lint` pass before proceeding to Phase 2.**

---

## Phase 2: IDOR Integration Tests (Risk #5)

### Overview

Update the two test files broken by Phase 1 so they pass again with the new ownership-check queries. Then add explicit IDOR-labelled test cases to every route that has an app-level ownership guard.

### Changes Required

#### 1. tests/integration/api/enemies-id.test.ts — update broken existing tests

**File**: `tests/integration/api/enemies-id.test.ts`

**Intent**: Every existing test that reaches the enemy update/delete operation now requires the ownership pre-check to succeed. Add `campaigns` and `battles` mock data to all such tests so the new upstream queries return valid data.

**Contract**: For every `makeSupabaseMock({...})` call in the PATCH confirm, PATCH stats-update, and DELETE describe blocks that configures `enemies` and is expected to reach the enemy operation, add `campaigns: { data: [{ id: "camp-1" }], error: null }` and `battles: { data: [{ id: "b-1" }], error: null }`. Tests that return early (null supabase → 500, null user → 401) do not need these keys.

#### 2. tests/integration/api/enemies-id.test.ts — add IDOR test cases

**File**: `tests/integration/api/enemies-id.test.ts`

**Intent**: Prove that PATCH and DELETE return 404 when the authenticated user does not own the enemy's battle.

**Contract**:

PATCH confirm IDOR test:
- Label: `"returns 404 when enemy does not belong to the authenticated user (IDOR)"`
- Mock: `campaigns: { data: [{ id: "camp-1" }], error: null }`, `battles: { data: [], error: null }` (empty battle IDs — enemy's battle not in user's battles)
- Assert: `res.status === 404`

DELETE IDOR test:
- Same mock shape; assert `res.status === 404`

#### 3. tests/integration/api/battles-generate.test.ts — update broken existing tests

**File**: `tests/integration/api/battles-generate.test.ts`

**Intent**: Every test that reaches or passes the battle fetch success path now requires the campaign ownership check. Add `campaign_id` to `battleData` and add `campaigns` mock data.

**Contract**: Add `campaign_id: "camp-1"` to the top-level `battleData` constant. For every `makeSupabaseMock({...})` call that configures `battles: { data: battleData, error: null }`, add `campaigns: { data: { id: "camp-1" }, error: null }` (single-object shape — route uses `.single()`). Tests that return before the battle fetch (null supabase, null user, bad prompt) do not need this.

#### 4. tests/integration/api/battles-generate.test.ts — add IDOR test case

**File**: `tests/integration/api/battles-generate.test.ts`

**Intent**: Prove that POST /api/battles/[id]/generate returns 404 when the battle's campaign belongs to another user.

**Contract**:
- Label: `"returns 404 when battle does not belong to the authenticated user (IDOR)"`
- Mock: `battles: { data: { ...battleData, campaign_id: "camp-1" }, error: null }`, `campaigns: { data: null, error: { code: "PGRST116", message: "No rows found" } }` (PGRST116 — campaign exists but ownership check fails)
- Assert: `res.status === 404`

#### 5. tests/integration/api/campaigns-id.test.ts — add IDOR test cases

**File**: `tests/integration/api/campaigns-id.test.ts`

**Intent**: Make explicit that the 404 path for PATCH and DELETE represents the IDOR case (not just "campaign doesn't exist"), since `.eq("user_id", user.id)` causes another user's campaign to appear as not-found.

**Contract**: Add one test per describe block:

PATCH IDOR: label `"returns 404 when campaign belongs to another user (IDOR)"` — mock `campaigns: { data: null, error: { code: "PGRST116", message: "No rows found" } }` — assert 404.

DELETE IDOR: label `"returns 404 when campaign belongs to another user (IDOR)"` — mock `campaigns: { data: [], error: null }` (empty array — DELETE path uses array not PGRST116) — assert 404.

#### 6. tests/integration/api/battles.test.ts — add IDOR test case

**File**: `tests/integration/api/battles.test.ts`

**Intent**: Make explicit that the 404 path for GET battles represents the IDOR case.

**Contract**: Add one test to the GET describe block: label `"returns 404 when campaign belongs to another user (IDOR)"` — mock `campaigns: { data: null, error: { code: "PGRST116", message: "No rows found" } }` — assert 404.

#### 7. tests/integration/api/battles-id.test.ts — label existing IDOR case

**File**: `tests/integration/api/battles-id.test.ts`

**Intent**: The existing `"returns 404 when user has no campaigns"` test is already an IDOR test (accessing another user's battle when user has no campaigns). Add a second, explicitly labelled case where the user has campaigns but none contain this battle.

**Contract**: Add one test: label `"returns 404 when battle belongs to another user's campaign (IDOR)"` — mock `campaigns: { data: [{ id: "camp-other" }], error: null }`, `battles: { data: [], error: null }` (battle not in user's campaigns) — assert 404.

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 — all existing tests pass with updated mocks; all new IDOR cases pass
- `npm run lint` passes with no new errors

#### Manual Verification

- Each new IDOR-labelled test clearly documents the two-user scenario in its name

**After completing this phase, pause here for confirmation that `npm run test` exits 0 before proceeding to Phase 3.**

---

## Phase 3: Error Safety Regression Tests (Risk #6)

### Overview

Create integration test files for `signin.ts` and `signup.ts` that assert error redirects contain safe messages after the Phase 1 sanitization fix. These routes return `context.redirect()` — the same assertion pattern as the auth tests from Phase 2 of the test rollout.

### Changes Required

#### 1. tests/integration/api/auth-signin.test.ts

**File**: `tests/integration/api/auth-signin.test.ts`

**Intent**: Prove that signin errors redirect with safe messages after Phase 1's sanitization fix; regression guard against future reintroduction of raw error forwarding.

**Contract**:
- `vi.mock('@/lib/supabase', () => ({ createClient: vi.fn() }))`
- `makeContext(options?)` creates a POST request with `Content-Type: application/x-www-form-urlencoded` body containing `email` and `password`; includes `redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } })` on the context stub
- Cases:
  - null supabase → 302, `location` contains `error=` and `location` does NOT contain `message` (or whatever the raw Supabase error string would be)
  - `signInWithPassword` returns error → 302, `location` contains `error=` and `location` does NOT contain the raw `error.message` value — assert the location contains the safe fixed string from Phase 1
  - success → 302, `location` equals `"/"`

#### 2. tests/integration/api/auth-signup.test.ts

**File**: `tests/integration/api/auth-signup.test.ts`

**Intent**: Same goal as auth-signin — regression guard for the Phase 1 error sanitization in `signup.ts`.

**Contract**:
- Same mock setup as auth-signin
- `makeContext` builds POST request with `email` and `password` fields
- Cases:
  - null supabase → 302, `location` contains `error=`
  - `signUp` returns error → 302, `location` contains `error=` AND the safe fixed message; `location` does NOT contain the raw `error.message` value
  - success → 302, `location` equals `"/auth/confirm-email"`

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 — all new auth-signin and auth-signup tests pass alongside the existing suite
- `npm run lint` passes

#### Manual Verification

- Trigger a failed sign-in in the running app and confirm the URL query param contains the safe message, not a raw Supabase error string

**After completing this phase, pause here for manual confirmation before proceeding to Phase 4.**

---

## Phase 4: Close-Out

### Overview

Fill the test-plan cookbook §6.4 with the IDOR test pattern established in this phase. Advance Phase 3 status to `complete`. Mark change.md done. No production code changes.

### Changes Required

#### 1. context/foundation/test-plan.md — §6.4 ownership boundary test pattern

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the `§6.4` "TBD" placeholder with the IDOR test pattern established in this phase.

**Contract**:
- Location: existing test files — add IDOR cases to `tests/integration/api/<route>.test.ts` for the route under test
- Mock pattern: no real second user; simulate cross-user access by setting `locals.user = { id: "user-a" }` and configuring the mock to return no matching row for the ownership lookup — for routes that use `.single()` (PGRST116-returning), mock the ownership table as `{ data: null, error: { code: "PGRST116", message: "..." } }`; for routes that use array return and check `data.length === 0`, mock as `{ data: [], error: null }`
- Assert: `res.status === 404`
- Key rule: routes relying solely on RLS (no app-level user filter) must have an app-level ownership check added before IDOR tests can be written — mock-based integration tests do not enforce RLS. Reference: Phase 3 of the test rollout added ownership checks to `enemies/[id].ts` and `generate.ts` for this reason.
- Reference test: `tests/integration/api/enemies-id.test.ts` (IDOR cases)

#### 2. context/foundation/test-plan.md — §3 Phase 3 status

**File**: `context/foundation/test-plan.md`

**Intent**: Advance Phase 3 rollout status to `complete` and add the change folder reference.

**Contract**: Change Phase 3 row Status from `not started` to `complete`; set Change folder to `context/changes/ownership-boundary/`. Update "Last updated" header to today's date.

#### 3. context/changes/ownership-boundary/change.md

**File**: `context/changes/ownership-boundary/change.md`

**Intent**: Mark the change complete.

**Contract**: `status: complete`, `updated: 2026-06-06`.

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 — full suite, no regressions from doc edits

#### Manual Verification

- `context/foundation/test-plan.md` §6.4 contains the IDOR pattern (not "TBD")
- §3 Phase 3 row shows `complete`

---

## Testing Strategy

### Integration Tests

- `tests/integration/api/enemies-id.test.ts` — PATCH/DELETE IDOR cases (Risk #5)
- `tests/integration/api/battles-generate.test.ts` — POST generate IDOR case (Risk #5)
- `tests/integration/api/campaigns-id.test.ts` — PATCH/DELETE IDOR cases (Risk #5)
- `tests/integration/api/battles.test.ts` — GET IDOR case (Risk #5)
- `tests/integration/api/battles-id.test.ts` — DELETE explicit IDOR case (Risk #5)
- `tests/integration/api/auth-signin.test.ts` — error safety regression (Risk #6)
- `tests/integration/api/auth-signup.test.ts` — error safety regression (Risk #6)

### Manual Testing Steps

1. After Phase 1: run `npm run typecheck` and `npm run lint`; confirm both pass
2. After Phase 2: run `npm run test`; confirm all existing tests pass with updated mocks and all new IDOR cases pass
3. After Phase 3: run `npm run test`; manually trigger a failed sign-in and inspect the URL
4. After Phase 4: inspect `test-plan.md` §6.4 and §3 visually

## References

- Test plan Phase 3 risks: `context/foundation/test-plan.md` §2 (#5, #6)
- Reference ownership pattern: `src/pages/api/battles/[id]/index.ts` (campaigns → battles indirect check)
- Reference auth test pattern: `tests/integration/api/auth-callback.test.ts`
- Existing enemy tests: `tests/integration/api/enemies-id.test.ts`
- Existing generate tests: `tests/integration/api/battles-generate.test.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Production Code — Ownership Guards and Auth Error Sanitization

#### Automated

- [x] 1.1 `npm run typecheck` passes with no new errors — de01934
- [x] 1.2 `npm run lint` passes with no new errors — de01934

### Phase 2: IDOR Integration Tests

#### Automated

- [x] 2.1 `npm run test` exits 0 — all existing tests pass with updated mocks; all new IDOR cases pass — b2b850a
- [x] 2.2 `npm run lint` passes with no new errors — b2b850a

### Phase 3: Error Safety Regression Tests

#### Automated

- [x] 3.1 `npm run test` exits 0 — all new auth-signin and auth-signup tests pass alongside the existing suite — ca0508e
- [x] 3.2 `npm run lint` passes — ca0508e

#### Manual

- [ ] 3.3 Failed sign-in in the running app shows a safe error message in the URL, not a raw Supabase error string

### Phase 4: Close-Out

#### Automated

- [x] 4.1 `npm run test` exits 0 — full suite, no regressions

#### Manual

- [x] 4.2 `context/foundation/test-plan.md` §6.4 contains the IDOR pattern (not "TBD")
- [x] 4.3 §3 Phase 3 row shows `complete`
