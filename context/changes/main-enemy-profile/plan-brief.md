# Main Enemy Profile — Plan Brief

> Full plan: `context/changes/main-enemy-profile/plan.md`

## What & Why

When the GM's prompt implies a clear boss or villain ("a vampire lord and 2 skeletal guards"), Claude infers this automatically during enemy generation and returns a narrative profile alongside the stat blocks — no manual designation needed. The profile (appearance/backstory, tactics, 3 roleplay dialogue lines) gives the GM everything they need to run the villain at the table, without switching apps.

## Starting Point

The generate endpoint already calls Claude once per prompt and inserts enemy rows. There is no concept of a main enemy: all confirmed cards are treated equally by `EnemiesSection`, and `battles` has no profile column. The `environment` JSONB column (added in `20260611000001`) is the direct precedent for what we're building.

## Desired End State

The GM generates enemies as usual. If a boss is inferred, the boss's confirmed card appears first in the list with an amber visual accent, and a "Main Villain" section below its stat block shows the narrative profile. Running a new generate batch with a different boss overwrites the profile; running with no boss leaves the existing profile untouched. Denying or removing the main enemy clears the profile automatically.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Designation method | AI-inferred from prompt | GM's intent is already in the prompt; manual toggling adds friction for no benefit | Plan |
| Profile storage | `main_enemy_profile` JSONB on `battles` | Mirrors the existing `environment` column — one pattern for all AI-generated battle-level content | Plan |
| Generation timing | Same call as stat blocks | One round-trip; no extra GM action; no latency wait after enemies appear | Plan |
| Deny/remove behavior | Profile cleared automatically | Orphaned profiles are confusing; what the GM sees should always reflect confirmed state | Plan |
| Standalone regenerate | No | Keeps endpoint surface minimal; profile comes from the generation flow the GM already knows | Plan |
| Profile display location | Inside EnemiesSection, top of confirmed list | Keeps profile next to the stat block it describes; no new island | Plan |
| Overwrite policy | New run always overwrites; null result preserves existing | Last boss wins on re-generation; supplemental "goblin" runs don't wipe an existing boss | Plan |

## Scope

**In scope:**
- New `MainEnemyProfileSchema` and `GenerateResultSchema` Zod schemas
- Updated `generateEnemies` return type + extended system prompt
- `Battle` type extension (`main_enemy_id`, `main_enemy_profile`)
- DB migration: two nullable columns on `battles`
- Generate endpoint: write profile to battle after insertion; return in response
- Delete endpoint: clear profile before deleting the main enemy
- `EnemiesSection`: new state, updated handlers, sorted confirmed list
- `EnemyCard`: amber accent + profile section for the main villain card

**Out of scope:**
- Manual designation UI (no "Set as Main" button on enemy cards)
- Standalone profile regeneration endpoint
- Profile editing
- Multi-enemy boss support
- Profile for previously-confirmed enemies (only from new generation runs)

## Architecture / Approach

The AI call in `generateEnemies` is extended to return `GenerateResult` (wrapping the existing enemy array + optional `main_enemy` block). The generate route writes `main_enemy_id` + `main_enemy_profile` to the battle row after enemy insertion in the same request, and returns both in the JSON response. The delete route clears them before deleting. `EnemiesSection` holds the profile in React state and passes `isMain` + `mainEnemyProfile` to the matching `EnemyCard`, which renders the profile section inline.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schema & AI Extension | `GenerateResultSchema`, updated `generateEnemies`, `Battle` type, DB migration | AI may not reliably infer main enemy from all prompt styles |
| 2. Generate Endpoint | Backend writes profile to battle; returns in response | Name matching (AI vs DB row) may silently miss if names diverge |
| 3. Delete Endpoint | Profile cleared when main enemy is denied or removed | App-level clear must run before the delete or the FK target is gone |
| 4. UI Wiring | Profile visible in confirmed list; state updates on generate/remove | EnemiesSection state shape grows; sort logic must not cause re-render churn |

**Prerequisites:** Phase 1 migration must land before any other phase is testable.  
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- Claude may not reliably identify a "main enemy" from all prompt styles — a brief prompt like "a dragon" may or may not return a profile; this is acceptable and the UI degrades gracefully (no profile shown)
- Name matching between AI output (`enemy_name`) and the DB row (`name`) is exact string equality — the AI must return the name exactly as it generated it in the stat block; a mismatch silently skips the profile write
- `supabase.db.count` behavior on the `UPDATE` in the delete handler may need verification (Supabase JS v2 returns affected row count via `count` on update results)

## Success Criteria (Summary)

- Generate a boss prompt → confirmed boss card shows amber accent + narrative profile below stat block
- Deny or remove the boss → profile section disappears; battle row in Supabase has both columns null
- Generate a non-boss prompt after a boss exists → existing profile is preserved unchanged
