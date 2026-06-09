# Ownership Boundary — Plan Brief

> Full plan: `context/changes/ownership-boundary/plan.md`

## What & Why

Phase 3 of the test rollout: prove that API routes reject cross-user resource access and that error responses contain only safe messages (Risks #5 and #6). Two routes (`enemies/[id].ts` and `generate.ts`) have no app-level ownership check — they rely entirely on RLS, which mock-based tests cannot enforce — so small production code changes are required before IDOR tests can be written. The auth routes `signin.ts` and `signup.ts` were found to forward raw Supabase `error.message` strings in redirect URLs, which Risk #6 directly targets.

## Starting Point

All S-03/S-05 routes (campaigns, enemies) already return sanitized error messages. `campaigns/[id].ts` and `battles.ts` already have app-level user-scope filters; their IDOR tests are just missing explicit labels. `enemies/[id].ts` and `generate.ts` have RLS-only guards — ownership checks must be added at the app layer before IDOR tests are meaningful.

## Desired End State

Every route with a user-scoped resource has a labelled IDOR test asserting 404 on cross-user access. `signin.ts` and `signup.ts` redirect with generic safe messages. `test-plan.md` §6.4 documents the IDOR test pattern. Phase 3 of the test rollout is marked complete.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| RLS-only routes | Add app-level ownership checks + test them | RLS is a single point of failure; mock tests cannot enforce it | Plan |
| Error safety scope | Fix signin/signup + test all affected routes | The actual exposure is in old auth routes, not S-03/S-05 (which are already safe) | Plan |
| Close-out | Folded into this change (Phase 4) | Keeps test-plan in sync; mirrors the pattern from testing-auth-flow-integrity | Plan |
| IDOR mock pattern | No real second user — configure mock to return no matching row | Consistent with integration test approach; app-level check produces the 404 | Plan |

## Scope

**In scope:**
- App-level ownership check for `enemies/[id].ts` PATCH/DELETE
- App-level ownership check for `generate.ts` POST
- Sanitize raw `error.message` in `signin.ts` and `signup.ts`
- IDOR test cases for all ownership-guarded routes
- Error safety regression tests for signin/signup
- test-plan §6.4 and Phase 3 close-out

**Out of scope:**
- `battles.ts` POST IDOR test (redirect-based flow; ownership check already present)
- `campaigns/index.ts` GET/POST (no resource ID to guess)
- Rate-limit branching in signin/signup
- RLS policy changes
- E2E tests

## Architecture / Approach

Ownership check for enemies follows the `battles/[id]/index.ts` pattern — two upstream queries (campaigns → battles) before the enemy operation, with `.in("battle_id", battleIds)` added to the query. The generate route adds `campaign_id` to its battle SELECT then does a single campaign ownership verify (same as `battles.ts` POST). Both approaches are mock-compatible: the mock is keyed by table name, so each upstream query gets its own configured result.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Production code | Ownership guards for enemies + generate; auth error sanitization | Phase 1 breaks existing test mocks — expected, fixed in Phase 2 |
| 2. IDOR tests | Existing tests updated + labelled IDOR cases for all guarded routes | Mock data shape mismatch (PGRST116 vs empty array varies by route) |
| 3. Error safety tests | New auth-signin + auth-signup test files | Auth routes use `context.redirect()` — must follow auth test pattern from Phase 2 rollout |
| 4. Close-out | §6.4 IDOR pattern + Phase 3 status complete + change.md | None |

**Prerequisites:** None — all production features are already implemented  
**Estimated effort:** ~2 sessions across 4 phases

## Open Risks & Assumptions

- `makeSupabaseMock` returns the same result for every call to `.from("tableName")`. The PATCH stats-update path calls `from("enemies")` twice (ownership pre-check + the update). Both return the same mock data. Tests rely on the route returning 404 before the second call (in the IDOR case) or succeeding on the second call (happy path).

## Success Criteria (Summary)

- `npm run test` exits 0 with IDOR cases passing for all six ownership-guarded routes
- Error redirects for signin and signup contain safe messages confirmed by both test and manual check
- `test-plan.md` §6.4 filled; Phase 3 status = `complete`
