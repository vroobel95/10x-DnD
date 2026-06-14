# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Sanitize external service errors before exposing to users

- **Context**: src/pages/api/battles.ts:55, src/pages/api/auth/signin.ts, src/pages/api/auth/signup.ts
- **Problem**: Raw Supabase error.message is forwarded into redirect URL params and rendered to the user via the ServerError component. These messages can contain internal schema details (table names, column names, constraint names) that aid attackers in mapping the database.
- **Rule**: Never pass raw third-party error messages to end users
- **Applies to**: All API routes that surface errors to the UI

## Extract shared data-access helpers to avoid query duplication

- **Context**: src/pages/api/battles.ts:15, :72; src/pages/battles/index.astro:13
- **Problem**: The campaign lookup query (.from("campaigns").select("id").eq("user_id", user.id).limit(1).single()) is duplicated in 3 locations. If lookup semantics change (e.g., multi-campaign support, different error handling), all 3 must be updated in lockstep.
- **Rule**: When the same Supabase query appears in 2+ locations, extract a shared helper
- **Applies to**: All data-access patterns across API routes and Astro pages

## Never silently swallow fetch errors in UI action handlers

- **Context**: src/components/battles/EnemiesSection.tsx:45-68
- **Problem**: When the PATCH (confirm) or DELETE (deny) fetch returns a non-ok response, the error is silently swallowed — the loading state clears and the UI reverts with no feedback to the user. The generate handler in the same component correctly checks `!res.ok` and displays an error. Inconsistent error handling means users can't tell whether an action failed or just didn't take effect.
- **Rule**: Every fetch-based action handler must check the response status and surface failures to the user
- **Applies to**: All React components with fetch-based mutation handlers

## Separate DB errors from not-found cases in Supabase mutation routes

- **Context**: src/pages/api/enemies/[id].ts:45-47, 60-62
- **Problem**: PATCH branches use `if (result.error || !result.data)` and return 404 "Enemy not found" for both a real Supabase error (network/schema failure) and a missing row. The DELETE branch in the same file correctly separates these two cases into 500 vs. 404 — PATCH did not follow suit.
- **Rule**: Always split `result.error` (→ 500) from `!result.data` (→ 404) in Supabase mutation responses; never collapse them into a single branch that returns 404 for both cases
- **Applies to**: All API routes that perform a Supabase `.update()` or `.delete()` and then inspect the result

## Fail fast on missing required secrets instead of passing empty defaults

- **Context**: src/lib/ai.ts:19
- **Problem**: When ANTHROPIC_API_KEY is undefined, the code passes an empty string to createAnthropic({ apiKey: '' }). This causes an opaque Anthropic auth error at request time instead of a clear message at function entry. The env field is marked optional: true in astro.config.mjs, so undefined is a valid runtime state.
- **Rule**: When a function requires a secret/env var, guard at the top with a clear error instead of falling back to empty strings
- **Applies to**: All functions that consume secrets or env vars

## Confirm row deletion before returning success on DELETE endpoints

- **Context**: src/pages/api/campaigns/[id].ts:62 vs src/pages/api/battles/[id]/index.ts:19
- **Problem**: Supabase `.delete()` without `.select().single()` returns no error when zero rows match, so the endpoint reports `{success: true}` even when nothing was deleted. The battle DELETE endpoint correctly uses `.select("id").single()` to confirm a row was actually removed.
- **Rule**: Always chain `.select("id").single()` after `.delete()` and check `!data` to return 404 for non-existent or unauthorized resources
- **Applies to**: All API DELETE endpoints using Supabase

## Validate redirect targets to prevent open redirects

- **Context**: src/pages/api/auth/callback.ts:6,14
- **Problem**: The `next` query parameter is read and used directly in `context.redirect(next)` without validation. An attacker can craft a callback URL with `next=https://evil.com` to redirect users off-site after a successful auth code exchange. This is a classic open redirect (OWASP).
- **Rule**: Never redirect to a URL taken from user-controlled input without validation. Validate that the target is a relative path (starts with `/` and does not start with `//`) before using it; otherwise fall back to a safe default (e.g., `/`)
- **Applies to**: All API routes and auth callbacks that read a redirect target from query parameters, request body, or cookies

## Guard against null Supabase client instead of falling through to success

- **Context**: src/pages/api/auth/forgot-password.ts:12-26, src/pages/api/auth/reset-password.ts:21-32
- **Problem**: When `createClient` returns null (Supabase misconfigured), the `if (supabase) { ... }` pattern silently skips the Supabase call and falls through to a success redirect. On the forgot-password route this shows "check your email" when no email was sent; on the reset-password route this shows "Password updated" when nothing changed — locking the user out.
- **Rule**: Treat a null return from `createClient` as a fatal misconfiguration — return a 500 error immediately rather than silently skipping the Supabase call and falling through to a success response
- **Applies to**: All API routes that call `createClient()` before performing any Supabase operation

## Pre-delete cleanup of non-FK companion columns is inherently non-atomic

- **Context**: src/pages/api/enemies/[id].ts:149–155
- **Problem**: The DELETE handler clears `main_enemy_profile` (JSONB) before deleting the enemy row, because the FK cascade only clears `main_enemy_id` — not arbitrary JSONB columns. This order is the only viable approach, but if the cleanup succeeds and the delete then fails, the battle loses its villain reference while the enemy still exists. If the cleanup fails but the delete is not blocked, `main_enemy_profile` can remain orphaned after the cascade clears `main_enemy_id`. Both are edge cases but neither is detectable at the API layer.
- **Rule**: When a non-blocking pre-delete cleanup targets a non-FK companion field, add a comment documenting the orphan-data risk and why the delete order was chosen. If atomicity matters, escalate to a DB-level trigger or RPC transaction.
- **Applies to**: All DELETE handlers that must clear non-FK JSONB or text columns alongside a FK-constrained column before the main delete.
