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
- **Rule**: [fill in — e.g. "Always split `result.error` (→ 500) from `!result.data` (→ 404) in Supabase mutation responses; never collapse them into a single 404"]
- **Applies to**: [fill in — e.g. "All API routes that perform Supabase update/delete and check the result"]

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
- **Rule**: [fill in]
- **Applies to**: [fill in]

## Guard against null Supabase client instead of falling through to success

- **Context**: src/pages/api/auth/forgot-password.ts:12-26, src/pages/api/auth/reset-password.ts:21-32
- **Problem**: When `createClient` returns null (Supabase misconfigured), the `if (supabase) { ... }` pattern silently skips the Supabase call and falls through to a success redirect. On the forgot-password route this shows "check your email" when no email was sent; on the reset-password route this shows "Password updated" when nothing changed — locking the user out.
- **Rule**: [fill in]
- **Applies to**: [fill in]
