---
date: 2026-06-11T19:30:00+02:00
researcher: Claude (Opus 4.8)
git_commit: b09f3ccc2684c393499063e8cb6a1b5b62b368eb
branch: main
repository: 10x-DnD
topic: "Wire vitest into CI so tests block PR merge (test-plan Phase 4)"
tags: [research, codebase, ci, github-actions, vitest, quality-gates, testing]
status: complete
last_updated: 2026-06-11
last_updated_by: Claude (Opus 4.8)
---

# Research: Wire vitest into CI so tests block PR merge (test-plan Phase 4)

**Date**: 2026-06-11T19:30:00+02:00
**Researcher**: Claude (Opus 4.8)
**Git Commit**: b09f3ccc2684c393499063e8cb6a1b5b62b368eb
**Branch**: main
**Repository**: 10x-DnD

## Research Question

Ground rollout Phase 4 of `context/foundation/test-plan.md` — "CI quality gates":
wire vitest into GitHub Actions so the existing test suite blocks PR merge on
failure. Verify the CI gap, confirm the suite is mergeable, and determine
whether two routes flagged with no test files
(`src/pages/api/campaigns/index.ts`, `src/pages/api/auth/signout.ts`) need
dedicated tests before the gate is wired.

## Summary

The core of Phase 4 is a **one-line CI change**: the test infrastructure is
fully in place and the suite is healthy, but `.github/workflows/ci.yml` never
runs it. Key grounded facts:

1. **The suite is green and fast** — `npm run test` passes 96 tests across 12
   files in ~1.15s ([run output](#3-suite-health--green-and-hermetic)). Wiring
   the gate cannot break existing merges.
2. **The test step is hermetic** — [tests/setup.ts](../../../tests/setup.ts)
   mocks `astro:env/server`, so the CI test step needs **no secrets, no
   `astro sync`, no build output**. It needs only `npm ci` + `npm run test`.
3. **The gap is purely the missing step** — every other piece (vitest 4 in
   devDeps, [vitest.config.ts](../../../vitest.config.ts), the `test` script)
   exists. CI runs `npm ci → astro sync → lint → build`, never `npm run test`.
4. **"Block merge" is two things, not one.** Adding the YAML step makes tests
   **run + report** on every PR (the workflow already triggers on
   `pull_request` to `main`). Making them **block** merge requires a GitHub
   **branch-protection rule** marking the `ci` check as required — a repo-
   settings change that cannot live in the workflow file. The planner must
   address both or explicitly defer branch protection to a documented manual
   step.
5. **The two "uncovered" routes are triaged, not blockers** (challenger pass
   below corrects the sub-agent characterizations):
   - `campaigns/index.ts` — real validation logic, **no bug**; worth a
     regression test (medium signal).
   - `auth/signout.ts` — trivial 6-line route, **low signal**; recommend §7
     "don't test" over a dedicated test.
6. **`test-plan.md` §5 overstates the current gates** — it claims "lint +
   typecheck ... already wired via husky + GitHub Actions". Reality: husky runs
   `lint-staged` (eslint + prettier) only; CI runs `lint` + `build`; there is
   **no `typecheck` script** anywhere. Flag for backport.

## Detailed Findings

### 1. Current CI pipeline and the exact gap

[.github/workflows/ci.yml](../../../.github/workflows/ci.yml) defines two jobs:

- **`ci`** (runs on every push to `main` and every PR to `main`):
  `actions/checkout` → `setup-node@22` → `npm ci` → `npx astro sync` →
  `npm run lint` → `npm run build` (with `SUPABASE_URL`/`SUPABASE_KEY` secrets).
  **No test step.** ([ci.yml:9-24](../../../.github/workflows/ci.yml#L9-L24))
- **`deploy`** (`needs: ci`, only on push to `main`): rebuilds and
  `wrangler deploy`. ([ci.yml:26-44](../../../.github/workflows/ci.yml#L26-L44))

Because `deploy` has `needs: ci`, **adding the test step to the `ci` job
automatically gates deploy too** — a red test on `main` blocks the Cloudflare
deploy, which is the desired behavior.

The fix is to insert one step into the `ci` job:

```yaml
      - run: npm run test
```

Placement (fail-fast ordering): `npm run lint` (fast) → `npm run test`
(~1.15s) → `npm run build` (slow). Tests do not consume build output, so they
belong **before** build to fail fast. The step needs **no `env:` block** (see
Finding 2).

### 2. Test infrastructure is hermetic — no secrets required

[tests/setup.ts](../../../tests/setup.ts) mocks the `astro:env/server` virtual
module with placeholder values:

```ts
vi.mock("astro:env/server", () => ({
  SUPABASE_URL: "https://mock.supabase.co",
  SUPABASE_KEY: "mock-supabase-key",
  ANTHROPIC_API_KEY: "mock-anthropic-key",
}));
```

[vitest.config.ts](../../../vitest.config.ts) runs in `environment: "node"`,
includes `tests/**/*.test.ts`, loads `tests/setup.ts`, and resolves `@/`
aliases via `tsconfigPaths()`. Integration tests mock `@/lib/supabase` and
`@/lib/ai` at the module boundary.

**Consequence for CI:** the test step requires neither the real Supabase
secrets nor `npx astro sync` (vitest transpiles via esbuild and does not
typecheck or consume Astro's generated `.astro/types.d.ts`). This is a
benefit — the test step will run even on PRs from forks where repo secrets are
unavailable. **Do not add an `env:` block to the test step.**

### 3. Suite health — green and hermetic

`npm run test` at commit `b09f3cc`:

```
 Test Files  12 passed (12)
      Tests  96 passed (96)
   Duration  1.15s
```

Wiring the gate locks in this passing state as the merge floor. No remediation
of existing tests is required before Phase 4.

### 4. "Block merge" requires a branch-protection rule

The workflow already triggers on `pull_request: branches: [main]`
([ci.yml:6-7](../../../.github/workflows/ci.yml#L6-L7)), so once the test step
is added the check will **appear and report** on every PR. But GitHub does not
prevent merging a PR with a failing check unless a **branch-protection rule**
(or ruleset) on `main` marks the `ci` status check as **required**.

This cannot be expressed in the workflow YAML. Options for the planner:
- Document a manual GitHub-UI step (Settings → Branches → add rule on `main` →
  require the `ci` check).
- Or script it via `gh api` (e.g.
  `gh api repos/vroobel95/10x-DnD/branches/main/protection -X PUT ...`) — note
  this needs admin scope on the repo and is not reversible by the workflow.

**The test-plan §3 Phase 4 goal ("tests block merge on every PR") is only fully
met when both the YAML step and branch protection are in place.** No Playwright
MCP / GitHub MCP is available this session to verify current branch-protection
state, so treat current protection as unknown.

### 5. Uncovered routes — triaged with a challenger pass

Two routes have no dedicated test file. Both were flagged by exploration as
"CRITICAL silent failure". I read both directly; the characterizations are
**overstated** and corrected here.

#### `src/pages/api/campaigns/index.ts` — worth a regression test, no bug

- **GET** ([index.ts:8-24](../../../src/pages/api/campaigns/index.ts#L8-L24)):
  null client → 500, no user → 401, `getUserCampaigns` error → 500, else 200.
  Clean; checks `error` properly. No silent-failure pattern.
- **POST** ([index.ts:26-69](../../../src/pages/api/campaigns/index.ts#L26-L69)):
  null client → 500, no user → 401, invalid JSON → 400, empty name → 400,
  name > 200 → 400, description > 500 → 400, then insert.
  - **Challenger correction:** the insert at
    [index.ts:58-62](../../../src/pages/api/campaigns/index.ts#L58-L62)
    destructures only `data: campaign` and ignores `error`, then
    [index.ts:64-66](../../../src/pages/api/campaigns/index.ts#L64-L66) returns
    **500** when `!campaign`. For an **insert**, a failure yields
    `{ data: null, error }`, so `!campaign → 500` produces the **correct
    outcome**. This is **not** the Risk #3 silent-success pattern (which
    returned 200 on a no-op). The only nit is that the error detail is dropped
    (not logged) — a style issue, not a behavioral bug.
- **Verdict:** the route has **genuine, untested validation logic** and a
  create path. A test is worthwhile as a **regression guard** (medium signal),
  not a bug fix. It fits the existing campaigns test family
  ([campaigns-id.test.ts](../../../tests/integration/api/campaigns-id.test.ts)
  covers PATCH/DELETE but not the index route). Oracle must come from the
  validation rules (name required, ≤200, desc ≤500), not from the schema.

#### `src/pages/api/auth/signout.ts` — recommend §7 "don't test"

- 6 lines ([signout.ts:4-9](../../../src/pages/api/auth/signout.ts#L4-L9)):
  `if (supabase) { await supabase.auth.signOut(); } return context.redirect("/");`
- **Challenger correction:** this technically violates the lessons.md rule
  *"Guard against null Supabase client instead of falling through to success"*
  — on a null client it skips `signOut()` and still redirects. **But the blast
  radius is minimal:** signout is the user leaving; a null client means total
  misconfiguration, and the worst case is a session cookie not cleared on a
  total-outage path. No validation, no ownership, no mutation-with-confirmation.
- **Verdict (cost × signal, §1 principle #1):** a dedicated signout test is
  **low signal**. Recommend documenting it in §7 "What We Deliberately Don't
  Test" rather than adding a test. Fixing the null-client fall-through is a
  2-line change but is **out of Phase 4's CI scope** and not justified by blast
  radius; defer unless the user wants pattern-consistency closure.

### 6. `test-plan.md` §5 discrepancy — "typecheck" is not actually wired

§5 Quality Gates claims: *"lint + typecheck — required now (already wired via
husky + GitHub Actions)"*. Grounded reality:

- **husky**: [.husky/pre-commit](../../../.husky/pre-commit) runs
  `npx lint-staged`. [package.json:74-81](../../../package.json#L74-L81)
  configures lint-staged to run `eslint --fix` on `*.{ts,tsx,astro}` and
  `prettier --write` on `*.{json,css,md}`. **Lint + format only, on staged
  files — no typecheck.**
- **CI**: runs `npm run lint` and `npm run build` — no dedicated typecheck.
- **No `typecheck` script exists** in
  [package.json:5-19](../../../package.json#L5-L19). `@astrojs/check` is a
  dependency (so `astro check` is *available*), but nothing invokes it as a
  gate; `astro build` may perform some type validation but is not an explicit
  typecheck gate.
- **Minor note:** both `husky` (devDep, active) and `lefthook`
  ([package.json:37](../../../package.json#L37), in `dependencies`) are
  installed, but only husky has a live hook. `lefthook` appears unused.

**Recommendation:** flag this for backport into `test-plan.md` §5 (correct the
"typecheck already wired" claim). Optionally, Phase 4 could add a `typecheck`
script (`astro check`) + CI step to genuinely close the gate — but that is a
**separate concern** from wiring vitest and should be an explicit planner
decision, not silently folded in.

### 7. Recommended Phase 4 scope (for `/10x-plan`)

- **Must (core):** add `- run: npm run test` to the `ci` job in
  [ci.yml](../../../.github/workflows/ci.yml), after `npm run lint`, before
  `npm run build`, with no `env:` block.
- **Must (blocking mechanism):** add `main` branch protection requiring the
  `ci` check — either a documented manual step or a `gh api` command, since it
  cannot live in the YAML. Without this, "block merge" is not met.
- **Should (closes a real coverage gap, medium signal):** add an integration
  test for `campaigns/index.ts` (GET list + POST create), following
  [campaigns-id.test.ts](../../../tests/integration/api/campaigns-id.test.ts)
  and the 5-tier coverage rule. Regression guard, not a bug fix.
- **Optional / explicit decision:** `auth/signout.ts` → recommend §7
  "don't test" rather than a test; correct §5 typecheck claim and optionally
  add a `typecheck` gate; coverage reporting / pre-push test hook (low
  priority — note husky pre-commit is lint-only today).

## Code References

- `.github/workflows/ci.yml:9-24` — `ci` job; lint + build, **no test step**
- `.github/workflows/ci.yml:26-44` — `deploy` job, `needs: ci`
- `package.json:10-12` — `test` / `test:watch` / `test:coverage` scripts
- `package.json:5-19` — full scripts block; **no `typecheck` script**
- `package.json:74-81` — lint-staged config (lint + format only)
- `vitest.config.ts:1-11` — node env, `tests/**/*.test.ts`, setup file, alias resolution
- `tests/setup.ts:3-7` — mocks `astro:env/server` (hermetic; no secrets needed)
- `.husky/pre-commit` — runs `npx lint-staged` (no typecheck)
- `src/pages/api/campaigns/index.ts:8-24` — GET list (clean error handling)
- `src/pages/api/campaigns/index.ts:26-69` — POST create (validation + insert)
- `src/pages/api/campaigns/index.ts:58-66` — insert ignores `error`, returns 500 on `!campaign` (correct outcome)
- `src/pages/api/auth/signout.ts:4-9` — 6-line POST, `if (supabase)` fall-through
- `tests/integration/api/campaigns-id.test.ts` — reference test for the campaigns family (PATCH/DELETE)
- `tests/helpers/supabase.ts` — `makeSupabaseMock(tableResults)`
- `tests/helpers/auth.ts` — `makeAuthClientMock(results?)`

## Architecture Insights

- **Hermetic test design is the enabler.** Because Phase 1 stubbed
  `astro:env/server` in `tests/setup.ts` and mocks Supabase/AI at the module
  boundary, the suite is fully self-contained — the reason the CI step is a
  one-liner with no secrets. This is the payoff of the Phase 1 infrastructure
  decisions.
- **`needs: ci` makes the gate transitive.** Wiring tests into `ci`
  automatically protects the `deploy` job; no separate deploy guard is needed.
- **YAML runs, branch protection blocks.** A recurring CI misconception: adding
  a workflow step does not by itself prevent merges. The blocking semantics
  live in repo settings, outside version control.
- **Cost × signal in action.** The two uncovered routes split cleanly along the
  test-plan's own principle: `campaigns/index` (real logic) earns a test;
  `signout` (trivial, low blast radius) earns a §7 exclusion.

## Historical Context (from prior changes)

- `context/changes/testing-critical-path-bootstrap/plan.md` — Phase 1
  bootstrapped vitest 4, `tests/setup.ts`, `makeSupabaseMock`, the `test`
  scripts, and fixed silent-success mutation routes. Explicitly deferred CI
  wiring to Phase 4.
- `context/changes/testing-auth-flow-integrity/plan.md` — Phase 2 added
  `makeAuthClientMock` and auth-redirect tests; fixed the null-client
  fall-through on forgot-password/reset-password (the same anti-pattern
  `signout.ts` still exhibits, but on a far higher-stakes path).
- `context/changes/ownership-boundary/plan.md` — Phase 3 added IDOR cases and
  sanitized `signin.ts`/`signup.ts` errors. All three phases left CI untouched
  by design.
- `context/foundation/lessons.md` — "Guard against null Supabase client",
  "Sanitize external service errors", "Separate DB errors from not-found": all
  satisfied by the routes Phases 1–3 covered; `signout.ts` is the lone
  remaining null-client fall-through, judged low-signal here.

## Related Research

- `context/foundation/test-plan.md` §3 Phase 4 (CI quality gates), §4 (Stack),
  §5 (Quality Gates — contains the typecheck discrepancy noted above).

## Open Questions

1. **Current `main` branch-protection state is unknown** (no GitHub MCP this
   session). The planner should either inspect it via `gh api` during
   implementation or document the manual rule. Without a required check,
   "block merge" is unmet.
2. **Scope decision for the planner:** include the `campaigns/index.ts`
   regression test in Phase 4, or keep Phase 4 strictly CI-config and spin the
   test into a follow-up? (Recommendation: fold it in — it is cheap, closes a
   real gap, and the test-base profile is `meaningful`.)
3. **Typecheck gate:** correct §5's claim only (backport), or also add a real
   `astro check` typecheck step to CI? (Recommendation: backport the §5
   correction now; treat adding a typecheck gate as an explicit, optional
   decision.)
4. **`auth/signout.ts` null-client fall-through:** leave as-is and document in
   §7, or apply the 2-line consistency fix? (Recommendation: document in §7;
   out of CI scope.)
