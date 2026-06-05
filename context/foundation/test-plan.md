# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-05 (Phase 1 complete)

---

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/` — excluding `node_modules`, `dist`, `.astro` cache.

---

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | AI generates enemies with stat blocks outside D&D 5e legal ranges (e.g. STR = 0 or > 30, HP ≤ 0, AC < 0) — GM confirms invalid enemies and runs them at the table | High | High | PRD §Guardrails ("no impossible ability scores or broken combat math"), roadmap S-02 risk note ("model may produce stat blocks that fail validity checks"), interview Q1 |
| 2 | Auth callback / password reset regression — `next` redirect param not validated (external domain accepted), null Supabase client silently returns "success" without sending email or changing password, locking GM out | High | High | Interview Q3 ("auth callback / password reset — lots of redirect edge cases"), hot-spot dir `src/pages/api/auth/` (16 commits/30d), lessons.md §Validate redirect targets, §Guard against null Supabase client |
| 3 | API routes report HTTP 200 / "success" when the underlying Supabase mutation silently did nothing — delete with no matching row, update with no affected row, client returns null | High | High | lessons.md §Confirm row deletion before returning success, §Separate DB errors from not-found, §Guard against null Supabase client — three separate recorded instances, some with incomplete `[fill in]` rule entries indicating unresolved exposure |
| 4 | Confirmed enemies silently not written — API reports success but no row persists; GM loses enemy data between sessions | High | Medium | PRD §Guardrails ("data loss or corruption is a regression"), lessons.md §Never silently swallow fetch errors, hot-spot dir `src/components/battles/` (12 commits/30d) |
| 5 | IDOR — GM A can GET/PATCH/DELETE GM B's campaign, battle, or enemy by guessing an ID; API layer ownership check missing or bypassed (RLS is defense-in-depth, not the sole guard) | High | Medium | PRD §Access Control ("login required; flat role model — all GMs equal"), AGENTS.md ("Always enable RLS"), hot-spot dir `src/pages/api/campaigns/` (7 commits/30d) |
| 6 | Raw Supabase error messages (table names, constraint names, codes) leak in API error responses — new routes added in S-03/S-05 may reproduce the pattern already fixed in earlier routes | Medium | Medium | lessons.md §Sanitize external service errors (explicit instances in `battles.ts`, `signin.ts`, `signup.ts`), hot-spot dir `src/pages/api/campaigns/` (7 commits/30d) |
| 7 | GM submits a natural-language enemy request and the AI call fails (Anthropic API error, timeout, empty API key, unparseable response) — the UI hangs, silently clears, or reports success with no enemies generated | High | Medium | Roadmap S-02 risk note ("AI generation is the product's riskiest assumption"), lessons.md §Fail fast on missing required secrets, hot-spot dir `src/pages/api/battles/[id]/` (8 commits/30d), interview Q1 (generation is the core user-facing flow) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | Stat block returned by generation API is checked against D&D 5e legal ranges (STR 1–30, HP ≥ 1, AC ≥ 1 per schema — stricter than PRD's ≥ 0, CR a non-empty string) before it can be confirmed; out-of-range values are rejected or not surfaced as confirmable | Confirmed by research: range constraints ARE present in `src/lib/schemas/` — all stats `.int().min(1).max(30)`, HP `.int().min(1)`. Challenge shifts to: verify boundary values are actually rejected at runtime, not just declared; note AC floor is 1 in schema (stricter than PRD's ≥ 0) — test at AC=0 (currently rejected) | GROUNDED: constraints exist; validation fires inside the AI SDK structured-output call before any DB write. Tests are regression guards. Verify STR=0, STR=31, HP=0, AC=0 are all rejected by the schema. | Unit — boundary value tests (STR=0, STR=31, HP=0, AC=0) directly against the schema; integration — mock AI SDK to return out-of-range value, assert 500 and no DB write | Oracle from implementation: asserting "STR=14 is valid because the model returned it" rather than from the D&D 5e rules in the PRD |
| #2 | Valid PKCE exchange redirects to an allowed internal path; `next` param containing an external domain is blocked; null Supabase client returns a clear error, not a silent success redirect | "The redirect succeeds" — must verify the destination is an internal path, not just that a redirect occurred | What does the callback route actually validate for the `next` param? Is there an allow-list or prefix check? What does the recovery-callback route do? | Unit / integration — redirect validation logic; E2E only if the full email-link flow has no integration-testable seam | Happy-path only: valid code + valid redirect — without asserting behavior with an external redirect target or a null Supabase client |
| #3 | Mutation routes (PATCH, DELETE) return 500 on Supabase error, 404 on no-row-matched, and 200 only when a row was actually changed; GET routes return 500 (not an empty result) on Supabase error | "Success response means the mutation happened" — confirmed real instance: battles list GET ignores Supabase error and returns 200 with empty array; risk pattern (no error check before `!data` check) in 4 other routes | GROUNDED: confirmed bug in battles list GET (Supabase error silently returns `[]` with 200). Risk pattern in battle DELETE, campaign PATCH/DELETE, generate route battle-lookup — all check `!data` without first checking `error`. Reference correct pattern: enemies PATCH/DELETE correctly separates `error→500` from `!data→404`. Fix the confirmed bug as part of Phase 1 implementation. | Integration — mock Supabase returning `{ data: null, error: { message: "..." } }`, assert 500; mock returning `{ data: null, error: null }`, assert 404 | Testing only with a mock that always succeeds — the risk is the failure path; also: testing only the routes already known to be correct |
| #4 | After a PATCH confirm succeeds (HTTP 200), the enemy is readable in a subsequent GET with the same user's credentials and has confirmed status | "API returned 200 therefore the write happened" | Does the PATCH confirm endpoint call `.select().single()` after update? Does it check ownership before confirming? | Integration — call PATCH confirm then GET enemy, assert confirmed status is persisted | Mocking the DB entirely — the whole risk is whether the write actually persists; a mock always persists |
| #5 | GET/PATCH/DELETE on another GM's campaign, battle, or enemy returns 404, not the resource | "RLS handles it" — RLS is defense-in-depth; the route must return the correct status code independently | Do campaign and enemy API routes scope queries by authenticated user_id explicitly, or rely solely on RLS to filter? | Integration — call route with User A credentials but User B's resource ID, assert 404 | Testing only the "own resource" happy path — IDOR test requires a second user's ID |
| #6 | Error responses contain only user-safe messages; no constraint names, table names, or Supabase codes in the response body | "We already fixed this in the old routes" — new routes in S-03/S-05 may reproduce the pattern | Which S-03/S-05 routes surface error messages? Any that directly forward `error.message`? | Integration — trigger a Supabase error and assert response body matches a safe message pattern | Re-testing only already-fixed routes; missing new routes added in later slices |
| #7 | When the Anthropic API call fails or returns unparseable output, the generation endpoint returns a clear error (non-200 status + user-safe message) and writes nothing to the DB; the GM never sees a success state with no enemies | Research corrected: the route DOES return HTTP 500 with a user-safe message — not 200, not silence. Challenge shifts to: verify these error branches remain in place as the codebase evolves (regression guard), and that no DB write is attempted when the AI call throws | GROUNDED: API key guard throws before SDK instantiation; blanket try/catch in generate route returns 500 + `"Generation failed. Please try again."` for any AI failure; DB insert is only reached after successful AI call. Tests are regression guards. | Integration — mock `generateEnemies` to throw, assert 500 response with safe message and zero DB rows written; unit — verify API key guard fires before the AI SDK is initialised | Testing only the happy path (AI returns valid JSON); missing the empty-key, throw, and unparseable-response branches |

---

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Test runner bootstrap + critical contracts | Bootstrap vitest; prove AI stat validation rejects illegal values; prove generation fails cleanly on AI errors; prove mutation routes distinguish error / not-found / success | #1, #3, #7 | unit, integration | complete | context/changes/testing-critical-path-bootstrap/ |
| 2 | Auth flow integrity | Prove auth callback redirect validation blocks external targets; null client returns error not silent success; confirm enemies persist after PATCH | #2, #4 | integration | change opened | context/changes/testing-auth-flow-integrity/ |
| 3 | Ownership boundary | Prove API routes reject cross-user resource access at the route layer; prove error responses contain only safe messages | #5, #6 | integration | not started | — |
| 4 | CI quality gates | Wire vitest into GitHub Actions; tests block merge on every PR | cross-cutting | CI config | not started | — |

**Status vocabulary** (fixed — parser literals):

| Value | Meaning |
|---|---|
| `not started` | No change folder for this rollout phase yet. |
| `change opened` | `context/changes/<id>/` exists with `change.md`; research not done. |
| `researched` | `research.md` exists in the change folder. |
| `planned` | `plan.md` exists with a `## Progress` section. |
| `implementing` | Progress section has at least one `[x]` and at least one `[ ]`. |
| `complete` | Progress section is fully `[x]`. |

---

## 4. Stack

The classic test base for this project. No test runner is installed yet; Phase 1 bootstraps the stack. AI-native tool references carry a `checked:` date.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + integration | Vitest | none yet — see §3 Phase 1 | Vite-native; compatible with Astro's Vite pipeline; handles TS without extra config |
| Supabase mocking | `vi.mock()` / Vitest module mocks | none yet — see §3 Phase 1 | Mock Supabase client at module boundary; do not mock individual queries |
| e2e | Playwright | none yet — optional; see §7 | Only if auth callback has no integration-testable seam |
| accessibility | none | — | Out of scope for this rollout |

**Stack grounding tools (current session):**
- Docs: Context7 — available; Vitest and Astro docs can be pulled on demand; checked: 2026-06-04
- Search: Exa.ai — available; checked: 2026-06-04
- Runtime/browser: none detected — Playwright MCP not available; E2E deprioritized per §7
- Provider/platform: none detected — Supabase/Cloudflare/GitHub MCPs not in session; quality-gate wiring deferred to Phase 4

---

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + typecheck | local + CI | required now (already wired via husky + GitHub Actions) | syntactic / type drift |
| unit + integration | local + CI | required after §3 Phase 1 | logic regressions, silent-failure patterns, invalid stat blocks |
| ownership boundary tests | local + CI | required after §3 Phase 3 | IDOR regressions |
| CI test gate (vitest in pipeline) | CI on PR | required after §3 Phase 4 | prevents untested code from merging |
| e2e on auth critical flow | CI on PR | optional — only if no integration seam exists | broken password reset / callback end-to-end |

---

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a unit test (stat validation or pure logic)

- **Location**: `tests/unit/` mirroring `src/` structure (e.g. `tests/unit/lib/schemas/enemy.test.ts` for `src/lib/schemas/enemy.ts`)
- **Naming**: `*.test.ts`
- **Run locally**: `npm run test`
- **Reference test**: `tests/unit/lib/schemas/enemy.test.ts`
- **Oracle rule**: assert against D&D 5e PRD guardrails, not against the schema implementation — prevents the oracle-from-implementation anti-pattern. Example: `str: 0` → `success: false` because the PRD says STR ≥ 1, not because `.min(1)` is in the Zod schema.
- **Pattern**: build a valid baseline fixture, then spread overrides per test case. Call `Schema.safeParse({ ...baseline, override })` and assert `.success`.

### 6.2 Adding an integration test for an API route

- **Location**: `tests/integration/api/`
- **Run locally**: `npm run test`
- **Reference test**: `tests/integration/api/battles.test.ts`
- **Mocking policy**:
  - Mock `@/lib/supabase` and `@/lib/ai` at module boundary via `vi.mock` at the top of each test file — never mock Supabase query internals individually.
  - Use `makeSupabaseMock(tableResults)` from `tests/helpers/supabase.ts` to configure per-table chainable query results. Key: `from` is a `vi.fn()`, so `expect(mock.from).not.toHaveBeenCalledWith("table")` asserts no write occurred.
  - When `createClient` must return null (null-client guard test), use `vi.mocked(createClient).mockReturnValue(null)` directly.
- **Context stub**: construct an `APIContext` minimal object inline per test using only the fields the handler reads (`request`, `cookies`, `locals`, `params`, `url`). Cast as `unknown as APIContext`. Define a per-file `makeContext(options?)` helper.
- **Coverage rule**: every route under test must have cases for: null client → 500, unauthorized (null user) → 401, Supabase error → 500, not-found → 404, and happy path → 200.
- **Discriminated union pattern**: `.single()` uses PGRST116 (`error.code === "PGRST116"`) for not-found. DELETE without `.single()` returns an array — check `data.length === 0` for not-found. After an `if (error)` guard, TypeScript narrows `data` to non-null — remove any `?? []` or `!data` checks that would become dead code.
- **AI failure assertion**: when `generateEnemies` mock is set to reject, assert both the 500 response and that `supabase.from` was never called with `"enemies"` — proves no DB write on AI failure.

### 6.3 Adding an auth flow integration test

TBD — see §3 Phase 2. Pattern: redirect validation logic (external domain blocked); null client returns error; cover the failure paths the lessons.md records as having been burned.

### 6.4 Adding an ownership boundary test

TBD — see §3 Phase 3. Pattern: two-user setup; call route with User A credentials + User B's resource ID; assert 404.

### 6.5 Adding a test for a new API route (general rule)

TBD — see §3 Phase 1 + Phase 3. Pattern: integration preferred; check response status for all three Supabase outcomes (error → 500, no row → 404, row changed → 200 + data); assert error body is user-safe.

### 6.6 Per-rollout-phase notes

(Appended by `/10x-implement` after each phase ships.)

---

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Landing page and purely visual UI components** — zero business logic; snapshot / E2E cost would not catch real regressions. Re-evaluate if the landing page gains interactive logic or gated content. (Source: Phase 2 interview Q5.)
- **Generated TypeScript types / Zod schema shape (structural)** — the schema definition is the test; asserting its structure is an implementation mirror. Only test the *range constraints* and *business rules* inside the schema, not the shape. (Source: §1 principle #1, cost × signal.)
- **Internal Supabase client internals** — Supabase's own SDK is tested by its maintainers. Mock at the module boundary, not at the internals. (Source: §1 principle #1.)

---

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-04
- Stack versions last verified: 2026-06-04
- AI-native tool references last verified: 2026-06-04

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
