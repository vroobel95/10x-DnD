---
date: 2026-06-04T00:00:00+00:00
researcher: Claude Sonnet 4.6
git_commit: 20424e255dd57c6c3fc1056367817f87cf342772
branch: main
repository: 10x-DnD
topic: "Test runner bootstrap + critical-path contracts (Phase 1)"
tags: [research, testing, vitest, ai-generation, mutation-routes, supabase, validation]
status: complete
last_updated: 2026-06-04
last_updated_by: Claude Sonnet 4.6
---

# Research: Test Runner Bootstrap + Critical-Path Contracts (Phase 1)

**Date**: 2026-06-04  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: 20424e255dd57c6c3fc1056367817f87cf342772  
**Branch**: main  
**Repository**: 10x-DnD

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md`. For each of the three covered risks, locate the real failure path in code, verify or correct the response guidance, and determine the cheapest useful test layer. Also determine the vitest setup requirements for this stack.

**Risks in scope:**
- Risk #1 — AI generates enemies with stat blocks outside D&D 5e legal ranges
- Risk #3 — API routes report HTTP 200 when mutation silently did nothing
- Risk #7 — GM submits enemy request; AI call fails; UI shows success or hangs

---

## Summary

**Risk #1 (invalid stat blocks): ALREADY PROTECTED by existing schema constraints — test is a regression guard, not a gap-fill.**  
`src/lib/schemas/enemy.ts` already defines `.int().min(1).max(30)` for all six ability scores and AC, and `.int().min(1)` for HP. Validation fires inside the Vercel AI SDK's `Output.object()` call before any DB write; a schema mismatch throws and is caught by the generate route's try/catch, returning HTTP 500. The test plan's "must challenge" assumption ("Zod accepts the type but not the ranges") was right to flag — and research confirms the ranges ARE there. Tests should verify boundary values work as regressions guards.

**Risk #3 (silent mutation failures): PARTIALLY REAL — one confirmed bug, four RISK patterns across three files.**  
`src/pages/api/battles.ts` GET handler (line ~119) is a confirmed bug: it ignores the Supabase error on the battles SELECT and returns 200 with `battles ?? []`. Four other routes (battle DELETE, campaign PATCH, campaign DELETE, generate POST battle-lookup) do not check `result.error` before checking `!data`, meaning a Supabase error that somehow returns non-null data would silently succeed. `src/pages/api/enemies/[id].ts` (both PATCH and DELETE) is correctly implemented and does not need fixes.

**Risk #7 (AI generation failure): ALREADY PROTECTED — test is a regression guard.**  
The API key guard throws immediately when `ANTHROPIC_API_KEY` is falsy. The generate route wraps `generateEnemies()` in a blanket try/catch that returns HTTP 500 with `{ error: "Generation failed. Please try again." }` for any failure (key error, network error, validation failure). No silent success, no hang. Tests should verify these branches fire correctly and that the error message is user-safe.

**Vitest setup: viable with node environment, but two non-obvious requirements.**  
Use standard vitest `node` environment (NOT `@cloudflare/vitest-pool-workers`). Critical blocker: `astro:env/server` is a virtual Astro module imported by both `src/lib/supabase.ts` and `src/lib/ai.ts` — it must be stubbed in a setup file before any test can import these modules. Also: the `vite@^7.3.2` override in `package.json` means vitest 3.x (targeting Vite 5/6) may not be compatible — install `vitest@^4` (currently RC) or confirm peer dep compatibility before locking a version.

---

## Detailed Findings

### Risk #1 — AI Stat Block Validation

**Schema constraints (all present):**  
[src/lib/schemas/enemy.ts:10-19](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/lib/schemas/enemy.ts#L10)

```typescript
hp: z.number().int().min(1),
ac: z.number().int().min(1).max(30),   // NOTE: min is 1, not 0
str: z.number().int().min(1).max(30),
dex: z.number().int().min(1).max(30),
con: z.number().int().min(1).max(30),
int: z.number().int().min(1).max(30),
wis: z.number().int().min(1).max(30),
cha: z.number().int().min(1).max(30),
```

CR is `z.string().min(1)` — string type is correct (CR values are "0", "1/8", "1/4", "1/2", "1", "2", etc.).

**Validation pipeline in generate route:**  
[src/pages/api/battles/[id]/generate.ts:43-47](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/pages/api/battles/%5Bid%5D/generate.ts#L43)

```typescript
try {
  enemyGroup = await generateEnemies(battle, prompt);
} catch {
  return Response.json({ error: "Generation failed. Please try again." }, { status: 500 });
}
```

`generateEnemies()` passes `EnemyGroupSchema` to `Output.object()` in the Vercel AI SDK call. If the AI output fails schema validation, the SDK throws. The catch block returns 500 before reaching the DB insert at line ~57.

**Minor finding — AC floor:** The schema sets `ac: z.number().int().min(1)`, not `min(0)`. The test plan cited `AC ≥ 0` as the D&D 5e floor, but the schema enforces `min(1)`. This is a stricter constraint than the PRD guardrail specifies. Note in tests: test boundary at `ac=0` (rejected by schema, even though PRD says ≥ 0). This is not a bug — it is a stricter-than-required guard. No backport needed.

**DB write guard:**  
[src/pages/api/battles/[id]/generate.ts:49-61](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/pages/api/battles/%5Bid%5D/generate.ts#L49)

The DB insert is only reached if `generateEnemies()` returned without throwing. Implicit guard via control flow — no explicit pre-insert validation check, but the try/catch makes it structurally correct.

**Verdict:** The failure path the test plan identified does not exist as a current bug. Tests should verify:
1. The schema itself rejects boundary violations (unit test — cheap, fast, permanent regression guard).
2. The generate route returns 500, not 200, when the AI SDK throws (integration test with mocked AI SDK).

---

### Risk #3 — Mutation Route Error Handling

#### CONFIRMED BUG: `src/pages/api/battles.ts` GET ~line 113-119

```typescript
const { data: battles } = await supabase
  .from("battles")
  .select("*")
  .eq("campaign_id", campaignId)
  .order("created_at", { ascending: false });
// error is destructured away; returns battles ?? []
```

If Supabase errors, `battles` is `null` and the route returns `200` with an empty array. GM sees an empty battle list instead of an error.

#### RISK PATTERN: Routes that check `!data` but not `error` first

| File | Method | Line | Pattern | Verdict |
|---|---|---|---|---|
| `src/pages/api/battles/[id]/index.ts` | DELETE | ~34 | `if (!data) → 404` (no error check) | RISK |
| `src/pages/api/campaigns/[id].ts` | PATCH | ~47 | `if (!campaign) → 404` (no error check) | RISK |
| `src/pages/api/campaigns/[id].ts` | DELETE | ~69 | `if (!data) → 404` (no error check) | RISK |
| `src/pages/api/battles/[id]/generate.ts` | POST (battle lookup) | ~38-40 | `if (!battle) → 404` (no error check) | RISK |

These routes use `.select().single()` (which sets `error` on any failure), so `data` being non-null implies success in practice. The risk is low but real: a Supabase error that somehow produces non-null `data` would silently return 200. The cleaner pattern (separate `error → 500` from `!data → 404`) is already implemented correctly in `src/pages/api/enemies/[id].ts`.

#### CORRECTLY IMPLEMENTED (reference pattern):

[src/pages/api/enemies/[id].ts:46-51](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/pages/api/enemies/%5Bid%5D.ts#L46)

```typescript
if (result.error) {
  return Response.json({ error: "Could not update enemy. Please try again." }, { status: 500 });
}
if (!result.data) {
  return Response.json({ error: "Enemy not found" }, { status: 404 });
}
```

This is the gold-standard pattern. Tests should assert it. Fixes to other routes should mirror it.

---

### Risk #7 — AI Generation Failure Handling

**API key guard:**  
[src/lib/ai.ts:19-21](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/lib/ai.ts#L19)

```typescript
if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not configured");
}
```

Throws before SDK instantiation. Caught by generate route's try/catch → 500.

**Generate route failure response:**  
[src/pages/api/battles/[id]/generate.ts:43-47](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/pages/api/battles/%5Bid%5D/generate.ts#L43)

```typescript
try {
  enemyGroup = await generateEnemies(battle, prompt);
} catch {
  return Response.json({ error: "Generation failed. Please try again." }, { status: 500 });
}
```

Returns HTTP 500 with user-safe message. No hang, no silent 200.

**Verdict:** Risk #7 is already handled correctly. No current bug. Tests should verify:
1. When `generateEnemies` throws, the route returns exactly 500 + `{ error: "Generation failed. Please try again." }` (regression guard).
2. The DB insert at lines ~49-61 is NOT called when the AI call fails (no orphan rows written).

---

### Vitest Setup

#### Environment: `node` (not `@cloudflare/vitest-pool-workers`)

The API route handlers use only standard Web APIs (`Request`, `Response`, `Headers`). Supabase and Anthropic SDK will be mocked. The Cloudflare KV binding in `wrangler.jsonc` is not used by any handler under test. `nodejs_compat` flag in `wrangler.jsonc:6` means the production/node gap is small.

Use `@cloudflare/vitest-pool-workers` only if tests need real KV/D1/Durable Objects — that is not the case here.

#### Critical blocker: `astro:env/server` virtual module

Both `src/lib/supabase.ts:3` and `src/lib/ai.ts:3` import from `astro:env/server` (an Astro build-time virtual module that does not exist outside the Astro Vite pipeline). Any test that imports these modules — directly or transitively — will fail with `Cannot find module 'astro:env/server'` unless it is stubbed first.

**Fix:** Add to `tests/setup.ts`:

```typescript
vi.mock('astro:env/server', () => ({
  SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_KEY: 'mock-key',
  ANTHROPIC_API_KEY: 'mock-anthropic-key',
}));
```

This must load before any test file that imports `src/lib/supabase` or `src/lib/ai`.

#### Path alias

`tsconfig.json:8-11` defines `"@/*": ["./src/*"]`. Vitest does not auto-read `tsconfig.json` paths. Fix: `vite-tsconfig-paths` plugin — zero-config, stays in sync with `tsconfig.json` automatically.

#### Vite version risk

`package.json:61` overrides `vite` to `^7.3.2`. Vitest 3.x targets Vite 5/6; vitest 4.x (currently RC) targets Vite 7. Install `vitest@^4` (RC) to match, or verify peer dep compatibility before pinning.

```
npm install -D vitest@^4 vite-tsconfig-paths @vitest/coverage-v8
```

#### Supabase mock strategy

`src/lib/supabase.ts` exports `createClient` as a factory. The correct mock:

```typescript
vi.mock('@/lib/supabase', () => ({ createClient: vi.fn() }));
```

Then per-test: `vi.mocked(createClient).mockReturnValue(mockSupabaseClient)`.

A `tests/helpers/supabase.ts` fixture with a typed partial mock is recommended to avoid re-declaring the mock object in every integration test.

#### Test file location

Top-level `tests/` directory mirroring `src/` structure. Do NOT co-locate `.test.ts` files in `src/pages/api/` — Astro's file-based router scans that directory and co-located test files create confusion even if they are ignored by the router.

```
tests/
  setup.ts               ← global stubs (astro:env/server)
  helpers/
    supabase.ts          ← typed partial mock client factory
  unit/
    lib/
      schemas/enemy.test.ts
  integration/
    api/
      battles.test.ts
      battles-generate.test.ts
      enemies.test.ts
      campaigns.test.ts
```

#### Minimum vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
```

#### package.json test scripts

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

---

## Code References

- [src/lib/schemas/enemy.ts:10-19](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/lib/schemas/enemy.ts#L10) — D&D 5e stat constraints (all present)
- [src/lib/ai.ts:19-21](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/lib/ai.ts#L19) — API key guard (throws before SDK call)
- [src/pages/api/battles/[id]/generate.ts:43-47](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/pages/api/battles/%5Bid%5D/generate.ts#L43) — try/catch → 500 on any AI failure
- [src/pages/api/battles/[id]/generate.ts:49-61](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/pages/api/battles/%5Bid%5D/generate.ts#L49) — DB insert only reached after successful AI call
- [src/pages/api/battles.ts:113-119](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/pages/api/battles.ts#L113) — **CONFIRMED BUG**: Supabase error on battles SELECT ignored; returns `[]`
- [src/pages/api/enemies/[id].ts:46-51](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/pages/api/enemies/%5Bid%5D.ts#L46) — **REFERENCE PATTERN**: correct error/not-found separation
- [src/pages/api/battles/[id]/index.ts:34](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/pages/api/battles/%5Bid%5D/index.ts#L34) — RISK: no error check before data check
- [src/pages/api/campaigns/[id].ts:47](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/pages/api/campaigns/%5Bid%5D.ts#L47) — RISK: PATCH no error check
- [src/pages/api/campaigns/[id].ts:69](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/pages/api/campaigns/%5Bid%5D.ts#L69) — RISK: DELETE no error check
- [src/lib/supabase.ts:3](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/lib/supabase.ts#L3) — imports `astro:env/server` (must be stubbed in vitest setup)
- [src/lib/ai.ts:3](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/src/lib/ai.ts#L3) — imports `astro:env/server` (must be stubbed in vitest setup)
- [package.json:61](https://github.com/vroobel95/10x-DnD/blob/20424e255dd57c6c3fc1056367817f87cf342772/package.json#L61) — `vite@^7.3.2` override; requires `vitest@^4` (RC)

---

## Architecture Insights

1. **Validation by throwing, not by returning.** The AI generation pipeline uses the Vercel AI SDK's `Output.object()` to enforce the Zod schema. Failures throw exceptions, not return error objects. Tests that mock the AI SDK should simulate this by having `generateEnemies()` throw.

2. **Correct error pattern is already in the codebase.** `src/pages/api/enemies/[id].ts` correctly separates `error → 500` from `!data → 404`. This is the reference implementation. Fixes to other routes should copy this pattern verbatim.

3. **Silent failures are SELECT-side, not mutation-side.** The CONFIRMED BUG is in a GET handler (battles list), not a mutation. The mutation routes (PATCH/DELETE) all use `.select("id").single()` to confirm row impact, which is correct. The issue is that they don't separately check `result.error` before checking `result.data`. In practice, `.single()` returns `error` (not `data`) on any Supabase failure, so the risk is theoretical for mutations — but real for the GET query.

4. **`astro:env/server` is the top vitest gotcha.** Any integration test that imports any helper from `src/lib/` will transitively import `astro:env/server` and fail unless the global setup file stubs it. This must be the first thing configured.

5. **Supabase createClient returns `null` on misconfiguration.** Every handler guards against this with `if (!supabase) → 500`. Tests should cover this path (mock `createClient` to return `null`, assert 500 response).

---

## Historical Context (from prior changes)

- `context/foundation/lessons.md` — §Confirm row deletion before returning success, §Separate DB errors from not-found: both lessons were written precisely about the pattern confirmed in this research. The `battles.ts` GET bug and the `campaigns/[id].ts` RISK pattern are new instances of the same class of bug.
- `context/foundation/lessons.md` — §Fail fast on missing required secrets: confirmed implemented correctly in `src/lib/ai.ts:19-21`.
- `context/foundation/lessons.md` — §Sanitize external service errors: confirmed all researched routes use user-safe error messages.

---

## Post-Research Corrections to Test Plan §2

The following findings should be backported into `context/foundation/test-plan.md §2 Risk Response Guidance` before planning:

| Risk | Correction |
|---|---|
| #1 | Schema range constraints ARE present (`.int().min(1).max(30)` for all stats). The "must challenge" assumption was correct to raise; its answer is "constraints exist." Tests are regression guards, not gap-fills. Note: `ac` floor is `1`, not `0` — PRD says `≥ 0` but schema enforces `≥ 1`; test boundary at `ac=0` (it IS rejected by current schema). |
| #3 | Confirmed bug in `battles.ts` GET (~line 119). RISK pattern (not confirmed bug) in 4 other routes. Reference correct implementation: `enemies/[id].ts` PATCH/DELETE. The cheapest layer is integration test with mocked Supabase returning `{ data: null, error: { message: "..." } }`. |
| #7 | AI failure handling IS implemented correctly (try/catch → 500, user-safe message, no DB write on failure). Tests are regression guards. The "must challenge" assumption ("UI will just show nothing") is wrong — research confirms it shows a 500 error. |

---

## Open Questions

1. **Vite 7 + Vitest 4 compatibility:** `vitest@^4` is currently RC. Confirm it is stable enough for this project before adopting, or pin to a specific RC. Alternative: constrain the `vite` override to `^6.x` until vitest 4 is stable — but this conflicts with the existing `package.json:61` override.

2. **`batteries.ts` GET bug scope:** The confirmed bug returns an empty array on Supabase error. Should this be fixed as part of Phase 1 (fix it while adding the integration test) or tracked as a separate bug fix? Fixing it in Phase 1 keeps scope clean.

3. **`context` object construction in integration tests:** Astro API routes receive an `APIContext` object (with `request`, `cookies`, `locals`, `params`). Tests need to construct a minimal stub. Confirm the shape from `@astrojs/check` types before planning — this is the integration boundary for all route handler tests.
