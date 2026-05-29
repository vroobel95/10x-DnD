# Data Schema Implementation Plan

## Overview

Deploy the three core data tables — `campaigns`, `battles`, and `enemies` — via Supabase migrations with RLS enabled, a DB trigger to auto-create a default campaign on signup, and TypeScript entity types in `src/types.ts`. This is foundation change F-01; every downstream slice (S-01 create-battle, S-02 first-gated-generation, S-03 enemy-post-confirm-management) depends on this layer.

## Current State Analysis

No migrations exist today — `supabase/migrations/` does not exist. The Supabase client (`src/lib/supabase.ts`) is untyped and auth-only. `src/types.ts` does not exist. Auth is complete and `context.locals.user` carries the authenticated Supabase `User` with a UUID `id` that RLS policies will reference via `auth.uid()`.

## Desired End State

Three tables exist in the Supabase schema (`campaigns`, `battles`, `enemies`) with correct foreign keys, RLS enabled and policies active, and a `create_default_campaign` trigger firing on every new `auth.users` row. `src/types.ts` exports `Campaign`, `Battle`, `Enemy`, and `EnemyStatus` TypeScript types that exactly mirror the schema. Running `supabase db push` (or `supabase migration up`) applies all migrations cleanly with no errors.

### Key Discoveries:

- `supabase/migrations/` must be created from scratch — no prior migrations to build on
- `src/lib/supabase.ts` uses `@supabase/ssr` server client with no DB type parameter; the typed generic can be added later in S-01 once `supabase gen types typescript` is feasible
- `src/types.ts` does not yet exist — it will be created in Phase 2
- Supabase `config.toml` has `project_id = "10x-astro-starter"` (starter default) — no migration state to conflict with
- AGENTS.md migration convention: `YYYYMMDDHHmmss_short_description.sql`
- The FK-chain RLS approach (user chose it): `user_id` only on `campaigns`; `battles` and `enemies` policies use `EXISTS` subqueries through the parent chain

## What We're NOT Doing

- No Supabase-generated TypeScript database types (`supabase gen types typescript`) — that requires a running local instance and is deferred to S-01 when the first API route is written
- No views, functions, or stored procedures beyond the auto-campaign trigger
- No `updated_at` auto-update trigger — `updated_at` is set by the application on write (keep schema minimal)
- No check constraint on the `stats` JSONB column — shape is intentionally free-form to avoid locking in the structure before the AI prompt is designed in S-02
- No soft-delete columns (`deleted_at`) — hard deletes only, cascading through FK relationships
- No campaign management UI or CRUD endpoints — FR-001 is nice-to-have and parked; the DB layer auto-creates the one default campaign a GM needs

## Implementation Approach

Three sequential migration files (one per table), each self-contained: table creation, RLS enable, and policies in the same file. The campaigns migration also contains the `create_default_campaign` trigger function. All migrations use `IF NOT EXISTS` guards so re-running is safe. Phase 2 creates the TypeScript types file that mirrors the schema exactly.

## Critical Implementation Details

- **RLS for battles and enemies uses EXISTS subqueries** — the chosen ownership model places `user_id` only on `campaigns`. Battles policies must JOIN `campaigns`; enemies policies must JOIN through `battles` then `campaigns`. Both use `EXISTS (SELECT 1 FROM ... WHERE ... AND campaigns.user_id = auth.uid())`. Any deviation (e.g., using `IN` instead of `EXISTS`, or joining in the wrong direction) will silently allow cross-user data access.
- **Trigger function must be `SECURITY DEFINER`** — `create_default_campaign` inserts into `campaigns` immediately after a row is inserted into `auth.users`. Without `SECURITY DEFINER`, the function runs as the newly-created user who has no `INSERT` permission on `campaigns` yet (RLS is not yet satisfied).

---

## Phase 1: Database Schema Migrations

### Overview

Create `supabase/migrations/` and three migration files. Migration 1 creates the `campaigns` table with RLS and the auto-campaign trigger. Migration 2 creates `battles`. Migration 3 creates the `enemy_status` enum and `enemies` table.

### Changes Required:

#### 1. Campaigns migration

**File**: `supabase/migrations/20260527000001_create_campaigns.sql`

**Intent**: Create the `campaigns` table as the top-level ownership container for a GM's data. Enable RLS with a single all-operations policy (`FOR ALL`) keyed on `user_id = auth.uid()`. Create the `create_default_campaign` trigger function and bind it to `auth.users` so every new user gets one campaign immediately.

**Contract**: Table columns: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `name TEXT NOT NULL DEFAULT 'Default Campaign'`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`. RLS policy: `FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`. Trigger function is `SECURITY DEFINER`, inserts `(NEW.id, 'Default Campaign')`, fires `AFTER INSERT ON auth.users FOR EACH ROW`.

#### 2. Battles migration

**File**: `supabase/migrations/20260527000002_create_battles.sql`

**Intent**: Create the `battles` table as the container for a GM's generated enemies within a campaign. Enable RLS with FK-chain ownership check through the parent `campaigns` table.

**Contract**: Table columns: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE`, `name TEXT NOT NULL`, `party_level INTEGER`, `location TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`. RLS policy uses `EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = battles.campaign_id AND campaigns.user_id = auth.uid())` for both `USING` and `WITH CHECK`.

#### 3. Enemies migration

**File**: `supabase/migrations/20260527000003_create_enemies.sql`

**Intent**: Create the `enemy_status` enum and `enemies` table to store AI-generated D&D 5e stat blocks, their confirmation status, and their association to a battle. Enable RLS via two-hop FK chain (enemies → battles → campaigns).

**Contract**: Enum: `CREATE TYPE enemy_status AS ENUM ('pending', 'confirmed')`. Table columns: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE`, `name TEXT NOT NULL`, `status enemy_status NOT NULL DEFAULT 'pending'`, `stats JSONB`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`. RLS policy uses `EXISTS (SELECT 1 FROM battles JOIN campaigns ON campaigns.id = battles.campaign_id WHERE battles.id = enemies.battle_id AND campaigns.user_id = auth.uid())` for both `USING` and `WITH CHECK`.

### Success Criteria:

#### Automated Verification:

- All three migration files exist under `supabase/migrations/` with correct naming
- `npx supabase db push` (or `npx supabase migration up` for local) applies all three without errors
- `npx supabase db lint` reports no policy warnings or schema issues (if available)

#### Manual Verification:

- In Supabase Studio (local or remote): `campaigns`, `battles`, and `enemies` tables are visible with correct columns and types
- RLS is shown as "enabled" on all three tables
- Policy list on each table shows the expected policy names and conditions
- Sign up a new test user → a `campaigns` row appears with `user_id` matching the new user's UUID and `name = 'Default Campaign'`
- Querying `battles` or `enemies` as a different user (via Supabase Studio role switching or test) returns zero rows

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation that the Supabase Studio checks above pass before proceeding to Phase 2. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes live in the `## Progress` section at the bottom.

---

## Phase 2: TypeScript Entity Types

### Overview

Create `src/types.ts` with TypeScript interfaces and a union type that exactly mirror the DB schema. Downstream slices can import these types to write typed Supabase queries without waiting for `supabase gen types typescript`.

### Changes Required:

#### 1. Entity types file

**File**: `src/types.ts`

**Intent**: Define `EnemyStatus`, `Campaign`, `Battle`, and `Enemy` TypeScript types as the shared contract between the database schema and application code. These types are what API routes and components import — no inline type definitions in feature files.

**Contract**: `EnemyStatus = 'pending' | 'confirmed'`. Each entity interface mirrors its table: `Campaign` has `id`, `user_id`, `name`, `created_at`, `updated_at` (all `string`). `Battle` has `id`, `campaign_id`, `name`, `party_level: number | null`, `location: string | null`, `created_at`, `updated_at`. `Enemy` has `id`, `battle_id`, `name`, `status: EnemyStatus`, `stats: Record<string, unknown> | null`, `created_at`, `updated_at`. All UUID and timestamp columns are typed as `string` (Supabase JS client returns them as strings).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with no errors on `src/types.ts`
- TypeScript compilation (`npx tsc --noEmit`) reports no errors

#### Manual Verification:

- Importing `Campaign`, `Battle`, `Enemy`, `EnemyStatus` from `@/types` in a scratch file works without IDE errors
- Each type's fields match the columns defined in the Phase 1 migrations (cross-check manually)

---

## Testing Strategy

### Manual Testing Steps:

1. Start Supabase locally (`npx supabase start`) and run migrations (`npx supabase db push` or `npx supabase migration up`)
2. Open Supabase Studio at `http://localhost:54323` and verify all three tables, RLS status, and policies
3. Sign up a new user via the app's sign-up page → check the `campaigns` table for an auto-created row
4. Attempt to read another user's campaign rows via a direct SQL query in Studio with a different `auth.uid()` — should return zero rows
5. Import types from `@/types` in a temporary scratch file and verify IDE autocomplete works for all fields

## Migration Notes

Migrations must be applied in order (1 → 2 → 3) due to FK dependencies. If applying to an existing Supabase project that has stale state, run `supabase db reset` locally first. For remote/production deployment, `supabase db push` handles ordering automatically.

## References

- Roadmap: F-01 in `context/foundation/roadmap.md`
- PRD functional requirements: FR-002, FR-005, FR-007, FR-009 in `context/foundation/prd.md`
- Supabase client: `src/lib/supabase.ts`
- Supabase config: `supabase/config.toml`
- AGENTS.md migration naming convention: `YYYYMMDDHHmmss_short_description.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Schema Migrations

#### Automated

- [x] 1.1 All three migration files exist under `supabase/migrations/` with correct naming — 32b9717
- [x] 1.2 `npx supabase db push` applies all three without errors — 32b9717
- [x] 1.3 `npx supabase db lint` reports no policy warnings or schema issues — 32b9717

#### Manual

- [x] 1.4 `campaigns`, `battles`, and `enemies` tables visible in Supabase Studio with correct columns and types — 32b9717
- [x] 1.5 RLS shown as "enabled" on all three tables with correct policy conditions — 32b9717
- [x] 1.6 New user signup triggers auto-creation of a `campaigns` row with matching `user_id` — 32b9717
- [x] 1.7 Cross-user RLS isolation verified — querying as a different user returns zero rows — 32b9717

### Phase 2: TypeScript Entity Types

#### Automated

- [x] 2.1 `npm run lint` passes with no errors on `src/types.ts` — ed3aa62
- [x] 2.2 `npx tsc --noEmit` reports no TypeScript errors — ed3aa62

#### Manual

- [x] 2.3 `Campaign`, `Battle`, `Enemy`, `EnemyStatus` importable from `@/types` without IDE errors — ed3aa62
- [x] 2.4 Type fields cross-checked against Phase 1 migration columns — no mismatches — ed3aa62
