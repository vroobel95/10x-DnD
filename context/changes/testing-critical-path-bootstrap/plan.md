# Test Runner Bootstrap and Critical-Path Contracts — Implementation Plan

## Overview

Bootstrap vitest and ship the first suite of unit and integration tests covering three Phase 1 risks: (1) AI stat validation rejects illegal D&D 5e values, (3) mutation and GET routes distinguish Supabase error from not-found from success, and (7) AI generation failure returns a clean 500 with a safe user message.

One confirmed bug is fixed as part of this change: `src/pages/api/battles.ts` GET silently swallows a Supabase error and returns `200 []`.

## Current State Analysis

No test runner, no test files. Zero entries under `tests/`. `package.json` has no `test` script.

**Stack constraints that shape the setup:**
- `vite@^7.3.2` override in `package.json:61` requires `vitest@^4` (the Vite 7-compatible RC).
- `src/lib/supabase.ts:3` and `src/lib/ai.ts:3` import `astro:env/server`, a build-time virtual module that does not exist outside Astro's Vite pipeline. Every test that transitively imports these modules will fail unless the module is stubbed globally before tests run.
- `tsconfig.json` defines `"@/*": ["./src/*"]`. Vitest does not read tsconfig path aliases by default — requires the `vite-tsconfig-paths` plugin.
- Route handlers (`export const GET: APIRoute = async (context) => ...`) are plain async functions that take `APIContext` and return `Response`. Integration tests call them directly — no test server needed.

**Confirmed bug:**
- `src/pages/api/battles.ts` GET (~line 113): `const { data: battles } = await supabase...` — error is destructured away. Returns `200 []` when Supabase errors.

**RISK-pattern routes (not confirmed bugs, but missing the error check):**
- `src/pages/api/battles/[id]/index.ts` DELETE (~line 26): no `error` check before `!data`
- `src/pages/api/campaigns/[id].ts` PATCH (~line 39): no `error` check before `!campaign`
- `src/pages/api/campaigns/[id].ts` DELETE (~line 67): no `error` check before `!data`
- `src/pages/api/battles/[id]/generate.ts` battle-lookup (~line 34): no `error` check before `!battle`

**Reference correct pattern:** `src/pages/api/enemies/[id].ts:46–51` — checks `result.error → 500` before `!result.data → 404`.

**Mocking surface:**
- Supabase: `vi.mock('@/lib/supabase', () => ({ createClient: vi.fn() }))` — mock at module boundary
- AI generation: `vi.mock('@/lib/ai', () => ({ generateEnemies: vi.fn() }))` — mock at module boundary
- `astro:env/server`: global stub in `tests/setup.ts` (must load before any test imports `src/lib/`)

## Desired End State

`npm run test` runs and exits 0. Test output shows:
- Unit tests: all schema boundary-value assertions pass
- Integration tests: all route contract tests pass (error → 500, not-found → 404, success → 200, null client → 500, unauthorized → 401)
- All five RISK/BUG routes are fixed and covered by integration tests

### Key Discoveries

- `astro:env/server` must be stubbed in `tests/setup.ts` before any test can import `src/lib/supabase` or `src/lib/ai`
- Route handlers are pure `async (context) => Response` functions — call them directly in integration tests; no test server needed
- `battles.ts` GET makes two sequential Supabase queries to different tables (`campaigns`, then `battles`) — the per-table mock factory handles this cleanly
- `battles/[id]/index.ts` DELETE queries `campaigns` first (ownership check), then `battles` (delete) — also handled by per-table mock
- `campaigns/[id].ts` handlers query only `campaigns` — single-table mock per test

## What We're NOT Doing

- No E2E tests (no Playwright; deferred per §7 of the test plan)
- No auth flow tests (Phase 2)
- No IDOR / ownership boundary tests (Phase 3)
- No GitHub Actions CI wiring (Phase 4)
- No tests for Supabase SDK internals — mock at module boundary
- No structural/shape tests for Zod schemas — only range constraints and business rules

## Implementation Approach

Bottom-up: infrastructure first, then the cheapest tests (unit schema boundary values), then integration tests ordered by confirmed-bug priority (battles GET bug → RISK-pattern mutation routes → generate route). Each phase leaves a passing test suite that the next phase extends.

## Critical Implementation Details

**`astro:env/server` stub shape.** The stub must export all three env vars consumed by `src/lib/supabase.ts` and `src/lib/ai.ts`:

```typescript
vi.mock('astro:env/server', () => ({
  SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_KEY: 'mock-supabase-key',
  ANTHROPIC_API_KEY: 'mock-anthropic-key',
}));
```

Values must be non-empty strings so that `createClient` does not return `null` from its env guard — individual tests control null-client behavior by mocking `createClient` itself.

**Per-table Supabase mock factory contract.** The factory in `tests/helpers/supabase.ts` accepts `Record<string, { data: unknown; error: unknown }>` keyed by table name. Each table gets its own chainable builder where every intermediate method (`.select`, `.eq`, `.in`, `.order`, `.delete`, `.update`, `.insert`, `.single`) returns `this`, and the object is thenable (has `.then(resolve)`) so that `await chain`, `await chain.single()`, and `await chain.order(...)` all resolve to the configured `{ data, error }` for that table. This handles multi-query handlers such as battles GET (queries `campaigns` then `battles`).

**`APIContext` minimal stub fields.** Route handlers use only these fields: `request` (native `Request`), `cookies` (object with `set(name, value, options?)` method), `locals` (`{ user: { id: string } | null }`), `params` (`{ id?: string }`), `url` (`URL`). Cast the stub `as APIContext` for TypeScript. Define a `makeContext(overrides?)` helper per test file — the full `APIContext` type has many optional fields; `as unknown as APIContext` avoids satisfying the complete interface.

---

## Phase 1: Vitest Bootstrap

### Overview

Install the test runner and all supporting infrastructure. No test files yet — goal is `vitest run --passWithNoTests` exits 0 with the setup file loading cleanly.

### Changes Required

#### 1. Test runner packages

**Intent**: Install vitest@^4 (Vite 7-compatible RC), vite-tsconfig-paths (resolves `@/*` aliases from `tsconfig.json`), and `@vitest/coverage-v8` (coverage support) as dev dependencies.

**Contract**: Run `npm install -D vitest@^4 vite-tsconfig-paths @vitest/coverage-v8`. All three appear in `package.json` `devDependencies` after install.

#### 2. vitest.config.ts

**File**: `vitest.config.ts` (repo root)

**Intent**: Configure vitest with node environment, tsconfigPaths plugin, global test APIs, the setup file, and the test include pattern.

**Contract**: `environment: 'node'`, `globals: true`, `include: ['tests/**/*.test.ts']`, `setupFiles: ['tests/setup.ts']`, `plugins: [tsconfigPaths()]`. Import from `vitest/config` (not `vite` directly) so the config stays within the vitest peer resolution.

#### 3. tests/setup.ts

**File**: `tests/setup.ts`

**Intent**: Stub `astro:env/server` globally so any test file that imports `src/lib/supabase` or `src/lib/ai` can resolve the virtual module. Must run before any test file import — configured via `setupFiles`.

**Contract**: One `vi.mock('astro:env/server', () => ({ ... }))` call exporting non-empty `SUPABASE_URL`, `SUPABASE_KEY`, and `ANTHROPIC_API_KEY` strings. See Critical Implementation Details above for exact shape.

#### 4. tests/helpers/supabase.ts

**File**: `tests/helpers/supabase.ts`

**Intent**: Factory that creates a typed partial Supabase mock client keyed by table name, so integration tests configure per-query results without re-declaring the chainable mock in every file.

**Contract**: Exported function `makeSupabaseMock(tableResults: Record<string, { data: unknown; error: unknown }>)`. Returns `{ from: vi.fn() }` where `from(table)` returns a builder object. The builder: all intermediate methods return `this`; the object has `then(resolve)` calling `Promise.resolve(tableResults[table] ?? { data: null, error: null }).then(resolve)`. See Critical Implementation Details for the rationale.

#### 5. package.json test scripts

**File**: `package.json`

**Intent**: Add test commands so the three vitest modes are invocable via npm.

**Contract**: Add to `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`.

### Success Criteria

#### Automated Verification

- `npm run test -- --passWithNoTests` exits 0 (config loads, `astro:env/server` stub resolves, no import errors in setup)
- `npm run lint` passes (no new errors from config files)

**After completing this phase, pause for manual confirmation before proceeding to Phase 2.**

---

## Phase 2: Schema Unit Tests (Risk #1)

### Overview

Write boundary-value unit tests directly against `EnemySchema`. Oracle is the D&D 5e PRD guardrail (ability scores 1–30, HP ≥ 1, AC ≥ 1 per current schema — stricter than PRD's ≥ 0, intentionally).

### Changes Required

#### 1. tests/unit/lib/schemas/enemy.test.ts

**File**: `tests/unit/lib/schemas/enemy.test.ts`

**Intent**: Parse a minimal valid enemy baseline, then test each constrained field at its lower and upper boundary. Tests are regression guards — they document what the schema currently enforces. Oracle is the D&D 5e PRD, not the schema implementation.

**Contract**: Use `EnemySchema.safeParse(...)` against a valid baseline fixture, then assert `success: true` or `success: false` for each variant:

- Valid baseline (all fields in range) → `success: true`
- `str: 0` → `success: false`
- `str: 31` → `success: false`
- `str: 1` → `success: true`
- `str: 30` → `success: true`
- `hp: 0` → `success: false`
- `hp: 1` → `success: true`
- `ac: 0` → `success: false` (schema enforces `min(1)`; test documents that AC=0 is rejected even though PRD says ≥ 0 — this is a stricter guard, not a bug)
- `ac: 1` → `success: true`
- `cr: ""` → `success: false`
- `cr: "1/8"` → `success: true`
- `name: ""` → `success: false`
- `abilities` array with 11 items → `success: false` (max is 10)
- `EnemyGroupSchema` with `enemies: []` → `success: false` (min is 1)

The `dex`, `con`, `int`, `wis`, `cha` fields share the same constraint as `str` — it is sufficient to test the shared constraint once via `str`; add spot-checks for any one of the remaining stats to confirm the constraint is applied consistently.

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 with all schema tests passing

**After completing this phase, pause for manual confirmation before proceeding to Phase 3.**

---

## Phase 3: Mutation Route Fixes and Integration Tests (Risk #3)

### Overview

Fix the confirmed bug and all four RISK-pattern routes. Write integration tests for each affected route handler covering: Supabase error → 500, no-row → 404, null client → 500, unauthorized → 401, and happy path → 200.

### Changes Required

#### 1. Fix battles.ts GET (confirmed bug)

**File**: `src/pages/api/battles.ts`

**Intent**: Add an error check on the battles SELECT before returning. Without it, a Supabase error silently returns `200 []`.

**Contract**: Destructure `error` alongside `data: battles` from the battles SELECT (currently only `data` is destructured). Immediately after the query, add: `if (error) return Response.json({ error: "Could not load battles. Please try again." }, { status: 500 })`. Place this before the existing `return Response.json({ battles: battles ?? [] })`.

#### 2. Fix battles/[id]/index.ts DELETE (RISK route)

**File**: `src/pages/api/battles/[id]/index.ts`

**Intent**: Add an error check on the battle DELETE query result before checking `!data`. Follows the reference pattern from `enemies/[id].ts:46–51`.

**Contract**: Destructure both `data` and `error` from the DELETE result. Check `if (error) return Response.json({ error: "Could not delete battle. Please try again." }, { status: 500 })` before the existing `if (!data) → 404` check.

#### 3. Fix campaigns/[id].ts PATCH (RISK route)

**File**: `src/pages/api/campaigns/[id].ts`

**Intent**: Add an error check on the campaign UPDATE result before checking `!campaign`.

**Contract**: Destructure `error` alongside `data: campaign` from the PATCH result (currently only `data` is destructured via a cast). Check `if (error) return Response.json({ error: "Could not update campaign. Please try again." }, { status: 500 })` before the existing `if (!campaign) → 404` check.

#### 4. Fix campaigns/[id].ts DELETE (RISK route)

**File**: `src/pages/api/campaigns/[id].ts`

**Intent**: Add an error check on the campaign DELETE result before checking `!data`.

**Contract**: Destructure `error` alongside `data` from the DELETE result. Check `if (error) return Response.json({ error: "Could not delete campaign. Please try again." }, { status: 500 })` before the existing `if (!data) → 404` check.

#### 5. Fix battles/[id]/generate.ts battle-lookup (RISK route)

**File**: `src/pages/api/battles/[id]/generate.ts`

**Intent**: Add an error check on the battle SELECT result before checking `!battle`. Currently checks `battleResult.data` immediately after the query without checking `battleResult.error`.

**Contract**: After `const battleResult = await supabase.from("battles")...single()`, add: `if (battleResult.error) return Response.json({ error: "Could not load battle. Please try again." }, { status: 500 })`. Then the existing `if (!battleResult.data) → 404` check. Move `const battle = battleResult.data` to after both guards.

#### 6. tests/integration/api/battles.test.ts

**File**: `tests/integration/api/battles.test.ts`

**Intent**: Integration tests for the `battles.ts` GET handler, calling `GET(context)` directly with `createClient` mocked at module boundary.

**Contract**:
- `vi.mock('@/lib/supabase', () => ({ createClient: vi.fn() }))`
- null client → 500
- `locals.user = null` → 401
- missing `campaignId` in URL → 400
- campaign ownership check returns `{ data: null, error: null }` → 404
- battles SELECT returns `{ data: null, error: { message: "..." } }` → 500 (proves the bug is fixed)
- happy path (campaign found, battles array returned) → 200 with `{ battles: [...] }`

#### 7. tests/integration/api/battles-id.test.ts

**File**: `tests/integration/api/battles-id.test.ts`

**Intent**: Integration tests for the `battles/[id]/index.ts` DELETE handler.

**Contract**:
- null client → 500
- unauthorized → 401
- campaigns SELECT returns error or empty → 404
- battle DELETE returns `{ data: null, error: { message: "..." } }` → 500 (proves the RISK fix)
- battle DELETE returns `{ data: null, error: null }` → 404
- battle DELETE returns `{ data: { id: '...', campaign_id: '...' }, error: null }` → 200 `{ success: true }`

#### 8. tests/integration/api/campaigns-id.test.ts

**File**: `tests/integration/api/campaigns-id.test.ts`

**Intent**: Integration tests for the `campaigns/[id].ts` PATCH and DELETE handlers. Two `describe` blocks — one per method.

**Contract for PATCH**:
- null client → 500
- unauthorized → 401
- missing or empty `name` in body → 400
- campaign UPDATE returns `{ data: null, error: { message: "..." } }` → 500 (proves the RISK fix)
- campaign UPDATE returns `{ data: null, error: null }` → 404
- campaign UPDATE returns `{ data: { ... }, error: null }` → 200 with `{ campaign }`

**Contract for DELETE**:
- null client → 500
- unauthorized → 401
- campaign DELETE returns `{ data: null, error: { message: "..." } }` → 500 (proves the RISK fix)
- campaign DELETE returns `{ data: null, error: null }` → 404
- campaign DELETE returns `{ data: { id: '...' }, error: null }` → 200 `{ success: true }`

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 with all mutation route tests passing
- `npm run lint` passes (no new lint errors from route fixes)
- `npx astro check` (or `npx tsc --noEmit`) passes — route fixes introduce no type errors

#### Manual Verification

- In the running dev server, navigate to a campaign's battle list and confirm it loads correctly — smoke test that the battles GET fix does not regress the happy path

**After completing this phase, pause for manual confirmation before proceeding to Phase 4.**

---

## Phase 4: Generate Route Integration Tests (Risk #7)

### Overview

Write integration tests for the `battles/[id]/generate.ts` POST handler. Key assertions: AI failure returns 500 with the safe user message, and no DB write occurs when the AI call throws.

### Changes Required

#### 1. tests/integration/api/battles-generate.test.ts

**File**: `tests/integration/api/battles-generate.test.ts`

**Intent**: Integration tests for the generate handler. Mock both `createClient` and `generateEnemies` at module boundary. The critical assertion for Risk #7: when `generateEnemies` throws, the route returns exactly 500 + `{ error: "Generation failed. Please try again." }` AND does not call the enemies insert.

**Contract**:
- `vi.mock('@/lib/supabase', () => ({ createClient: vi.fn() }))`
- `vi.mock('@/lib/ai', () => ({ generateEnemies: vi.fn() }))`
- null client → 500
- unauthorized → 401
- missing or empty prompt → 400
- prompt longer than 2000 characters → 400
- battle not found (SELECT returns `{ data: null, error: null }`) → 404
- battle SELECT returns `{ data: null, error: { message: "..." } }` → 500 (proves the generate battle-lookup RISK fix)
- `generateEnemies` throws → 500 with body `{ error: "Generation failed. Please try again." }`
- `generateEnemies` throws → `supabase.from` was never called with `'enemies'` (assert zero calls to the enemies insert mock)
- enemies insert returns error → 500 with `{ error: "Could not save enemies. Please try again." }`
- happy path (battle found, AI returns valid enemy group, insert succeeds) → 200 with `{ enemies: [...] }`

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 with all generate route tests passing, including the AI-throw → no-DB-write assertion

**After completing this phase, pause for manual confirmation before proceeding to Phase 5.**

---

## Phase 5: Cookbook Update and Status Close-Out

### Overview

Fill §6.1 and §6.2 of `context/foundation/test-plan.md` with the concrete patterns this phase delivered. Advance Phase 1 status in §3 to `complete`. No production code changes in this phase.

### Changes Required

#### 1. context/foundation/test-plan.md — §6.1 unit test pattern

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.1 "TBD" placeholder with the unit test pattern established by Phase 2.

**Contract**:
- Location: `tests/unit/` mirroring `src/` structure
- Naming: `*.test.ts`
- Run locally: `npm run test`
- Reference test: `tests/unit/lib/schemas/enemy.test.ts`
- Oracle rule: assert against D&D 5e PRD guardrails, not against the schema implementation — prevents oracle-from-implementation anti-pattern

#### 2. context/foundation/test-plan.md — §6.2 integration test pattern

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.2 "TBD" placeholder with the integration test pattern established by Phases 3–4.

**Contract**:
- Location: `tests/integration/api/`
- Mocking policy: mock `@/lib/supabase` and `@/lib/ai` at module boundary via `vi.mock`; use `makeSupabaseMock` from `tests/helpers/supabase.ts` for the per-table chainable builder; never mock Supabase query internals individually
- Context stub: construct `APIContext` inline per test with only the fields the handler actually reads; cast as `unknown as APIContext`
- Coverage rule: cover error → 500, not-found → 404, null client → 500, unauthorized → 401, and happy path → 200 for every route under test
- Reference test: `tests/integration/api/battles.test.ts`
- Run locally: `npm run test`

#### 3. context/foundation/test-plan.md — §3 Phase 1 status

**File**: `context/foundation/test-plan.md`

**Intent**: Advance Phase 1 status to `complete` and bump the "Last updated" header.

**Contract**: Change the Status cell in the Phase 1 row from `researched` to `complete`. Update "Last updated" in the file header to `2026-06-04`.

#### 4. context/changes/testing-critical-path-bootstrap/change.md

**File**: `context/changes/testing-critical-path-bootstrap/change.md`

**Intent**: Mark the change complete.

**Contract**: Set `status: complete` and `updated: 2026-06-04`.

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 (full suite — confirms cookbook edits introduced no regressions)

#### Manual Verification

- `context/foundation/test-plan.md` §6.1 and §6.2 contain concrete patterns, not "TBD"
- §3 Phase 1 row shows `complete`

---

## Testing Strategy

### Unit Tests

- `tests/unit/lib/schemas/enemy.test.ts` — boundary values for all constrained `EnemySchema` fields and `EnemyGroupSchema` group-level constraints

### Integration Tests

- `tests/integration/api/battles.test.ts` — battles GET: Supabase error / not-found / null client / unauthorized / happy path
- `tests/integration/api/battles-id.test.ts` — battle DELETE: Supabase error / not-found / null client / unauthorized / happy path
- `tests/integration/api/campaigns-id.test.ts` — campaign PATCH and DELETE: Supabase error / not-found / null client / unauthorized / happy path
- `tests/integration/api/battles-generate.test.ts` — generate POST: AI throw / no DB write on AI failure / null client / unauthorized / happy path

### Manual Testing Steps

1. After Phase 3: open a campaign's battle list in the dev server — confirms battles GET fix does not regress the happy path
2. After Phase 4: run `npm run test` from a clean state and confirm the full suite passes

## References

- Research: `context/changes/testing-critical-path-bootstrap/research.md`
- Test plan Phase 1 risks: `context/foundation/test-plan.md` §2
- Reference correct pattern: `src/pages/api/enemies/[id].ts:46–51`
- Confirmed bug location: `src/pages/api/battles.ts:113–119`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest Bootstrap

#### Automated

- [x] 1.1 `npm run test -- --passWithNoTests` exits 0 — d348d9f
- [x] 1.2 `npm run lint` passes with no new errors from config files — d348d9f

### Phase 2: Schema Unit Tests

#### Automated

- [x] 2.1 `npm run test` exits 0 with all schema boundary-value tests passing — 7f38782

### Phase 3: Mutation Route Fixes and Integration Tests

#### Automated

- [x] 3.1 `npm run test` exits 0 with all mutation route integration tests passing — b0fd6e8
- [x] 3.2 `npm run lint` passes with no new errors from route fixes — b0fd6e8
- [x] 3.3 `npx astro check` passes — route fixes introduce no type errors — b0fd6e8

#### Manual

- [x] 3.4 Battle list for a campaign renders correctly in dev server after battles GET fix — b0fd6e8

### Phase 4: Generate Route Integration Tests

#### Automated

- [ ] 4.1 `npm run test` exits 0 with all generate route tests passing, including AI-throw → no-DB-write assertion

### Phase 5: Cookbook Update and Status Close-Out

#### Automated

- [ ] 5.1 `npm run test` exits 0 (full suite — no regression from cookbook edits)

#### Manual

- [ ] 5.2 `context/foundation/test-plan.md` §6.1 and §6.2 contain concrete patterns (not "TBD")
- [ ] 5.3 §3 Phase 1 row shows `complete`
