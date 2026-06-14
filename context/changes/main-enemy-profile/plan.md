# Main Enemy Profile — Implementation Plan

## Overview

Extend the enemy generation flow so the AI infers a main villain from the GM's prompt and, in the same call, generates a narrative profile card (appearance/backstory, tactics, 3 roleplay dialogue lines). The profile is stored as `main_enemy_profile` JSONB on the `battles` table alongside a `main_enemy_id` FK. The main enemy card appears first in the confirmed enemy list with the profile shown below its stat block.

## Current State Analysis

- `src/lib/ai.ts` — `generateEnemies(battle, prompt): Promise<EnemyGroup>` returns `{ enemies: EnemyStats[] }` only; no concept of a main villain
- `src/lib/schemas/enemy.ts` — `EnemyGroupSchema` defines the AI output contract; `EnemySchema` holds the per-enemy stat block
- `src/pages/api/battles/[id]/generate.ts` — inserts enemy rows then returns `{ enemies }` to the client; no battle-level update after insertion
- `src/pages/api/enemies/[id].ts` — `DELETE` handler removes the enemy row; does not clear any battle-level state
- `src/types.ts` — `Battle` interface has no `main_enemy_id` or `main_enemy_profile` fields
- `src/pages/battles/[id].astro` — fetches battle with `select("*")` and passes it to islands; `EnemiesSection` receives `initialPending` and `initialConfirmed` only
- `src/components/battles/EnemiesSection.tsx` — manages pending + confirmed enemy state; `handleDeny` and `handleRemoveConfirm` both call `DELETE /api/enemies/[id]` and remove from state without checking for profile side effects
- `src/components/battles/EnemyCard.tsx` — confirmed card has Edit + Remove footer; no concept of a "main" enemy display

Precedents that directly inform the approach:
- `battles.environment` (JSONB, added in `20260611000001`) + `generateEnvironment()` + `EnvironmentSection` — the exact pattern for AI-generated battle-level content
- `EnemyCard` confirmed-card footer — the right place for future designation actions if manual designation is ever added

## Desired End State

The GM types a prompt ("2 ice wolves and a frost troll") and clicks Generate. Claude generates enemy stat blocks as before, and also determines whether the prompt implies a main villain. When a boss is inferred, a profile card (narrative description, tactics, 3 GM dialogue lines) appears below that enemy's stat block in the confirmed list, with the card visually distinguished (accent border). If the GM denies the pending main enemy card, the profile is cleared automatically. A new generation run always overwrites the previous main enemy designation and profile.

### Key Discoveries

- `generateEnemies` currently returns `EnemyGroup` — needs a new `GenerateResultSchema` that wraps enemies + optional `main_enemy` block; `EnemyGroupSchema` itself is not changed (it is also used by `EnemySchema.safeParse` in the PATCH edit flow)
- `battles.main_enemy_id` as a UUID FK to `enemies(id)` with `ON DELETE SET NULL` handles DB-level cleanup automatically when an enemy row is hard-deleted; the app additionally clears `main_enemy_profile` in the DELETE handler
- The generate route already calls `supabase.from('battles')...select('id, ...')` — a second `supabase.from('battles').update(...)` call after enemy insertion is the right place to write `main_enemy_id` and `main_enemy_profile`
- `EnemiesSection` state needs two new fields: `mainEnemyId: string | null` and `mainEnemyProfile: MainEnemyProfile | null`; sorting `confirmed` so the main enemy renders first is a derived computation, not separate state
- The `[id].astro` page already does `select("*")` on battles — once the migration lands, `main_enemy_id` and `main_enemy_profile` are included automatically

## What We're NOT Doing

- No manual GM designation (no "Set as Main" toggle on the enemy card) — designation is AI-only
- No standalone "Regenerate Profile" button — profile comes only from a new generate run
- No profile versioning or history — last generation run wins, overwriting previous
- No auto-profile for previously-confirmed enemies (profile only generated as part of a generation run)
- No multi-main-enemy support — exactly zero or one main enemy per battle
- No profile editing — profile content is read-only (stat block editing via the existing Edit flow is unaffected)

## Implementation Approach

Four sequential phases. Phase 1 is the schema and AI layer — everything else depends on the new `GenerateResultSchema` and the updated `generateEnemies` return type. Phase 2 extends the generate endpoint to write `main_enemy_id` and `main_enemy_profile` after enemy insertion. Phase 3 extends the delete endpoint to clear the profile when the main enemy is removed. Phase 4 wires the new state and UI into `EnemiesSection` and `EnemyCard`. The phases are ordered so each can be manually verified via curl or unit inspection before the next starts.

## Critical Implementation Details

**`GenerateResultSchema` wraps, does not replace `EnemyGroupSchema`.** The existing `EnemyGroupSchema` is used in `EnemySchema.safeParse` inside the PATCH edit handler. Do not modify it. Instead, create a new `GenerateResultSchema` in `src/lib/schemas/enemy.ts` that adds `main_enemy` as a nullable optional field alongside `enemies`.

**Main enemy name matching is case-sensitive string equality.** After the AI call returns `main_enemy.enemy_name`, match it against the DB-inserted enemy rows by comparing `row.name === main_enemy.enemy_name`. If no match is found (AI hallucinated a name not in the generated set), skip the profile write silently — do not fail the request.

**`ON DELETE SET NULL` clears `main_enemy_id` but not `main_enemy_profile`.** The FK constraint handles the DB-level FK field automatically on hard delete; the DELETE handler must still clear `main_enemy_profile` to prevent orphaned narrative data. Do this with a targeted `supabase.from('battles').update({ main_enemy_profile: null }).eq('main_enemy_id', enemyId)` *before* the delete call — this way the enemy ID is still a valid FK target for the query filter.

**Generate endpoint overwrites unconditionally.** If `main_enemy` is present in the AI output, always write both `main_enemy_id` and `main_enemy_profile` to the battle, regardless of whether a previous profile exists. If `main_enemy` is null/absent, leave the existing `main_enemy_id` and `main_enemy_profile` unchanged (a supplemental run of "3 goblins" should not wipe an existing boss profile).

---

## Phase 1: Schema and AI Extension

### Overview

Add `MainEnemyProfileSchema` and `GenerateResultSchema` to the schemas file, update `generateEnemies` to return the new type, add a system-prompt section that instructs Claude to infer and generate the main villain profile, and add the DB migration.

### Changes Required

#### 1. Add `MainEnemyProfileSchema` and `GenerateResultSchema`

**File**: `src/lib/schemas/enemy.ts`

**Intent**: Define the Zod schema for the profile content (the three narrative fields) and a new `GenerateResultSchema` that wraps the existing enemies array with an optional `main_enemy` object. Keep `EnemyGroupSchema` untouched.

**Contract**: Export `MainEnemyProfileSchema`, `MainEnemyProfile` (inferred type), `GenerateResultSchema`, and `GenerateResult` (inferred type). The `main_enemy` field on `GenerateResultSchema` is `z.object({ enemy_name: z.string().min(1), profile: MainEnemyProfileSchema }).nullable().optional()`. The `profile` object has three fields: `description` (string, min 1), `tactics` (string, min 1), `dialogue` (array of exactly 3 non-empty strings via `.length(3)`).

#### 2. Update `generateEnemies` return type and system prompt

**File**: `src/lib/ai.ts`

**Intent**: Change the AI call to use `GenerateResultSchema` instead of `EnemyGroupSchema`, and extend the system prompt to instruct Claude to identify and profile the main villain when one is implied by the prompt.

**Contract**:
- Import `GenerateResultSchema` and `GenerateResult` from `@/lib/schemas/enemy` (replace the `EnemyGroupSchema` import; keep `EnemyGroup` import for internal `enemies` type if needed or remove if unused)
- Change `Output.object({ schema: EnemyGroupSchema })` → `Output.object({ schema: GenerateResultSchema })`
- Change return type annotation to `Promise<GenerateResult>`
- Extend `ENEMY_SYSTEM_PROMPT` with a section instructing the AI:
  - If the prompt implies a clear boss/villain (named creature, highest-power entity, narrative leader), populate `main_enemy` with that creature's name and a profile
  - `description`: 2–3 sentences on appearance and a backstory hook
  - `tactics`: 1–2 sentences on unique combat behavior and signature moves
  - `dialogue`: array of exactly 3 short, evocative in-character lines for GM use at the table
  - If there is no clear main villain (e.g. a group of identical creatures), set `main_enemy` to null

#### 3. Update `Battle` type in `src/types.ts`

**File**: `src/types.ts`

**Intent**: Add the two new nullable fields to the `Battle` interface so TypeScript is aware of them throughout the codebase.

**Contract**: Import `MainEnemyProfile` from `@/lib/schemas/enemy` alongside the existing `BattleEnvironment` import. Add to `Battle`: `main_enemy_id: string | null` and `main_enemy_profile: MainEnemyProfile | null`.

#### 4. DB migration: add `main_enemy_id` and `main_enemy_profile` to `battles`

**File**: `supabase/migrations/20260614000001_add_battle_main_enemy.sql` (new file)

**Intent**: Add the two new columns to the `battles` table. The FK uses `ON DELETE SET NULL` as a safety net for direct DB deletes; the application also clears `main_enemy_profile` explicitly in the DELETE handler.

**Contract**:

```sql
ALTER TABLE battles
  ADD COLUMN main_enemy_id UUID REFERENCES enemies(id) ON DELETE SET NULL,
  ADD COLUMN main_enemy_profile JSONB;
```

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db push` (or `supabase migration up`)
- `npm run check` passes — `GenerateResult`, `MainEnemyProfile`, and updated `Battle` type all typecheck correctly
- `npm run lint` passes

#### Manual Verification

- `battles` table in Supabase dashboard shows the two new nullable columns
- Calling `generateEnemies` in isolation with a prompt like "a vampire lord and 2 skeletal guards" returns a `GenerateResult` with `main_enemy` populated; calling with "3 goblins" returns `main_enemy: null`

**Implementation Note**: After Phase 1 manual verification, pause before proceeding to Phase 2.

---

## Phase 2: Generate Endpoint Extension

### Overview

Extend `POST /api/battles/[id]/generate` to write `main_enemy_id` and `main_enemy_profile` to the battle after inserting enemy rows, and return them in the response for the client to update its state.

### Changes Required

#### 1. Extend `POST /api/battles/[id]/generate`

**File**: `src/pages/api/battles/[id]/generate.ts`

**Intent**: After inserting enemy rows and getting back their DB IDs, check if the `GenerateResult` includes a `main_enemy`. If so, match its `enemy_name` against the inserted rows by exact string equality, then update the battle row with `main_enemy_id` and `main_enemy_profile`. Return both values in the response alongside `enemies`.

**Contract**:
- Replace the import of `generateEnemies` result handling: the function now returns `GenerateResult`; destructure `enemyGroup.enemies` for the existing row-insertion logic (unchanged)
- After `insertResult`, if `enemyGroup.main_enemy` is present:
  - Find the matching inserted row: `const mainRow = insertResult.data.find(r => r.name === enemyGroup.main_enemy!.enemy_name)`
  - If `mainRow` is found, run: `await supabase.from('battles').update({ main_enemy_id: mainRow.id, main_enemy_profile: enemyGroup.main_enemy.profile, updated_at: new Date().toISOString() }).eq('id', battleId)`
  - If no match (AI returned a name not in the generated set), skip the update silently — do not fail the request
- Change the success response: `Response.json({ enemies: insertResult.data, main_enemy_id: mainRow?.id ?? null, main_enemy_profile: enemyGroup.main_enemy?.profile ?? null })`
- If `enemyGroup.main_enemy` is null/absent, return `{ enemies: insertResult.data, main_enemy_id: null, main_enemy_profile: null }` — the client treats null values as "no change to existing profile" (see Phase 4 state management)

### Success Criteria

#### Automated Verification

- `npm run check` passes on the updated route file
- `npm run lint` passes

#### Manual Verification

- `POST /api/battles/<id>/generate` with `{ prompt: "a vampire lord and 2 skeletal guards" }` returns 200 with `enemies` array, `main_enemy_id` (a valid UUID matching one of the returned enemies), and `main_enemy_profile` object containing `description`, `tactics`, and `dialogue` (array of 3 strings)
- `POST` with `{ prompt: "3 goblins" }` returns `main_enemy_id: null` and `main_enemy_profile: null`
- The `battles` row in Supabase reflects `main_enemy_id` and `main_enemy_profile` for the vampire lord case
- Existing behavior unaffected: unauthenticated request → 401; blank prompt → 400; invalid battle → 404

**Implementation Note**: After Phase 2 manual verification, pause before proceeding to Phase 3.

---

## Phase 3: Delete Endpoint Extension

### Overview

Extend `DELETE /api/enemies/[id]` to clear `main_enemy_id` and `main_enemy_profile` on the battle before deleting the enemy, when the enemy being deleted is the current main enemy. Return `main_enemy_cleared` in the response so the client can update its state.

### Changes Required

#### 1. Extend `DELETE` handler

**File**: `src/pages/api/enemies/[id].ts`

**Intent**: Before the existing delete call, check if this enemy is the battle's main enemy and, if so, clear both profile fields on the battle. Because `ON DELETE SET NULL` on the FK only clears `main_enemy_id` (not `main_enemy_profile`), the app must clear both explicitly.

**Contract**:
- After the `battleIds` array is assembled (existing auth chain unchanged), add a targeted update *before* the delete:

  ```ts
  const profileClearResult = await supabase
    .from('battles')
    .update({ main_enemy_id: null, main_enemy_profile: null, updated_at: new Date().toISOString() })
    .eq('main_enemy_id', context.params.id);
  ```

  This is a no-op if the enemy is not the main one (`eq` matches zero rows). Do not check for errors on this call — a failure here should not block the delete.
- Proceed with the existing delete logic unchanged
- Change the success response to include `main_enemy_cleared`:

  ```ts
  const mainEnemyCleared = !profileClearResult.error && (profileClearResult.count ?? 0) > 0;
  return Response.json({ success: true, main_enemy_cleared: mainEnemyCleared });
  ```

### Success Criteria

#### Automated Verification

- `npm run check` passes
- `npm run lint` passes

#### Manual Verification

- `DELETE /api/enemies/<id>` where the enemy is the battle's main enemy returns `{ success: true, main_enemy_cleared: true }` and the battle row in Supabase has `main_enemy_id = null` and `main_enemy_profile = null`
- `DELETE /api/enemies/<id>` for a non-main enemy returns `{ success: true, main_enemy_cleared: false }` and the battle's profile is untouched
- Existing error cases unchanged: 401 for unauthenticated, 404 for unknown enemy

**Implementation Note**: After Phase 3 manual verification, pause before proceeding to Phase 4.

---

## Phase 4: Battle Detail Page + EnemiesSection + EnemyCard UI

### Overview

Pass `main_enemy_id` and `main_enemy_profile` from the battle page to `EnemiesSection`. Add state management for these fields, update the generate and deny/remove handlers to consume the new response fields, and render the profile in the main enemy's `EnemyCard`.

### Changes Required

#### 1. Pass main enemy props from the battle detail page

**File**: `src/pages/battles/[id].astro`

**Intent**: Thread `initialMainEnemyId` and `initialMainEnemyProfile` into `EnemiesSection` so the island starts with correct state without a client-side fetch.

**Contract**: The existing `select("*")` on battles already returns the new columns once the migration lands. Add two props to the `EnemiesSection` island:

```astro
<EnemiesSection
  battleId={b.id}
  initialPending={initialPending}
  initialConfirmed={initialConfirmed}
  initialMainEnemyId={b.main_enemy_id}
  initialMainEnemyProfile={b.main_enemy_profile}
  client:load
/>
```

Import `MainEnemyProfile` from `@/lib/schemas/enemy` is not needed in the Astro file — the type flows through the `Battle` interface.

#### 2. Add main enemy state and update handlers in `EnemiesSection`

**File**: `src/components/battles/EnemiesSection.tsx`

**Intent**: Add `mainEnemyId` and `mainEnemyProfile` state initialized from new props. Update `handleGenerate` to read the new response fields and set state. Update `handleDeny` and `handleRemoveConfirm` to clear the profile state when `main_enemy_cleared` is true. Sort confirmed enemies so the main enemy renders first.

**Contract**:
- New props: `initialMainEnemyId: string | null` and `initialMainEnemyProfile: MainEnemyProfile | null` (import `MainEnemyProfile` from `@/lib/schemas/enemy`)
- New state: `const [mainEnemyId, setMainEnemyId] = useState<string | null>(initialMainEnemyId)` and `const [mainEnemyProfile, setMainEnemyProfile] = useState<MainEnemyProfile | null>(initialMainEnemyProfile)`
- In `handleGenerate`, after `setPending(...)`: if `data.main_enemy_id` is not null, call `setMainEnemyId(data.main_enemy_id)` and `setMainEnemyProfile(data.main_enemy_profile)`; if `data.main_enemy_id` is null, leave existing state unchanged (overwrite policy: null response = no boss inferred this run, keep prior profile)
- In `handleDeny` and `handleRemoveConfirm`, after the delete succeeds: if `data.main_enemy_cleared === true`, call `setMainEnemyId(null)` and `setMainEnemyProfile(null)`
- Derive the sorted confirmed list for rendering: `const sortedConfirmed = [...confirmed].sort((a, b) => (b.id === mainEnemyId ? 1 : 0) - (a.id === mainEnemyId ? 1 : 0))` — replace `confirmed.map(...)` with `sortedConfirmed.map(...)`
- Pass `isMain={mainEnemyId === enemy.id}` and `mainEnemyProfile={mainEnemyId === enemy.id ? mainEnemyProfile : null}` to each confirmed `EnemyCard`

#### 3. Render profile in `EnemyCard`

**File**: `src/components/battles/EnemyCard.tsx`

**Intent**: When a confirmed card receives `isMain={true}` and a non-null `mainEnemyProfile`, render the profile section below the stat block with a visual distinction (accent border top), before the Edit/Remove footer.

**Contract**:
- New props: `isMain?: boolean` and `mainEnemyProfile?: MainEnemyProfile | null` (import `MainEnemyProfile` from `@/lib/schemas/enemy`)
- Profile section renders only when `isMain && mainEnemyProfile`; it uses `border-t border-amber-400/30 pt-3 mt-3` (amber accent to distinguish from the white/10 separator used by the edit footer)
- Profile section layout: a small heading "Main Villain" with an icon or label; three subsections:
  - Narrative description (paragraph)
  - Tactics (paragraph)
  - Dialogue (three blockquote-style lines, each prefixed with `"`)
- The card container gets a visual accent on the left border when `isMain`: add `border-l-2 border-amber-400/60` to distinguish the main enemy card from regular confirmed cards

### Success Criteria

#### Automated Verification

- `npm run check` passes on all modified files
- `npm run build` passes (catches import errors)
- `npm run lint` passes

#### Manual Verification

- Battle page with a vampire-lord-type prompt: after generation, the vampire lord's confirmed card appears first, has a left amber border accent, and shows a "Main Villain" section with narrative description, tactics, and 3 dialogue lines
- Battle page with "3 goblins" prompt: no card has the amber accent; no profile section appears
- Denying the pending main enemy card removes it from pending and the profile section disappears from the confirmed list
- Removing the main enemy via the Remove button clears the profile section
- Running a second generate batch with a new boss overwrites the profile: the new boss is highlighted, the old one is de-highlighted
- Running a second generate batch with "3 goblins" after a boss exists: the prior boss profile is preserved unchanged
- All existing confirmed-card actions (Edit, Remove, Save, Cancel) work correctly on both main and non-main cards
- No console errors; profile section is readable and not visually broken at narrow viewport widths

**Implementation Note**: Test the full end-to-end flow before marking Phase 4 complete.

---

## Testing Strategy

### Unit Tests

- TypeScript compilation (`npm run check`) after each phase — catches schema type mismatches
- `npm run build` at end of Phase 4 — catches dynamic import errors not caught by typecheck

### Manual Testing Steps

1. Navigate to an existing battle, type "a necromancer and 2 skeletal archers", click Generate
2. Confirm the necromancer and archers
3. Verify the necromancer's card appears first in the confirmed list with an amber left border
4. Expand/read the profile: description should have appearance + backstory hook; tactics should describe necromantic combat style; dialogue should be 3 in-character lines
5. Start a second generation run with "3 zombie hordes" — confirm the zombies
6. Verify the necromancer profile is still shown (no new boss inferred from zombies)
7. Start a third run with "a lich overlord and 4 death knights" — confirm all
8. Verify the lich is now highlighted as main villain (necromancer profile is gone)
9. Click Remove on the lich — verify profile section disappears from the page; battle row in Supabase has `main_enemy_id = null`
10. Generate "a bandit captain and 3 bandits" — deny the bandit captain from the Pending Review section
11. Confirm the bandits — verify no profile appears (denied enemy means no main enemy)

## Performance Considerations

The generate call now returns a larger JSON payload due to the profile narrative (~500–800 additional tokens from Claude). Generation time may increase slightly (1–3 seconds). No additional round-trips are introduced — the profile is generated in the same call as enemy stat blocks. The `UPDATE battles` call after insertion is a single-row indexed update and negligible in latency.

## Migration Notes

Migration `20260614000001_add_battle_main_enemy.sql` adds two nullable columns to `battles`. Existing rows will have both columns as NULL — no backfill needed. The FK `ON DELETE SET NULL` is the safety net for direct DB deletes; the application handles the `main_enemy_profile` cleanup.

## References

- Similar pattern: `context/changes/battle-environment/plan.md` (environment JSONB on battles)
- AI lib: `src/lib/ai.ts`
- Enemy schema: `src/lib/schemas/enemy.ts`
- Types: `src/types.ts`
- Generate route: `src/pages/api/battles/[id]/generate.ts`
- Delete route: `src/pages/api/enemies/[id].ts`
- EnemiesSection: `src/components/battles/EnemiesSection.tsx`
- EnemyCard: `src/components/battles/EnemyCard.tsx`
- Battle detail page: `src/pages/battles/[id].astro`
- Lessons: `context/foundation/lessons.md` (sanitize external errors, never swallow fetch errors, fail fast on missing secrets)

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `.claude/skills/10x-plan/references/progress-format.md`.

### Phase 1: Schema and AI Extension

#### Automated

- [x] 1.1 Migration applies cleanly — bb0eab1
- [x] 1.2 `npm run check` passes — GenerateResult, MainEnemyProfile, updated Battle type all typecheck — bb0eab1
- [x] 1.3 `npm run lint` passes — bb0eab1

#### Manual

- [x] 1.4 `battles` table shows the two new nullable columns in Supabase dashboard — bb0eab1
- [x] 1.5 `generateEnemies` with a boss prompt returns `main_enemy` populated; with "3 goblins" returns `main_enemy: null` — 2d2720d

### Phase 2: Generate Endpoint Extension

#### Automated

- [x] 2.1 `npm run check` passes on updated generate route — 2d2720d
- [x] 2.2 `npm run lint` passes — 2d2720d

#### Manual

- [x] 2.3 POST with boss prompt returns `main_enemy_id` + `main_enemy_profile` in response; battle row updated in Supabase — 2d2720d
- [x] 2.4 POST with "3 goblins" returns `main_enemy_id: null` and `main_enemy_profile: null` — 2d2720d
- [x] 2.5 Existing error cases unchanged (401, 400, 404) — 2d2720d

### Phase 3: Delete Endpoint Extension

#### Automated

- [x] 3.1 `npm run check` passes — 5c96040
- [x] 3.2 `npm run lint` passes — 5c96040

#### Manual

- [x] 3.3 DELETE on main enemy returns `main_enemy_cleared: true`; battle profile fields cleared in Supabase — 5c96040
- [x] 3.4 DELETE on non-main enemy returns `main_enemy_cleared: false`; battle profile untouched — 5c96040
- [x] 3.5 Existing error cases unchanged (401, 404) — 5c96040

### Phase 4: Battle Detail Page + EnemiesSection + EnemyCard UI

#### Automated

- [x] 4.1 `npm run check` passes on all modified files — 03d0434
- [x] 4.2 `npm run build` passes — 03d0434
- [x] 4.3 `npm run lint` passes — 03d0434

#### Manual

- [x] 4.4 Boss prompt: confirmed boss card appears first with amber border + profile section — 03d0434
- [x] 4.5 Non-boss prompt: no amber accent, no profile section — 03d0434
- [x] 4.6 Denying the pending main enemy clears the profile from the page — 03d0434
- [x] 4.7 Removing confirmed main enemy clears the profile from the page — 03d0434
- [x] 4.8 Second generation run with new boss overwrites profile; run with no boss preserves existing profile — 03d0434
- [x] 4.9 All existing Edit/Remove actions work correctly on main and non-main cards — 03d0434
- [x] 4.10 Full end-to-end flow tested (generate boss → confirm → profile visible → remove → profile gone) — 03d0434
