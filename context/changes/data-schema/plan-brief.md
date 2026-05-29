# Data Schema — Plan Brief

> Full plan: `context/changes/data-schema/plan.md`

## What & Why

Deploy the three core data tables (`campaigns`, `battles`, `enemies`) with RLS and a TypeScript type layer — so every downstream slice has a secure, typed data foundation to build on. Without this, S-01 (battle creation), S-02 (AI generation + confirmation), and S-03 (edit/remove) cannot be implemented. This is F-01 in the roadmap: the first and only prerequisite-free foundation change.

## Starting Point

The Supabase client exists and auth is complete, but there is no application schema — `supabase/migrations/` does not exist, no tables have been created, and `src/types.ts` is absent. The codebase is at the auth-only stage from the starter template.

## Desired End State

Three tables are live in Supabase with RLS active, a DB trigger auto-creates a default campaign for every new user (so GMs land directly in the generator without manual setup), and `src/types.ts` exports typed entity interfaces that downstream API routes and components import directly.

## Key Decisions Made

| Decision                  | Choice                                                                   | Why (1 sentence)                                                                      | Source |
| ------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------ |
| Stat block storage        | Free-form JSONB column (`stats`)                                         | Avoids locking in a schema before the AI prompt shape is designed in S-02             | Plan   |
| Enemy lifecycle           | `pending` → `confirmed`; denied = deleted                                | Keeps the table clean while supporting the confirm/deny UX without a third enum value | Plan   |
| Default campaign creation | DB trigger (`AFTER INSERT ON auth.users`)                                | Guarantees the campaign exists before any app code runs, regardless of signup path    | Plan   |
| Battle fields             | name + party_level + location                                            | GM-provided context that may pre-populate generation prompts in S-02                  | Plan   |
| Deletion strategy         | Hard delete with CASCADE                                                 | Sufficient for this data volume; FR-009 doesn't require undo beyond the session       | Plan   |
| RLS ownership model       | `user_id` on campaigns only; FK-chain subqueries for battles and enemies | User preference — avoids denormalizing `user_id` into child tables                    | Plan   |
| TypeScript types          | Manual interfaces in `src/types.ts` now                                  | Gives S-01 type safety without requiring a running local Supabase instance            | Plan   |

## Scope

**In scope:**

- `supabase/migrations/20260527000001_create_campaigns.sql` — table + RLS + auto-campaign trigger
- `supabase/migrations/20260527000002_create_battles.sql` — table + RLS (FK-chain)
- `supabase/migrations/20260527000003_create_enemies.sql` — enum + table + RLS (two-hop FK-chain)
- `src/types.ts` — `Campaign`, `Battle`, `Enemy`, `EnemyStatus` TypeScript types

**Out of scope:**

- Supabase-generated TypeScript DB types (`supabase gen types typescript`) — deferred to S-01
- `updated_at` auto-update triggers — set by application on write
- CHECK constraint on `stats` JSONB — intentionally free-form
- Campaign management UI or CRUD endpoints (FR-001 parked)
- Soft-delete columns

## Architecture / Approach

Three migration files applied in dependency order (campaigns → battles → enemies). Ownership flows through a single `user_id UUID` on `campaigns`; all RLS checks for child tables traverse the FK chain via `EXISTS` subqueries. The `create_default_campaign` Postgres function is `SECURITY DEFINER` and fires immediately after `auth.users` insert. TypeScript types in `src/types.ts` are hand-authored to match the schema — no code generation required.

## Phases at a Glance

| Phase                         | What it delivers                                                      | Key risk                                                                                    |
| ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1. Database Schema Migrations | Three tables with RLS + auto-campaign trigger deployed via migrations | FK-chain RLS policies are complex SQL — a subtle bug silently allows cross-user data access |
| 2. TypeScript Entity Types    | `src/types.ts` with four exported types                               | Types drift from schema if the migration is later amended without updating the file         |

**Prerequisites:** Supabase project configured (local or remote) with `SUPABASE_URL` and `SUPABASE_KEY` in `.env` / `.dev.vars`  
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- The `SECURITY DEFINER` trigger runs as the function owner (migration author) — if the Supabase project's service role lacks permission to insert into `campaigns`, the trigger will fail silently on signup
- FK-chain RLS on enemies requires a two-hop JOIN; at higher data volumes this could be slow — acceptable for MVP scale but worth revisiting if the app grows

## Success Criteria (Summary)

- Signing up a new user automatically produces a `campaigns` row with the correct `user_id`
- A user querying `battles` or `enemies` belonging to another user receives zero rows
- `Campaign`, `Battle`, `Enemy` types are importable from `@/types` with no TypeScript errors
