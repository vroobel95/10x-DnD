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
