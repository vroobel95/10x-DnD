# Test Runner Bootstrap and Critical-Path Contracts — Plan Brief

> Full plan: `context/changes/testing-critical-path-bootstrap/plan.md`
> Research: `context/changes/testing-critical-path-bootstrap/research.md`

## What & Why

Bootstrap vitest and write the first round of unit and integration tests for the three highest-priority Phase 1 risks: illegal D&D 5e stat blocks reaching the table (Risk #1), API routes silently swallowing Supabase errors and returning 200 (Risk #3), and AI generation failures not surfacing a clear error to the GM (Risk #7). One confirmed bug is fixed as part of this change.

## Starting Point

No test runner, no test scripts, no test files. `package.json` has zero test-related entries. Five route handlers have a shared bug class (missing `error` check before `!data` check); one of them is a confirmed bug — the battles list GET silently returns `200 []` when Supabase errors.

## Desired End State

`npm run test` exits 0 with a passing suite covering schema boundary values, all five affected route handlers (confirmed bug fix + four RISK-pattern fixes), and the AI generation failure branch. Future contributors can add tests by following the §6 cookbook patterns now filled in `context/foundation/test-plan.md`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Test runner version | `vitest@^4` RC | `package.json` overrides `vite@^7.3.2`; vitest 3.x targets Vite 5/6 and is incompatible | Research |
| Test environment | `node` (not `@cloudflare/vitest-pool-workers`) | Handlers use only Web APIs; no KV/D1/Durable Objects under test; Supabase and Anthropic will be mocked | Research |
| `astro:env/server` blocker | Global stub in `tests/setup.ts` | Both `src/lib/supabase.ts` and `src/lib/ai.ts` import this Astro virtual module; any test that transitively imports them fails without the stub | Research |
| Supabase mock strategy | Per-table chainable builder factory | Multi-query handlers (battles GET queries `campaigns` then `battles`) need table-scoped results; `vi.mock('@/lib/supabase')` at module boundary, factory in `tests/helpers/supabase.ts` | Research |
| Integration test entry point | Call exported handler functions directly | Route handlers are plain `async (context) => Response` functions; no test server needed | Plan |
| RISK route treatment | Fix all four in Phase 3 alongside tests | Each fix is 2–3 lines (add `if (error) → 500` before `!data` check); test + fix together is the clean pattern | Plan |
| Null client coverage | Include in Phase 1 integration tests | `createClient` returning null is a recorded burn pattern (`lessons.md`); trivial to add one mock call per test file | Plan |

## Scope

**In scope:**
- vitest@^4 bootstrap (config, setup, helpers, npm scripts)
- Schema unit tests — boundary values for all `EnemySchema` constrained fields
- Integration tests for 4 route files (battles GET, battle DELETE, campaign PATCH/DELETE, generate POST)
- Fix 5 route handlers (confirmed bug + 4 RISK-pattern routes)
- §6.1 and §6.2 cookbook entries in `context/foundation/test-plan.md`

**Out of scope:**
- E2E tests / Playwright
- Auth callback / password reset tests (Phase 2)
- IDOR / ownership boundary tests (Phase 3)
- GitHub Actions CI wiring (Phase 4)

## Architecture / Approach

Integration tests import the route handler's named export (e.g. `import { GET } from '../../../src/pages/api/battles'`), construct a minimal `APIContext` stub (only the fields the handler reads: `request`, `cookies`, `locals`, `params`, `url`), and call the handler directly. Supabase is mocked at module boundary via `vi.mock('@/lib/supabase')`. The per-table builder factory in `tests/helpers/supabase.ts` lets each test declare exactly what each table query returns, handling both single-query and multi-query handlers uniformly.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Vitest Bootstrap | Config, setup stub, mock factory, npm scripts — `vitest run --passWithNoTests` exits 0 | `astro:env/server` stub shape must match all three env vars consumed by `src/lib/` |
| 2. Schema Unit Tests | Boundary-value regression guards for `EnemySchema` | Oracle drift: must test against D&D 5e PRD rules, not against schema implementation |
| 3. Mutation Route Fixes + Tests | Bug fix (battles GET) + 4 RISK fixes + integration tests for all 5 affected routes | Route fix introduces type error — verify with `npx astro check` |
| 4. Generate Route Tests | Risk #7 regression guards — AI throw → 500 + safe message + no DB write | Mock call-count assertion for "no DB write" is the hardest assertion to get right |
| 5. Cookbook + Close-Out | §6.1, §6.2 patterns written; Phase 1 status → `complete` | None — no code changes |

**Prerequisites:** Node.js + npm available; repo on `main` branch.
**Estimated effort:** 2–3 working sessions across 5 phases.

## Open Risks & Assumptions

- `vitest@^4` is RC; API surface is stable but edge cases may exist — test infrastructure is lower risk than production for an RC adoption
- The `makeSupabaseMock` builder factory must correctly handle both `await chain` (thenable) and `await chain.single()` (returns `this`, then `this.then()`) — this is the trickiest part of Phase 1 and should be verified with a trivial test before writing all integration tests

## Success Criteria (Summary)

- `npm run test` exits 0 with unit + integration suite passing
- Every route that previously ignored Supabase errors now returns 500 (not 200) when the DB fails — verified by failing tests that pass after the fix
- §6.1 and §6.2 in `context/foundation/test-plan.md` contain concrete patterns for future contributors
