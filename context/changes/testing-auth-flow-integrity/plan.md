# Testing Auth Flow Integrity — Implementation Plan

## Overview

Bootstrap integration test coverage for two Phase 2 risks: Risk #2 (auth callback open-redirect protection and null-client guards) and Risk #4 (enemy confirm route error-handling contracts). All code protections are already in place in production; these are regression guard tests.

## Current State Analysis

No integration tests exist for any auth route or the `enemies/[id]` route. The protections exist in production code but are entirely untested:

- `callback.ts:7` — open-redirect guard: `const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";`
- `forgot-password.ts:14` — null-client guard: `if (!supabase) { return context.redirect('...error...') }`
- `reset-password.ts:28` — null-client guard: same pattern
- `recovery-callback.ts` — null-client handled implicitly via `if (supabase)` block structure
- `enemies/[id].ts` — PATCH confirm uses `.select().single()` after `.update()`, so silently succeeding with no row affected is impossible

**Stack constraint:** Auth routes call `supabase.auth.*` methods (`exchangeCodeForSession`, `resetPasswordForEmail`, `updateUser`), not `supabase.from()`. The existing `makeSupabaseMock` in `tests/helpers/supabase.ts` only handles `from()` chains — a new auth mock helper is required.

**Assertion pattern:** Auth routes return `context.redirect()`, not `Response.json()`. Tests assert `res.status === 302` and `res.headers.get("location")`. This differs from all existing integration tests.

## Desired End State

`npm run test` exits 0 with:
- Four new auth integration test files covering all four auth routes (callback, recovery-callback, forgot-password, reset-password)
- One new enemy integration test file covering PATCH confirm and DELETE
- Every route has: null-client, unauthorized (where applicable), Supabase error, not-found, and happy-path cases
- The open-redirect test (`next=https://evil.com` → `location === "/"`) is the key regression guard for Risk #2

### Key Discoveries

- `callback.ts:7`: open-redirect protection exists — `raw.startsWith("/") && !raw.startsWith("//")` blocks external domains and double-slash bypasses
- `forgot-password.ts:30-32`: non-429/non-500 Supabase errors fall through to the success redirect intentionally (prevents email enumeration — don't reveal if an email is registered)
- `enemies/[id].ts:58-72`: confirm PATCH uses `.select().single()` — the route cannot silently return 200 if the update hit zero rows
- `enemies/[id].ts:87-95`: DELETE checks `deleteResult.data.length === 0` for not-found — mock must return `{ data: [], error: null }` for that case, not PGRST116

## What We're NOT Doing

- No test for the stats-update PATCH path in `enemies/[id].ts` (different feature; separate risk)
- No real-DB persistence test for Risk #4 — mock-based tests prove error-handling contracts but cannot prove a DB write actually persisted (the mock always returns what you configure); flagged as a known limitation below
- No auth E2E tests (email-link flow requires a real Supabase session; deferred per test-plan.md §7)
- No auth signup/signin/signout tests
- No CI wiring (Phase 4)

**Risk #4 limitation:** The `.select().single()` chain in the PATCH confirm handler means the route cannot silently succeed if the update touched zero rows — but mock-based tests still can't prove the write hit the DB. True persistence proof requires a live Supabase instance and is out of scope for this phase.

## Implementation Approach

Follow the existing integration test pattern from §6.2 of `test-plan.md`: mock `@/lib/supabase` at module boundary via `vi.mock`, use a per-file `makeContext()` helper, call route handlers directly. Extend the helper layer with a new `makeAuthClientMock()` factory for `supabase.auth.*` methods.

## Critical Implementation Details

**Redirect mock in `makeContext`.** Auth routes call `context.redirect(url)`. The stub must provide a `redirect` function that returns a real Response — not just a mock that returns `undefined`. Use:
```typescript
redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } })
```
Without this, the route handler throws when it tries to call `context.redirect`.

**POST routes need a real URL-encoded form body.** `forgot-password.ts` and `reset-password.ts` call `context.request.formData()`. The stub Request must be created with `method: "POST"`, `headers: { "Content-Type": "application/x-www-form-urlencoded" }`, and a body produced by `new URLSearchParams({ ... }).toString()`. A bare `new Request(url)` causes `formData()` to throw at runtime.

**PGRST116 vs empty-array for enemies.** The enemy PATCH uses `.single()` — not-found returns `{ data: null, error: { code: "PGRST116", message: "..." } }`. The enemy DELETE uses `.select("id")` (array return) and checks `data.length === 0` — not-found returns `{ data: [], error: null }`. Use the correct mock shape for each; the wrong shape will make the handler follow the wrong branch.

**PATCH branch detection.** `enemies/[id].ts` checks `Content-Type: application/json` to choose between the stats-update path and the confirm path. For confirm-path tests, construct the stub Request with no content-type header (or `method: "PATCH"` with no body), so the handler takes the confirm path (lines 57–72).

---

## Phase 1: Auth Route Integration Tests (Risk #2)

### Overview

Create the shared auth mock helper and four integration test files — one per auth route. The central regression guard is the open-redirect test in auth-callback: `next=https://evil.com` must resolve to `"/"`, not to the external domain.

### Changes Required

#### 1. tests/helpers/auth.ts

**File**: `tests/helpers/auth.ts`

**Intent**: Shared mock factory for `supabase.auth.*` methods, the `from()`-route equivalent of `makeSupabaseMock`.

**Contract**: Exported `makeAuthClientMock(results?)` where each key in `results` is optional and defaults to `{ error: null }`. Returns `{ auth: { exchangeCodeForSession, resetPasswordForEmail, updateUser } }` where each is a `vi.fn()` resolving to the configured result.

```typescript
import { vi } from "vitest";

export function makeAuthClientMock(results: {
  exchangeCodeForSession?: { error: unknown };
  resetPasswordForEmail?: { error: unknown };
  updateUser?: { error: unknown };
} = {}) {
  return {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue(results.exchangeCodeForSession ?? { error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue(results.resetPasswordForEmail ?? { error: null }),
      updateUser: vi.fn().mockResolvedValue(results.updateUser ?? { error: null }),
    },
  };
}
```

#### 2. tests/integration/api/auth-callback.test.ts

**File**: `tests/integration/api/auth-callback.test.ts`

**Intent**: Integration tests for `callback.ts` GET. The critical case is the open-redirect protection: `next=https://evil.com` must redirect to `"/"`, not to the external domain.

**Contract**:
- `vi.mock('@/lib/supabase', () => ({ createClient: vi.fn() }))`
- `makeContext(options?)` builds a GET request URL with `?code=` and `?next=` search params and attaches the `redirect` mock
- no code → 302, `location` contains `/auth/signin` and `error=`
- code + null supabase → 302, `location` contains `/auth/signin` and `error=`
- code + exchange error → 302, `location` contains `/auth/signin` and `error=`
- code + success + `next="/campaigns"` → 302, `location` equals `"/campaigns"`
- code + success + `next="https://evil.com"` → 302, `location` equals `"/"` (open-redirect blocked)
- code + success + `next="//evil.com"` → 302, `location` equals `"/"` (double-slash bypass blocked)

#### 3. tests/integration/api/auth-recovery-callback.test.ts

**File**: `tests/integration/api/auth-recovery-callback.test.ts`

**Intent**: Integration tests for `recovery-callback.ts` GET. Null supabase and exchange failure must redirect to the forgot-password error page, not to reset-password.

**Contract**:
- `vi.mock('@/lib/supabase', () => ({ createClient: vi.fn() }))`
- `makeContext(options?)` builds a GET request URL with optional `?code=`
- no code → 302, `location` contains `error=`
- code + null supabase → 302, `location` contains `error=`
- code + exchange error → 302, `location` contains `error=`
- code + success → 302, `location` equals `"/auth/reset-password"`

#### 4. tests/integration/api/auth-forgot-password.test.ts

**File**: `tests/integration/api/auth-forgot-password.test.ts`

**Intent**: Integration tests for `forgot-password.ts` POST. Critical null-client case: when supabase is null, route must redirect to an error URL, not to `?success=1`.

**Contract**:
- `vi.mock('@/lib/supabase', () => ({ createClient: vi.fn() }))`
- `makeContext(options?)` creates a POST request with URL-encoded body containing `email` field
- null supabase → 302, `location` does NOT contain `success` AND `location` contains `error=`
- rate-limited (429 error) → 302, `location` contains `error=` and URL-encoded "Please wait"
- server error (status ≥ 500) → 302, `location` contains `error=` and URL-encoded "Something went wrong"
- success (error: null) → 302, `location` equals `"/auth/forgot-password?success=1"`
- non-429/non-500 error (e.g. `{ status: 400, message: "..." }`) → 302, `location` equals `"/auth/forgot-password?success=1"` — intentional; prevents email enumeration

#### 5. tests/integration/api/auth-reset-password.test.ts

**File**: `tests/integration/api/auth-reset-password.test.ts`

**Intent**: Integration tests for `reset-password.ts` POST. Critical null-client case: when supabase is null, route must redirect to an error URL, not to the success destination.

**Contract**:
- `vi.mock('@/lib/supabase', () => ({ createClient: vi.fn() }))`
- `makeContext(options?)` creates a POST request with URL-encoded body containing `password` and `confirm_password`, with `locals.user` defaulting to `{ id: "user-1" }`
- no user (`locals.user = null`) → 302, `location` equals `"/auth/forgot-password"`
- password < 6 chars → 302, `location` contains `error=`
- password mismatch (password ≠ confirm_password) → 302, `location` contains `error=`
- null supabase → 302, `location` contains `error=` (NOT a success redirect)
- updateUser error → 302, `location` contains `error=`
- success → 302, `location` equals `"/auth/signin?success=1"`

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 with all five Phase 1 test files passing (four auth test files + the helper)
- `npm run lint` passes with no new errors

**After completing this phase, pause for manual confirmation before proceeding to Phase 2.**

---

## Phase 2: Enemy Confirm and Delete Integration Tests (Risk #4)

### Overview

Write integration tests for the PATCH confirm and DELETE paths in `enemies/[id].ts`. The key assertion: every DB outcome (error, not-found, success) is handled distinctly — the route cannot silently report 200 when the update failed.

### Changes Required

#### 1. tests/integration/api/enemies-id.test.ts

**File**: `tests/integration/api/enemies-id.test.ts`

**Intent**: Integration tests for `enemies/[id].ts` PATCH confirm path and DELETE. Uses `makeSupabaseMock` from the existing helper (the `enemies` table key).

**Contract**:
- `vi.mock('@/lib/supabase', () => ({ createClient: vi.fn() }))`
- `makeContext(options?)` sets `params: { id: "e-1" }`, a PATCH request with no `Content-Type: application/json` header (selects the confirm path), and `locals.user`

**`PATCH /api/enemies/[id]` (confirm path) describe:**
- null supabase → 500
- null user → 401
- Supabase error → 500 (`enemies` table: `{ data: null, error: { message: "DB error" } }`)
- Not-found (PGRST116) → 404 (`enemies` table: `{ data: null, error: { code: "PGRST116", message: "No rows" } }`)
- Success → 200 with `{ enemy: <object> }` (`enemies` table: `{ data: { id: "e-1", status: "confirmed" }, error: null }`)

**`DELETE /api/enemies/[id]` describe:**
- null supabase → 500
- null user → 401
- Supabase error → 500 (`enemies` table: `{ data: null, error: { message: "DB error" } }`)
- No row deleted → 404 (`enemies` table: `{ data: [], error: null }`) — note: array, not PGRST116
- Success → 200 `{ success: true }` (`enemies` table: `{ data: [{ id: "e-1" }], error: null }`)

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 with all enemy confirm/delete tests passing
- `npm run lint` passes

**After completing this phase, pause for manual confirmation before proceeding to Phase 3.**

---

## Phase 3: Cookbook Update and Close-Out

### Overview

Fill §6.3 in `test-plan.md` with the auth test pattern this phase delivered. Advance Phase 2 status to `complete`. No production code changes.

### Changes Required

#### 1. context/foundation/test-plan.md — §6.3 auth flow integration test pattern

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.3 "TBD" placeholder with the auth test pattern established in Phase 1.

**Contract**:
- Location: `tests/integration/api/auth-*.test.ts`
- Auth mock: use `makeAuthClientMock()` from `tests/helpers/auth.ts` for `supabase.auth.*` methods; use `makeSupabaseMock()` from `tests/helpers/supabase.ts` for `supabase.from()` routes — they cover different call surfaces
- Redirect assertion pattern: `expect(res.status).toBe(302)` + `expect(res.headers.get("location"))`. Use `toBe()` for stable destination paths (e.g. `"/auth/reset-password"`); use `toContain()` for error query params (e.g. `toContain("error=")`)
- Context stub: every auth route `makeContext()` must include `redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } })`; POST routes must build a real URL-encoded Request with `Content-Type: application/x-www-form-urlencoded`
- Key coverage rule: always test (a) null client → error redirect (not success), and (b) for callback specifically: `next=https://external.com` → redirects to `"/"`
- Reference test: `tests/integration/api/auth-callback.test.ts`

#### 2. context/foundation/test-plan.md — §3 Phase 2 status

**File**: `context/foundation/test-plan.md`

**Intent**: Advance Phase 2 rollout status to `complete`.

**Contract**: Change the Phase 2 row Status cell from `change opened` to `complete`. Update the "Last updated" header to `2026-06-05`.

#### 3. context/changes/testing-auth-flow-integrity/change.md

**File**: `context/changes/testing-auth-flow-integrity/change.md`

**Intent**: Mark the change complete.

**Contract**: `status: complete`, `updated: 2026-06-05`.

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 — full suite, no regressions from cookbook edits

#### Manual Verification

- `context/foundation/test-plan.md` §6.3 contains the auth test pattern (not "TBD")
- §3 Phase 2 row shows `complete`

---

## Testing Strategy

### Integration Tests

- `tests/integration/api/auth-callback.test.ts` — callback GET: open-redirect protection, null client, exchange error, success
- `tests/integration/api/auth-recovery-callback.test.ts` — recovery-callback GET: null client, exchange error, success
- `tests/integration/api/auth-forgot-password.test.ts` — forgot-password POST: null client, 429, ≥500 error, success, intentional email-enumeration-safe path
- `tests/integration/api/auth-reset-password.test.ts` — reset-password POST: null client, unauthenticated, validation errors, update error, success
- `tests/integration/api/enemies-id.test.ts` — PATCH confirm + DELETE: null client, unauthorized, DB error, not-found, success

### Manual Testing Steps

1. After Phase 1: run `npm run test` from a clean state; confirm all auth tests pass
2. After Phase 2: run `npm run test`; confirm enemies-id tests pass alongside the auth suite
3. After Phase 3: inspect `test-plan.md` §6.3 and §3 visually

## References

- Test plan Phase 2 risks: `context/foundation/test-plan.md` §2 (#2, #4)
- Existing auth routes: `src/pages/api/auth/`
- Reference correct pattern: `src/pages/api/enemies/[id].ts` (PATCH / DELETE reference for the enemies-id helper)
- Existing integration test pattern: `tests/integration/api/battles.test.ts`
- Existing mock helper: `tests/helpers/supabase.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Auth Route Integration Tests (Risk #2)

#### Automated

- [x] 1.1 `npm run test` exits 0 with all five Phase 1 test files passing — 4eabd8a
- [x] 1.2 `npm run lint` passes with no new errors from Phase 1 files — 4eabd8a

### Phase 2: Enemy Confirm and Delete Integration Tests (Risk #4)

#### Automated

- [x] 2.1 `npm run test` exits 0 with all enemy confirm/delete tests passing — 7686966
- [x] 2.2 `npm run lint` passes with no new errors from Phase 2 files — 7686966

### Phase 3: Cookbook Update and Close-Out

#### Automated

- [x] 3.1 `npm run test` exits 0 — full suite, no regressions from cookbook edits

#### Manual

- [x] 3.2 `context/foundation/test-plan.md` §6.3 contains the auth test pattern (not "TBD")
- [x] 3.3 §3 Phase 2 row shows `complete`
