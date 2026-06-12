# Battle Environment Generation — Implementation Plan

## Overview

Add AI-generated atmospheric environment descriptions to battles. When a GM clicks "Generate Environment," Claude produces 5 short narrative strings (terrain, lighting, hazards, ambiance, trivia) and persists them to the `battles` table. The environment is displayed between the battle header badges and the enemies list, and is automatically injected into future enemy generation prompts for that battle.

## Current State Analysis

- `battles` table has `id`, `campaign_id`, `name`, `party_level`, `location`, `created_at`, `updated_at` — no environment column
- `src/types.ts:16-24` — `Battle` interface mirrors the schema; needs `environment` field added
- `src/lib/ai.ts:15-37` — `generateEnemies()` follows the Vercel AI SDK pattern (`generateText` + `Output.object` + Zod schema); `generateEnvironment` will follow the exact same pattern
- `src/pages/api/battles/[id]/generate.ts` — complete template for the environment endpoint: auth check, null-client guard, ownership 2-hop check, AI call, Supabase write, sanitised error responses
- `src/pages/battles/[id].astro:44-81` — battle page shows metadata badges then `<EnemiesSection client:load />`; new `<EnvironmentSection client:load />` goes between them
- `src/lib/schemas/enemy.ts` — pattern for new `src/lib/schemas/environment.ts`

### Key Discoveries

- `supabase/migrations/20260527000002_create_battles.sql` defines the `battles` table; new migration must follow the `YYYYMMDDHHMMSS_<slug>.sql` timestamp convention
- `src/pages/api/battles/[id]/generate.ts:38` selects `id, party_level, location, campaign_id` — needs `environment` added so it can inject context into `generateEnemies`
- `src/lib/ai.ts:23-27` builds the prompt context by joining non-null parts — same pattern for environment injection
- Lessons.md: null Supabase client → 500 (not silent skip); raw error messages must never reach the user; every fetch handler must surface failures
- `src/components/battles/EnemiesSection.tsx` — reference pattern for loading state, error display, and `client:load` island wiring

## Desired End State

When a GM opens a battle that has a location set:
- A "Battle Environment" section appears between the metadata badges and the enemies list
- Clicking "Generate Environment" calls the AI and displays 5 atmospheric sub-fields (terrain, lighting, hazards, ambiance, trivia)
- The button is re-clickable to regenerate (overwrites previous output)
- When enemies are later generated, Claude receives the environment description as additional context
- The environment survives page refreshes (persisted to `battles.environment` JSONB column)

When no location is set: the Generate Environment button is visible but disabled with an explanatory tooltip.

## What We're NOT Doing

- D&D mechanical effects (difficult terrain rules, cover bonuses, hazard damage dice) — flavor text only
- Auto-generation on battle creation or location save — on-demand only
- Battle editing (adding/changing location after creation) — tracked separately on the roadmap
- Confirmation dialog before regeneration — free overwrite

## Implementation Approach

Extend the existing AI generation pattern (Zod schema → AI function → API endpoint → React island) with a parallel track for environment. The environment endpoint follows `generate.ts` exactly. The Zod schema follows `enemy.ts` exactly. The React island follows `EnemiesSection.tsx` in structure. After Phase 2, Phase 3 threads the environment data back through the existing enemy generation path with a minimal change to `ai.ts` and `generate.ts`.

## Phase 1: Data Layer

### Overview

Add the `environment` column to the database, define the Zod schema, and update the TypeScript `Battle` type.

### Changes Required

#### 1. Migration — add `environment` column

**File**: `supabase/migrations/20260611000001_add_battle_environment.sql`

**Intent**: Add a nullable JSONB column `environment` to `battles`. Nullable because existing battles have no environment and generation is on-demand.

**Contract**:
```sql
ALTER TABLE battles ADD COLUMN environment JSONB;
```

#### 2. Zod schema

**File**: `src/lib/schemas/environment.ts` (new file)

**Intent**: Define the validated shape of the AI-generated environment. Five required string fields — all enforced as non-empty so the AI can't produce a field with an empty string and have it pass validation.

**Contract**:
```ts
export const BattleEnvironmentSchema = z.object({
  terrain:  z.string().min(1),
  lighting: z.string().min(1),
  hazards:  z.string().min(1),
  ambiance: z.string().min(1),
  trivia:   z.string().min(1),
});
export type BattleEnvironment = z.infer<typeof BattleEnvironmentSchema>;
```

#### 3. TypeScript `Battle` interface

**File**: `src/types.ts`

**Intent**: Add `environment: BattleEnvironment | null` to the `Battle` interface so the rest of the codebase is type-safe when reading from Supabase.

**Contract**: Import `BattleEnvironment` from `@/lib/schemas/environment` and add the field after `location`.

### Success Criteria

#### Automated Verification

- Migration applies cleanly against local Supabase: `npx supabase db push` (or `supabase migration up`) without errors
- TypeScript compilation passes with no errors on `Battle` and its consumers: `npm run typecheck`

#### Manual Verification

- `battles` table in Supabase Studio shows the new `environment` column (JSONB, nullable)
- Existing battle records are unaffected (column is NULL for pre-existing rows)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Environment Generation — AI Function + API Endpoint

### Overview

Add `generateEnvironment()` to `src/lib/ai.ts` and wire up `POST /api/battles/[id]/environment` following the exact pattern of `generate.ts`.

### Changes Required

#### 1. System prompt + `generateEnvironment` function

**File**: `src/lib/ai.ts`

**Intent**: Add a new exported function `generateEnvironment` that takes the same battle context as `generateEnemies` (`party_level` and `location`) and returns a validated `BattleEnvironment`. The system prompt instructs Claude to produce atmospheric flavor text only — no mechanical rules. The function guards against a missing API key (same guard as `generateEnemies`).

**Contract**: Function signature — `generateEnvironment(battle: Pick<Battle, "party_level" | "location">): Promise<BattleEnvironment>`. Uses `Output.object({ schema: BattleEnvironmentSchema })`. System prompt emphasises narrative, evocative descriptions rather than D&D rule text.

#### 2. Environment API route

**File**: `src/pages/api/battles/[id]/environment.ts` (new file)

**Intent**: Handle `POST` requests to generate and persist a battle environment. No request body needed — the battle's own `party_level` and `location` provide all context. Mirrors `generate.ts` for auth, null-client guard, ownership 2-hop check, AI call, and error handling.

**Contract**:
- `export const prerender = false`
- `export const POST: APIRoute`
- Selects `id, party_level, location, campaign_id` from `battles`
- Calls `generateEnvironment(battle)` inside a try/catch; returns `{ error: "Generation failed. Please try again." }` on AI error (never expose raw error)
- On success: `.update({ environment: result, updated_at: new Date().toISOString() }).eq("id", battleId)` — split `error` (→ 500) from no data (→ 404) as per lessons.md
- Returns `{ environment: result }` (the validated `BattleEnvironment` object)

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes with the new function and route
- Manual curl test: `POST /api/battles/<id>/environment` for a battle with a location returns a 200 with all 5 fields populated

#### Manual Verification

- Calling the endpoint with a valid battle ID and location returns a 200 with `{ environment: { terrain, lighting, hazards, ambiance, trivia } }`
- Calling with a battle from a different user returns a 404 (not a 403 — same pattern as generate.ts)
- Calling when Supabase client is null returns a 500 (not a silent success)
- After a successful call, the `battles` table row shows the JSONB data in the `environment` column

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Inject Environment into Enemy Generation

### Overview

Update `generateEnemies` to accept an optional `environment` argument, and update the generate route to load and forward it. Minimal change — two files, a few lines each.

### Changes Required

#### 1. Update `generateEnemies` signature

**File**: `src/lib/ai.ts`

**Intent**: Accept `environment: BattleEnvironment | null` as part of the battle context and include a serialised summary in the prompt when present. This surfaces the terrain, hazards, and lighting to Claude so generated enemies are thematically consistent.

**Contract**: Change the `battle` parameter type from `Pick<Battle, "party_level" | "location">` to `Pick<Battle, "party_level" | "location"> & { environment: BattleEnvironment | null }`. Add an `environment` context part to `contextParts` when non-null — format it as a short inline summary e.g. `Environment: <terrain>. <hazards>.` (terrain and hazards are the most tactically relevant sub-fields).

#### 2. Update generate route to load environment

**File**: `src/pages/api/battles/[id]/generate.ts`

**Intent**: Select `environment` from the `battles` row so it can be forwarded to `generateEnemies`. One-line change to the `.select()` call at line 38.

**Contract**: Change `.select("id, party_level, location, campaign_id")` to `.select("id, party_level, location, campaign_id, environment")`. Pass the full `battle` object (now including `environment`) to `generateEnemies` — the updated signature accepts it.

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes — `generateEnemies` call sites are updated
- Existing enemy generation tests (if any) still pass: `npm test`

#### Manual Verification

- Generate enemies on a battle that already has environment data — Claude's response should reference or be consistent with the battle's terrain/atmosphere
- Generate enemies on a battle with no environment — behaves identically to before (no regression)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: UI — EnvironmentSection Component + Battle Page Integration

### Overview

Create an `EnvironmentSection` React island and wire it into the battle detail page.

### Changes Required

#### 1. `EnvironmentSection` React component

**File**: `src/components/battles/EnvironmentSection.tsx` (new file)

**Intent**: Client-side React island that shows either the current environment (5-field card grid) or a "Generate Environment" button. Manages loading state and surfaces errors inline — never silently swallows a non-ok response (lessons.md rule).

**Contract**:
- Props: `battleId: string`, `location: string | null`, `initialEnvironment: BattleEnvironment | null`
- State: `environment` (initialised from `initialEnvironment`), `isGenerating`, `error`
- Generate button: disabled when `location === null`; when disabled show a title attribute tooltip `"Set a location on this battle to generate an environment"`. Button text: "Generate Environment" / "Generating…" during load.
- On click: `POST /api/battles/${battleId}/environment` with no body; on non-ok response set error message; on success update `environment` state. Clears error on each new attempt.
- Display: when `environment` is set, render a 2-column grid of labelled cards — one per sub-field (Terrain, Lighting, Hazards, Ambiance, Trivia). Each card shows the label as a small heading and the string as body text.
- Error display: render error string below the button (same as `EnemiesSection` pattern)

#### 2. Battle page integration

**File**: `src/pages/battles/[id].astro`

**Intent**: Import and render `EnvironmentSection` between the badge row (line 76) and the existing `EnemiesSection` island (line 78). Pass the battle's `location` and `environment` as initial props.

**Contract**: Import `EnvironmentSection from "@/components/battles/EnvironmentSection"`. Add `<EnvironmentSection battleId={b.id} location={b.location} initialEnvironment={b.environment as BattleEnvironment | null} client:load />` between the closing `</div>` of the badges block and `<EnemiesSection …/>`. Import `BattleEnvironment` type from `@/lib/schemas/environment`.

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes — props types align between page and component
- `npm run lint` passes

#### Manual Verification

- Battle with a location set: "Generate Environment" button is enabled; clicking it shows a loading state, then displays the 5-field card grid
- Battle without a location: "Generate Environment" button is visible but greyed out; hovering shows the tooltip
- Clicking Generate a second time overwrites the previous environment (no confirmation)
- If the API returns an error, an error message appears below the button — the previous environment (if any) remains displayed
- Environment persists across page refreshes
- Existing enemy generation flow is unaffected (no regression)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests

- `BattleEnvironmentSchema` — valid 5-field object passes; object with an empty string field fails; object missing a field fails

### Integration Tests

- `POST /api/battles/[id]/environment` — 401 when unauthenticated, 404 when battle belongs to another user, 200 with valid `BattleEnvironment` on success
- After a successful environment call, the `battles` row in the DB has JSONB data in `environment`

### Manual Testing Steps

1. Create a battle without a location → verify Generate Environment button is disabled
2. Create a battle with a location (e.g. "Ancient Ruins") → verify button is enabled
3. Click Generate Environment → verify loading state, then 5 sub-fields appear
4. Refresh the page → verify environment persists
5. Click Generate again → verify output is replaced (no confirmation prompt)
6. Generate enemies on a battle with an environment → verify enemy names/abilities feel thematically consistent
7. Verify error display: simulate a network failure (disconnect) → error message appears below the button

## Migration Notes

The new `environment JSONB` column is nullable with no default. Existing battles are unaffected. No backfill needed — GMs generate on-demand when they want it.

## References

- Change file: `context/changes/battle-environment/change.md`
- First generation pattern: `context/changes/first-gated-generation/plan.md`
- AI helper: `src/lib/ai.ts`
- Enemy schema pattern: `src/lib/schemas/enemy.ts`
- Generate endpoint template: `src/pages/api/battles/[id]/generate.ts`
- Battle detail page: `src/pages/battles/[id].astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer

#### Automated

- [x] 1.1 Migration applies cleanly — `npx supabase db push` without errors — bafef65
- [x] 1.2 TypeScript compilation passes — `npm run typecheck` — bafef65

#### Manual

- [x] 1.3 `battles` table shows new `environment` column (JSONB, nullable) in Supabase Studio — bafef65
- [x] 1.4 Existing battle records are unaffected (column is NULL for pre-existing rows) — bafef65

### Phase 2: Environment Generation — AI Function + API Endpoint

#### Automated

- [x] 2.1 `npm run typecheck` passes with new function and route — a6c2f4e
- [x] 2.2 POST /api/battles/:id/environment returns 200 with all 5 fields for a valid battle with location — a6c2f4e

#### Manual

- [x] 2.3 Valid battle with location → 200 with `{ environment: { terrain, lighting, hazards, ambiance, trivia } }` — a6c2f4e
- [x] 2.4 Battle from different user → 404 — a6c2f4e
- [x] 2.5 Null Supabase client → 500 (not silent success) — a6c2f4e
- [x] 2.6 After success, `battles` row shows JSONB data in `environment` column — a6c2f4e

### Phase 3: Inject Environment into Enemy Generation

#### Automated

- [x] 3.1 `npm run typecheck` passes — `generateEnemies` call sites updated — effee12
- [x] 3.2 Existing enemy generation tests pass — `npm test` — effee12

#### Manual

- [x] 3.3 Generate enemies on battle with environment — response is thematically consistent with terrain/atmosphere — effee12
- [x] 3.4 Generate enemies on battle with no environment — no regression from previous behaviour — effee12

### Phase 4: UI — EnvironmentSection Component + Battle Page Integration

#### Automated

- [x] 4.1 `npm run typecheck` passes — props types align
- [x] 4.2 `npm run lint` passes

#### Manual

- [x] 4.3 Battle with location: Generate Environment button is enabled; clicking shows loading then 5-field grid
- [x] 4.4 Battle without location: button visible but disabled with tooltip
- [x] 4.5 Clicking Generate a second time overwrites previous environment
- [x] 4.6 API error: error message appears below button; previous environment remains
- [x] 4.7 Environment persists across page refreshes
- [x] 4.8 Existing enemy generation flow unaffected
