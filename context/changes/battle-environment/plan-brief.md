# Battle Environment Generation — Plan Brief

> Full plan: `context/changes/battle-environment/plan.md`

## What & Why

Add AI-generated atmospheric environment descriptions to battles. A GM clicks "Generate Environment" and Claude produces five short narrative strings — terrain, lighting, hazards, ambiance, and battleground trivia — that are persisted to the battle and displayed on the battle page. This gives GMs instant flavour text to read aloud and sets the scene before enemies are generated.

## Starting Point

The `battles` table has a `location` text field (already shown as a badge on the battle page) but no environment data. Enemy generation already uses Claude via the Vercel AI SDK (`generateText` + `Output.object` + Zod schema) — this feature follows the exact same pattern with a new schema, AI function, and API endpoint.

## Desired End State

On the battle detail page, between the metadata badges and the enemies list, a "Battle Environment" section appears. For battles with a location set, the GM can click "Generate Environment" to populate five atmospheric sub-fields. The generated environment is also injected into future enemy generation prompts for that battle, so Claude's enemy suggestions are thematically consistent with the setting.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Content scope | Flavor text only (no D&D mechanics) | Many tables skip terrain rules; mechanical callouts add schema complexity and prompt risk | Plan |
| Generation trigger | On-demand button | Avoids AI calls for battles GMs never use; mirrors the existing enemy generation pattern | Plan |
| Regeneration | Free overwrite (no confirmation) | Simpler implementation; GMs are trusted to regenerate intentionally | Plan |
| Location requirement | Required — button disabled if no location | Environment should be grounded in the GM's chosen setting | Plan |
| Data shape | Fixed 5 sub-fields JSONB (terrain, lighting, hazards, ambiance, trivia) | Predictable schema, clean per-field display, matches the change.md description exactly | Plan |
| UI placement | Dedicated section between header badges and EnemiesSection | Visible without extra clicks; follows page's top-down reading order | Plan |
| Context feeding | Environment injected into enemy generation prompts | Small change to ai.ts; produces thematically consistent enemy suggestions | Plan |

## Scope

**In scope:**
- New `environment JSONB` column on `battles`
- `BattleEnvironmentSchema` Zod type + `BattleEnvironment` TypeScript type
- `generateEnvironment()` AI function in `src/lib/ai.ts`
- `POST /api/battles/[id]/environment` endpoint
- `generateEnemies` updated to accept and inject environment context
- `EnvironmentSection` React island
- Battle page integration

**Out of scope:**
- D&D mechanical effects (difficult terrain, cover, hazard damage)
- Battle editing / changing location after creation (roadmap item)
- Auto-generation on battle creation or location change
- Confirmation dialog before regeneration

## Architecture / Approach

A new Zod schema (`src/lib/schemas/environment.ts`) defines the five-field environment object. A new `generateEnvironment` function in `src/lib/ai.ts` follows the existing `generateText` + `Output.object` pattern. A new POST endpoint at `/api/battles/[id]/environment` mirrors `generate.ts` for auth, ownership check, AI call, and Supabase write. The `EnvironmentSection` React island is a client-side island that manages loading and error state, and renders the five sub-fields as labelled cards. The generate.ts route gets a one-line change to also load and pass `environment` to `generateEnemies`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Data layer | Migration + Zod schema + TypeScript type | None — additive only |
| 2. Environment generation | AI function + POST endpoint | AI may produce low-quality output without strong system prompt; test manually |
| 3. Enemy generation update | Environment injected into enemy prompts | Type mismatch if Battle type not updated before this phase |
| 4. UI | EnvironmentSection island + battle page wiring | Location prop must thread from page to island correctly |

**Prerequisites:** Phase 1 must be fully applied (migration pushed) before Phase 2; Phase 1 type update before Phase 3; Phases 2 and 3 before Phase 4.

**Estimated effort:** ~2 sessions across 4 phases (data + AI/API + integration + UI)

## Open Risks & Assumptions

- The AI must reliably fill all 5 fields; if Claude skips a field the Zod validation will reject the output — the system prompt should strongly enforce this
- Battle editing (to allow location to be added after creation) is not in scope; GMs who skip location at creation cannot use this feature until that change lands

## Success Criteria (Summary)

- A battle with a location shows the Generate Environment button; clicking it produces and persists 5 atmospheric sub-fields
- The button is visibly disabled (with tooltip) when no location is set
- Enemy generation for a battle with environment produces thematically consistent suggestions
