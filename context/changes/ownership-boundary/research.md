---
date: 2026-06-06T00:00:00+02:00
researcher: Claude Sonnet 4.6
git_commit: 11928f7cf1f546aca922ccc1cca4b6f5369716e8
branch: main
repository: 10x-DnD
topic: "Ownership boundary — Risk #5 (IDOR) and Risk #6 (error message safety) for test rollout Phase 3"
tags: [research, security, idor, ownership, error-safety, integration-tests, rls]
status: complete
last_updated: 2026-06-06
last_updated_by: Claude Sonnet 4.6
---

# Research: Ownership Boundary (IDOR + Error Safety)

**Date**: 2026-06-06  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: 11928f7cf1f546aca922ccc1cca4b6f5369716e8  
**Branch**: main  
**Repository**: vroobel95/10x-DnD

## Research Question

What is the current state of ownership enforcement and error message safety across all API routes, and what must change to enable Phase 3 of the test rollout (Risks #5 and #6)?

---

## Summary

Two API routes have no app-level ownership check and rely entirely on Supabase RLS: `enemies/[id].ts` (PATCH/DELETE) and `battles/[id]/generate.ts` (POST). Mock-based integration tests cannot enforce RLS, so IDOR tests for these routes are impossible without first adding app-level guards. All other application routes already have explicit user-scoped filters.

Two auth routes expose raw Supabase `error.message` in redirect URL params: `signin.ts:16` and `signup.ts:21`. All application routes (campaigns, battles, enemies) return only sanitized generic messages.

Both gaps are explicitly called out in `lessons.md`. The RLS-only pattern in enemies was a deliberate decision (accepted in the `enemy-post-confirm-management` impl-review with a noted blind spot). The raw error forwarding in auth routes was identified as a pre-existing pattern in the `create-battle` impl-review and promoted to a lessons.md rule — but never fixed in `signin.ts` or `signup.ts`.

---

## Detailed Findings

### Ownership Pattern — Route-by-Route Audit

| Route | Method(s) | Ownership pattern | Key lines |
|---|---|---|---|
| `campaigns/index.ts` | GET | App-level: `getUserCampaigns(supabase, user.id)` | 19 |
| `campaigns/index.ts` | POST | App-level: insert with `user_id: user.id` | 60 |
| `campaigns/[id].ts` | PATCH | App-level: `.eq("user_id", user.id)` in UPDATE | 42–43 |
| `campaigns/[id].ts` | DELETE | App-level: `.eq("user_id", user.id)` in DELETE | 70 |
| `battles.ts` | GET | Indirect: campaign ownership check via `.eq("user_id", user.id)` | 105–110 |
| `battles.ts` | POST | Indirect: campaign ownership check via `.eq("user_id", user.id)` | 22–27 |
| `battles/[id]/index.ts` | DELETE | Indirect: fetch campaign IDs for user, then `.in("campaign_id", ...)` | 19–26, 38 |
| `battles/[id]/generate.ts` | POST | **RLS-only** — battle fetched by ID only, no user scope | 34 |
| `enemies/[id].ts` | PATCH | **RLS-only** — comment at line 34: "Ownership enforced by RLS" | 34, 42, 58 |
| `enemies/[id].ts` | DELETE | **RLS-only** — comment at line 86: "Ownership enforced by RLS" | 86–87 |
| `auth/*` | — | N/A — no user-owned resource | — |

**The two RLS-only application routes are the IDOR risk surface.** All other application routes have app-level user scoping. Auth routes have no resource-ownership surface.

### Error Message Safety — Route-by-Route Audit

| Route | Exposes raw error.message? | Evidence |
|---|---|---|
| `campaigns/index.ts` | No | Generic strings only |
| `campaigns/[id].ts` | No | Generic strings only |
| `battles.ts` | No | Generic strings only |
| `battles/[id]/index.ts` | No | Generic strings only |
| `battles/[id]/generate.ts` | No | Generic strings only |
| `enemies/[id].ts` | No | Generic strings only |
| `auth/signin.ts` | **YES** | `error=${encodeURIComponent(error.message)}` at line 16 |
| `auth/signup.ts` | **YES** | `error=${encodeURIComponent(error.message)}` at line 21 |
| `auth/callback.ts` | No | Generic string at line 18 |
| `auth/forgot-password.ts` | No | Status-code branching (429/5xx), generic messages |
| `auth/reset-password.ts` | No | Generic string at line 37 |
| `auth/recovery-callback.ts` | No | Generic string at line 19 |

**Exactly two routes expose raw errors, both are auth routes, both were already identified in `lessons.md`.**

### enemies/[id].ts — RLS-Only Pattern Detail

Lines 34 and 57 carry inline comments explicitly documenting the delegation:

> "Ownership enforced by RLS: enemies → battles → campaigns → auth.uid() (20260527000003_create_enemies.sql)"

The route applies no `.eq("user_id", ...)` or `.in("battle_id", ...)` filter. The `.update()` and `.delete()` chains use only `.eq("id", context.params.id)`. The same is true of the DELETE at line 87.

The enemy table lacks a direct `user_id` column. The ownership chain is: `enemies.battle_id → battles.campaign_id → campaigns.user_id`. Adding an app-level check requires traversing two hops — consistent with the `battles/[id]/index.ts` indirect-ownership pattern (campaigns → battles).

### battles/[id]/generate.ts — RLS-Only Pattern Detail

Line 34:
```
supabase.from("battles").select("id, party_level, location").eq("id", battleId).single()
```

No `campaign_id` in the select, no campaign ownership check. The route verifies the battle exists (PGRST116 → 404 at lines 37–39) but does not verify the battle belongs to the authenticated user's campaign. Any authenticated GM can POST to this endpoint with any battle ID in the system.

`battles.ts` POST (lines 22–27) and GET (lines 105–110) both do the campaign ownership check correctly — `generate.ts` is the outlier. The `battles/[id]/index.ts` DELETE resolved an analogous gap (see historical context below).

### Existing Test Infrastructure

All integration tests live under `tests/integration/api/`. Pattern established in Phase 1 and 2 of the test rollout:

- `vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }))` at module top
- `makeSupabaseMock(tableResults)` from `tests/helpers/supabase.ts` — keyed by table name; returns the same result for every `.from("tableName")` call regardless of chain
- Per-file `makeContext(options?)` helper — inline, not shared
- `makeAuthClientMock(results?)` from `tests/helpers/auth.ts` — for `supabase.auth.*` methods

**No test currently uses a two-user setup.** All tests use a single `{ id: "user-1" }` user. IDOR simulation is not "create two real users" but "configure the mock to return no matching row for the ownership lookup" — the 404 comes from the route's existing not-found branch.

**Mock-compatibility constraint for ownership pre-checks:** `makeSupabaseMock` returns the same data for every call to `from("tableName")`. Adding a campaigns → battles ownership pre-check to `enemies/[id].ts` means the mock needs `campaigns` and `battles` keys configured. Every existing `enemies-id.test.ts` test that reaches the enemy operation breaks until those keys are added. Same for `battles-generate.test.ts` when `campaigns` key is required.

9 existing integration test files:
- `battles.test.ts`, `battles-id.test.ts`, `battles-generate.test.ts`
- `campaigns-id.test.ts`
- `enemies-id.test.ts`
- `auth-callback.test.ts`, `auth-recovery-callback.test.ts`, `auth-forgot-password.test.ts`, `auth-reset-password.test.ts`

Missing: no `auth-signin.test.ts`, no `auth-signup.test.ts`.

---

## Code References

- [`src/pages/api/enemies/[id].ts:34`](https://github.com/vroobel95/10x-DnD/blob/11928f7cf1f546aca922ccc1cca4b6f5369716e8/src/pages/api/enemies/%5Bid%5D.ts#L34) — RLS-only comment (PATCH stats path)
- [`src/pages/api/enemies/[id].ts:57`](https://github.com/vroobel95/10x-DnD/blob/11928f7cf1f546aca922ccc1cca4b6f5369716e8/src/pages/api/enemies/%5Bid%5D.ts#L57) — RLS-only comment (PATCH confirm path)
- [`src/pages/api/enemies/[id].ts:86-87`](https://github.com/vroobel95/10x-DnD/blob/11928f7cf1f546aca922ccc1cca4b6f5369716e8/src/pages/api/enemies/%5Bid%5D.ts#L86) — RLS-only comment + DELETE query
- [`src/pages/api/battles/[id]/generate.ts:34`](https://github.com/vroobel95/10x-DnD/blob/11928f7cf1f546aca922ccc1cca4b6f5369716e8/src/pages/api/battles/%5Bid%5D/generate.ts#L34) — battle fetch with no user scope
- [`src/pages/api/auth/signin.ts:16`](https://github.com/vroobel95/10x-DnD/blob/11928f7cf1f546aca922ccc1cca4b6f5369716e8/src/pages/api/auth/signin.ts#L16) — raw `error.message` in redirect
- [`src/pages/api/auth/signup.ts:21`](https://github.com/vroobel95/10x-DnD/blob/11928f7cf1f546aca922ccc1cca4b6f5369716e8/src/pages/api/auth/signup.ts#L21) — raw `error.message` in redirect
- [`src/pages/api/battles/[id]/index.ts:19-26`](https://github.com/vroobel95/10x-DnD/blob/11928f7cf1f546aca922ccc1cca4b6f5369716e8/src/pages/api/battles/%5Bid%5D/index.ts#L19) — reference indirect ownership pattern (campaigns → `.in("campaign_id", ...)`)
- [`src/pages/api/campaigns/[id].ts:42-43`](https://github.com/vroobel95/10x-DnD/blob/11928f7cf1f546aca922ccc1cca4b6f5369716e8/src/pages/api/campaigns/%5Bid%5D.ts#L42) — reference direct ownership pattern (`.eq("user_id", user.id)`)
- [`context/foundation/lessons.md:5-10`](context/foundation/lessons.md) — established rule: sanitize external service errors
- [`tests/helpers/supabase.ts`](https://github.com/vroobel95/10x-DnD/blob/11928f7cf1f546aca922ccc1cca4b6f5369716e8/tests/helpers/supabase.ts) — `makeSupabaseMock` contract
- [`tests/helpers/auth.ts`](https://github.com/vroobel95/10x-DnD/blob/11928f7cf1f546aca922ccc1cca4b6f5369716e8/tests/helpers/auth.ts) — `makeAuthClientMock` contract

---

## Architecture Insights

### Three ownership patterns in the codebase

1. **Direct** (`campaigns/[id].ts`): `.eq("user_id", user.id)` added directly to the query on the target table — the table has a `user_id` column.

2. **Indirect / two-hop** (`battles.ts`, `battles/[id]/index.ts`): target table has no `user_id`; route first fetches user's campaign IDs, then filters target table via `.in("campaign_id", campaignIds)`.

3. **RLS-only** (`enemies/[id].ts`, `generate.ts`): no app-level filter; ownership delegated entirely to Supabase RLS policy. Accepted as a deliberate decision in the `enemy-post-confirm-management` impl-review, but acknowledged as a single point of failure.

### Ownership chain for enemies (three hops)

`enemies.battle_id` → `battles.campaign_id` → `campaigns.user_id`

Adding an app-level check requires the indirect pattern extended one more level: fetch campaign IDs (campaigns query) → fetch battle IDs (battles query filtered by `.in("campaign_id", campaignIds)`) → add `.in("battle_id", battleIds)` to enemy operation. Three queries total. This mirrors `battles/[id]/index.ts` with one extra hop.

### Ownership chain for generate (two hops, same as battles)

`battles.campaign_id` → `campaigns.user_id`

The battle SELECT at `generate.ts:34` already returns the battle row. Adding `campaign_id` to the select fields enables a follow-up single-row campaign ownership check: `.eq("id", battle.campaign_id).eq("user_id", user.id).single()` — same pattern `battles.ts:POST` already uses at lines 22–27.

### Mock-layer implication

`makeSupabaseMock` is table-keyed. Adding upstream ownership queries means new table keys in the mock config. Every test that exercises a code path past the ownership check must configure those keys. This is a **planned breaking change** to existing test files — not a defect in the approach.

---

## Historical Context

### enemy-post-confirm-management impl-review — RLS-only accepted with noted blind spot

`context/changes/enemy-post-confirm-management/reviews/impl-review.md` (Finding F2, WARNING)

The reviewer flagged both PATCH and DELETE for RLS-only ownership. The fix applied was "Accept RLS-only with inline comment." Reasoning: "High confidence — RLS is currently active and correctly wired." The noted blind spot:

> "Future maintainer who changes createClient (e.g. service role key) will bypass ownership silently."

This impl-review explicitly acknowledged the gap and chose to accept it. The ownership-boundary phase closes it by adding app-level checks.

### campaign-management impl-review — defense-in-depth shift

`context/changes/campaign-management/reviews/impl-review.md` (Finding F3, WARNING)

Four routes were flagged for RLS-only: `campaigns/[id].astro:18`, `battles/[id]/index.ts:19`, `battles.ts:54`, `battles.ts:91`. Fix applied: add ownership checks to all four. This established the codebase's shift toward defense-in-depth. `generate.ts` was not in that list — it remains the outlier.

### create-battle impl-review — raw error messages identified

`context/changes/create-battle/reviews/impl-review.md` (Finding F4, OBSERVATION)

Raw `error.message` forwarding into redirect URLs flagged as a pre-existing pattern from auth routes. Promoted to `lessons.md` rule. However, `signin.ts` and `signup.ts` were never fixed after the rule was established — the lessons.md entry lists them as contexts but no follow-up change was opened.

---

## Related Research

- `context/foundation/lessons.md` — team's accepted rules; "Sanitize external service errors" and "Separate DB errors from not-found cases" directly relevant
- `context/changes/enemy-post-confirm-management/reviews/impl-review.md` — prior decision to accept RLS-only for enemies
- `context/changes/campaign-management/reviews/impl-review.md` — defense-in-depth shift and how indirect ownership was added to battles routes

---

## Open Questions

None. All route patterns confirmed. The plan for `ownership-boundary` can proceed directly to implementation.
