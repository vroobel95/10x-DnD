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
