# Testing Auth Flow Integrity — Plan Brief

> Full plan: `context/changes/testing-auth-flow-integrity/plan.md`

## What & Why

Add integration tests covering two Phase 2 risks: Risk #2 (auth callback open-redirect and null-client regression guards) and Risk #4 (enemy confirm route error-handling contracts). All protections are already in production code; these tests ensure they can't be silently removed in a future refactor.

## Starting Point

No integration tests exist for any auth route (`callback`, `recovery-callback`, `forgot-password`, `reset-password`) or the `enemies/[id]` route. The existing test suite covers battles, campaigns, and enemies generation — auth and enemy confirm/delete are uncovered gaps.

## Desired End State

Six new test files pass as part of `npm run test`. The open-redirect test — asserting that `next=https://evil.com` produces `location === "/"` — is the living regression guard for Risk #2. Every auth route has null-client, error, and success cases documented as code.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Auth mock location | `tests/helpers/auth.ts` (shared) | Matches existing convention for `makeSupabaseMock`; avoids duplication across 4 files | Plan |
| Redirect assertion | Exact for stable paths, `toContain` for error params | Tight where the destination is fixed; flexible for error message wording | Plan |
| Risk #4 scope | Confirm PATCH + DELETE | Completes route coverage without adding the stats-update PATCH (different feature) | Plan |
| File grouping | 4 separate auth files + 1 enemies file | Matches one-file-per-route convention from existing tests | Plan |
| Risk #4 persistence caveat | Noted in plan | Mock-based tests can't prove DB persistence; flagging prevents false confidence | Plan |

## Scope

**In scope:**
- `tests/helpers/auth.ts` — new shared auth mock factory
- `tests/integration/api/auth-callback.test.ts` — open-redirect + null client
- `tests/integration/api/auth-recovery-callback.test.ts` — null client + exchange error
- `tests/integration/api/auth-forgot-password.test.ts` — null client + rate-limit + server-error
- `tests/integration/api/auth-reset-password.test.ts` — null client + validation + update error
- `tests/integration/api/enemies-id.test.ts` — PATCH confirm + DELETE
- `context/foundation/test-plan.md` §6.3 cookbook fill-in

**Out of scope:**
- Stats-update PATCH path in `enemies/[id].ts`
- Real-DB persistence test for Risk #4
- Auth E2E (email-link flow requires live Supabase)
- Signup / signin / signout tests
- CI wiring (Phase 4)

## Architecture / Approach

All tests follow the established vitest integration pattern: `vi.mock('@/lib/supabase')`, a per-file `makeContext()` helper, direct handler invocation. Auth routes differ in one key way from the existing tests: they return `context.redirect()` instead of `Response.json()`, so `makeContext()` must include a `redirect` mock that returns a real Response, and assertions check `res.headers.get("location")` rather than `res.json()`. A new `makeAuthClientMock()` factory handles `supabase.auth.*` methods which the existing `makeSupabaseMock` doesn't cover.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Auth route tests | 4 test files + auth helper; open-redirect + null-client guards for Risk #2 | `context.redirect()` mock and POST form-body pattern must be wired correctly |
| 2. Enemy confirm/delete tests | `enemies-id.test.ts`; error-handling contracts for Risk #4 | PGRST116 vs empty-array not-found distinction; correct PATCH branch selection |
| 3. Cookbook close-out | §6.3 filled, Phase 2 status advanced to `complete` | No regressions in full test suite |

**Prerequisites:** Phase 1 of the rollout (`testing-critical-path-bootstrap`) is complete — vitest, `makeSupabaseMock`, and the integration test pattern are all in place.  
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Risk #4 persistence is not fully covered: mock-based tests prove error contracts but not that a write hit the real DB. The route's `.select().single()` chain prevents silent false-positives, but a live-Supabase integration test would give stronger assurance.
- `forgot-password.ts` intentionally falls through to success for non-429/non-500 Supabase errors (email enumeration prevention). This is documented in the plan and tested explicitly.

## Success Criteria (Summary)

- `npm run test` exits 0 with all new files; `npm run lint` clean
- `next=https://evil.com` case in auth-callback test asserts `location === "/"`
- `test-plan.md` §6.3 contains the auth test pattern; Phase 2 status reads `complete`
