# S-02: First Gated Generation — Implementation Plan

## Overview

Wire the full generate → review → confirm flow for D&D 5e enemy cards. A GM opens a battle, types a natural-language scenario request, gets back AI-generated enemy cards (one per enemy type), and confirms or denies each card individually. Confirmed cards are persisted to the battle; denied cards are deleted. This is the north-star slice — it proves the core product hypothesis.

## Current State Analysis

- All three DB tables are deployed: `campaigns`, `battles`, `enemies` (with `pending|confirmed` enum, `stats JSONB` column)
- `src/lib/campaigns.ts` — `getUserCampaign` helper already exists
- `src/pages/battles/[id].astro` — battle detail page with S-02 placeholder at line 58
- No AI SDK, no Zod in the codebase; `nodejs_compat` is already present in `wrangler.jsonc`
- `astro:env/server` is the established pattern for secrets (not `import.meta.env`)
- `anthropic-docs.md` in the change folder documents the wrong SDK and must be replaced

## Desired End State

The GM navigates to a battle, types a natural-language combat request (e.g., "2 ice wolves and a frost troll"), clicks Generate, and sees one enemy card per creature with full D&D 5e stats. The battle's `party_level` and `location` are automatically injected into the AI prompt. The GM confirms cards they like (persisted as `confirmed` in DB) and denies cards they don't (deleted). Pending cards survive page reload. Confirmed enemies are listed in a separate section on the same page.

### Key Discoveries

- `battle.party_level` (INT, nullable) and `battle.location` (TEXT, nullable) are already stored — inject both into the system prompt automatically
- `enemies.stats` is JSONB — the full Zod-validated stat object is stored as-is
- Abilities must be `{name, description}[]` — PRD says "named abilities and special attacks"; GM needs descriptions at the table
- The enemies RLS policy is a two-hop FK check (`enemies → battles → campaigns → user_id = auth.uid()`); ownership is enforced at the DB layer for PATCH/DELETE
- `src/pages/api/battles/[id]/generate.ts` requires a nested dynamic route — new pattern in this codebase
- Denied enemy = DELETE from DB immediately (no `'denied'` status needed; PRD: "denied card does not get saved")

## What We're NOT Doing

- No streaming (known deadlock bug in `streamText` with workerd; S-02 flow is generate → wait → show)
- No auto-retry on AI failure (GM sees an error and retries manually)
- No individual card regeneration (FR-006 is nice-to-have, parked)
- No enemy editing (FR-007 is S-03)
- No enemy removal post-confirm (FR-009 is S-03)
- No `'denied'` status in the DB enum — denied enemies are deleted, not archived
- Not adding multi-campaign UI (FR-001 parked; default campaign auto-created on signup)

## Implementation Approach

Four sequential phases: (1) SDK + env wiring and schema definition — everything Phase 2-4 depends on; (2) generate API route; (3) confirm/deny API routes; (4) frontend components and battle detail page update. The Zod `EnemyGroupSchema` defined in Phase 1 is the central contract that drives both the AI prompt structure and the DB persistence format.

## Critical Implementation Details

**`astro:env/server` for the API key** — `@ai-sdk/anthropic`'s `createAnthropic({ apiKey })` must receive the key from `import { ANTHROPIC_API_KEY } from 'astro:env/server'`, not from `process.env`. In Cloudflare Workers, `process.env` does not surface Wrangler secrets; only `astro:env/server` does. Using `process.env.ANTHROPIC_API_KEY` will silently produce `undefined` and the API call will fail with an auth error.

**EnemiesSection must own all enemy state** — Pending and confirmed enemies are both managed inside the React island (`EnemiesSection`). The Astro page pre-fetches all enemies (pending + confirmed) and passes them as JSON props; the component holds them in React state. This avoids a page reload on confirm and keeps the UI responsive.

---

## Phase 1: Foundation — SDK, Env, Schema, AI Lib

### Overview

Install the AI SDK, extend the env schema for the Anthropic API key, define the Zod `EnemyGroupSchema` (the central contract for generation output and DB storage), write the AI generation function, and replace the stale `anthropic-docs.md`.

### Changes Required

#### 1. Replace `context/changes/first-gated-generation/anthropic-docs.md`

**File**: `context/changes/first-gated-generation/anthropic-docs.md`

**Intent**: Replace the existing file (which documents the native `@anthropic-ai/sdk`) with a reference doc for the Vercel AI SDK v6 pattern (`@ai-sdk/anthropic` + `generateText` + `Output.object()`). This is the SDK the team decided to use; the old docs would mislead an implementer.

**Contract**: The new doc must cover: install command, `createAnthropic` initialization with explicit `apiKey`, `generateText` + `Output.object({ schema })` call, the `{ output }` destructure, and the non-streaming constraint. Mirror the structure of the existing doc.

#### 2. Install packages

**File**: `package.json` (via `npm install`)

**Intent**: Add the three packages required for generation: the Vercel AI SDK core, the Anthropic provider adapter, and Zod for schema validation and structured output.

**Contract**: `npm install ai @ai-sdk/anthropic zod` — adds all three to `dependencies`.

#### 3. Extend env schema

**File**: `astro.config.mjs`

**Intent**: Register `ANTHROPIC_API_KEY` as a server-side secret in Astro's env schema so it is accessible via `astro:env/server` in the AI lib and API routes.

**Contract**: Add to the existing `env.schema` object, following the same pattern as `SUPABASE_URL`:
```ts
ANTHROPIC_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
```

#### 4. Update local dev secrets

**Files**: `.dev.vars`, `.env.example`

**Intent**: Document and provide `ANTHROPIC_API_KEY` for local development and for new contributors.

**Contract**: Add `ANTHROPIC_API_KEY=<actual key>` to `.dev.vars` (not committed); add `ANTHROPIC_API_KEY=###` to `.env.example` (committed). Production key goes in Wrangler via `wrangler secret put ANTHROPIC_API_KEY`.

#### 5. Create enemy Zod schema

**File**: `src/lib/schemas/enemy.ts` (new file)

**Intent**: Define the Zod schema for a single enemy's stat block (`EnemySchema`) and for the full generation output (`EnemyGroupSchema`). This schema is the single source of truth — it drives what Claude is asked to produce, validates the AI response, and defines what is stored in `enemies.stats` (JSONB).

**Contract**: Export `EnemySchema`, `EnemyGroupSchema`, `EnemyStats` (inferred type), and `EnemyGroup`. The schema must include numeric range constraints that enforce D&D 5e validity — these are the guardrails the PRD requires. On validation failure, Zod throws and the route returns an error to the GM.

```ts
import { z } from 'zod';

const AbilitySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

export const EnemySchema = z.object({
  name: z.string().min(1),
  cr: z.string().min(1),                             // e.g. "1/2", "5", "10"
  hp: z.number().int().min(1),
  ac: z.number().int().min(1).max(30),
  speed: z.string().min(1),                          // e.g. "30 ft."
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
  saving_throws: z.record(z.string(), z.number()).optional(),
  skill_modifiers: z.record(z.string(), z.number()).optional(),
  abilities: z.array(AbilitySchema).min(0).max(10),
});

export const EnemyGroupSchema = z.object({
  enemies: z.array(EnemySchema).min(1).max(10),
});

export type EnemyStats = z.infer<typeof EnemySchema>;
export type EnemyGroup = z.infer<typeof EnemyGroupSchema>;
```

#### 6. Create AI generation lib

**File**: `src/lib/ai.ts` (new file)

**Intent**: Isolate all Claude API interaction in one place. The route handlers call `generateEnemies(battle, prompt)` and never import the AI SDK directly — this keeps generation logic testable and swappable.

**Contract**: Export `generateEnemies(battle: Pick<Battle, 'party_level' | 'location'>, prompt: string): Promise<EnemyGroup>`. The function must:
- Import `ANTHROPIC_API_KEY` from `astro:env/server` (not `process.env`)
- Create the Anthropic client via `createAnthropic({ apiKey: ANTHROPIC_API_KEY })` from `@ai-sdk/anthropic`
- Call `generateText` with `Output.object({ schema: EnemyGroupSchema })` from `ai`
- Inject `battle.party_level` and `battle.location` (when non-null) into the prompt prefix — the GM doesn't re-type them
- Use a system prompt that states D&D 5e rules constraints and the structured output requirement
- Use `model: anthropic('claude-sonnet-4-6')` (do not use `claude-haiku-4-5-20251001` for the first implementation — stat quality matters more than cost at this stage)
- Propagate errors from `generateText` — the route handler catches and sanitizes them

```ts
import { generateText, Output } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ANTHROPIC_API_KEY } from 'astro:env/server';
import { EnemyGroupSchema, type EnemyGroup } from '@/lib/schemas/enemy';
import type { Battle } from '@/types';

const SYSTEM_PROMPT = `You are a D&D 5th Edition expert. Generate valid enemy stat blocks.
Rules:
- Ability scores: 1–30. HP: positive integer. AC: 1–30.
- CR must be appropriate for the given party level.
- Each ability must include a name and a one-line description with mechanics (e.g. damage dice, save DC).
- Return exactly as many enemies as requested.
Output JSON only.`;

export async function generateEnemies(
  battle: Pick<Battle, 'party_level' | 'location'>,
  prompt: string,
): Promise<EnemyGroup> {
  const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY ?? '' });
  const contextParts = [
    battle.party_level != null ? `Party level: ${battle.party_level}` : null,
    battle.location ? `Location: ${battle.location}` : null,
  ].filter(Boolean);
  const fullPrompt = contextParts.length > 0
    ? `${contextParts.join('. ')}. ${prompt}`
    : prompt;

  const { output } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    output: Output.object({ schema: EnemyGroupSchema }),
    system: SYSTEM_PROMPT,
    prompt: fullPrompt,
  });

  return output;
}
```

### Success Criteria

#### Automated Verification

- `npm install` completes without errors
- `npm run typecheck` (or `astro check`) passes — `EnemySchema`, `EnemyGroup`, `generateEnemies` are all correctly typed
- `anthropic-docs.md` documents Vercel AI SDK pattern (no references to `@anthropic-ai/sdk` or `messages.parse`)

#### Manual Verification

- `.dev.vars` contains `ANTHROPIC_API_KEY` set to a valid key
- `wrangler secret put ANTHROPIC_API_KEY` succeeds in a shell (confirming the key is accepted by Wrangler for production)
- Calling `generateEnemies` in isolation (e.g., a temporary test script or local wrangler dev) returns a valid `EnemyGroup` object with at least one enemy

**Implementation Note**: Pause after Phase 1 manual verification before proceeding to Phase 2.

---

## Phase 2: Generate API Route

### Overview

Create the `POST /api/battles/[id]/generate` endpoint. It verifies auth and battle ownership, calls `generateEnemies`, inserts all returned enemies as `pending` in Supabase, and returns the saved records (with DB-assigned IDs) to the client.

### Changes Required

#### 1. Create generate route

**File**: `src/pages/api/battles/[id]/generate.ts` (new file — nested dynamic route)

**Intent**: Accept a prompt string, verify the GM owns the battle, call the AI lib, persist the generated enemies as pending, and return the saved records. The client needs the DB-assigned IDs to make subsequent confirm/deny calls.

**Contract**: Export `export const POST: APIRoute`. The handler must:
1. Init Supabase via `createClient(context.request.headers, context.cookies)` — return 500 if null
2. Check `context.locals.user` — return 401 if null
3. Read `battleId` from `context.params.id`
4. Parse request body as JSON; extract `prompt: string` — return 400 if missing or blank
5. Call `getUserCampaign(supabase, user.id)` — return 403 if no campaign
6. Query `battles` where `id = battleId AND campaign_id = campaign.id` — return 404 if not found; select `id, party_level, location`
7. Call `generateEnemies(battle, prompt)` — catch any error and return `{ error: 'Generation failed. Please try again.' }` with status 500 (sanitized — no raw AI error messages)
8. `supabase.from('enemies').insert(...)` — one row per enemy, with `battle_id`, `name`, `status: 'pending'`, `stats: enemyStats` (the full `EnemyStats` object) — return 500 on insert error
9. Return `Response.json({ enemies })` with the saved records (including DB-assigned `id` fields)

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes on the new route file
- Route file exists at `src/pages/api/battles/[id]/generate.ts`

#### Manual Verification

- `POST /api/battles/<valid-id>/generate` with a valid session and `{ prompt: "3 goblins" }` returns 200 with an `enemies` array; each enemy has a DB `id` and `status: 'pending'`
- Calling the endpoint with no session returns 401
- Calling with a battleId that belongs to a different user returns 404 (not leaking existence)
- Calling with a blank or missing prompt returns 400
- When the AI fails (test by temporarily using an invalid API key), the endpoint returns 500 with a human-readable sanitized error (not a raw Anthropic error message)
- Newly generated enemies appear in the Supabase `enemies` table with `status = 'pending'`

**Implementation Note**: Pause after manual verification before proceeding to Phase 3.

---

## Phase 3: Enemy Actions API Route

### Overview

Create `PATCH /api/enemies/[id]` (confirm) and `DELETE /api/enemies/[id]` (deny). Both are thin — they delegate ownership enforcement to Supabase RLS and return success/not-found.

### Changes Required

#### 1. Create enemy actions route

**File**: `src/pages/api/enemies/[id].ts` (new file)

**Intent**: Expose confirm (status → `confirmed`) and deny (delete) as two HTTP methods on the same resource URL. Ownership is enforced by Supabase RLS (two-hop FK check to the user's campaign); the route trusts the result — 0 rows affected = 404.

**Contract**: Export `export const PATCH: APIRoute` and `export const DELETE: APIRoute` from the same file.

- **PATCH** (confirm): Update `status = 'confirmed'` and `updated_at = now()` on the enemy row where `id = context.params.id`. Return the updated enemy on success. If the update returns no row (RLS blocked or enemy doesn't exist), return 404. Do not accept arbitrary body fields in S-02 — this PATCH sets status to `'confirmed'` unconditionally (S-03 will extend the handler to accept stat edits).
- **DELETE** (deny): Delete the enemy row where `id = context.params.id`. RLS silently limits the delete to rows the user owns. Return `{ success: true }` regardless of rows affected (idempotent — clicking Deny twice is harmless). Return 500 only on a Supabase transport error.
- Both handlers must check `context.locals.user` and return 401 if null.
- Both handlers must init Supabase and return 500 if null.

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes on the new route file
- Route file exists at `src/pages/api/enemies/[id].ts`

#### Manual Verification

- `PATCH /api/enemies/<pending-enemy-id>` with a valid session updates the enemy to `status = 'confirmed'` in Supabase and returns the updated record
- `DELETE /api/enemies/<pending-enemy-id>` removes the row from Supabase
- Both endpoints return 401 for unauthenticated requests
- PATCH on an enemy that belongs to a different user returns 404 (RLS silently returns no rows)
- DELETE on an enemy that belongs to a different user returns `{ success: true }` without error (idempotent, 0 rows deleted)

**Implementation Note**: Pause after manual verification before proceeding to Phase 4.

---

## Phase 4: Battle Detail UI

### Overview

Add the generation UI to the battle detail page. A React island (`EnemiesSection`) manages all enemy state — pre-populated from the server and updated optimistically on generate/confirm/deny. Two sub-components render individual cards with or without action buttons.

### Changes Required

#### 1. Create `EnemyCard` component

**File**: `src/components/battles/EnemyCard.tsx` (new file)

**Intent**: Render a single enemy's stat block. When `onConfirm`/`onDeny` callbacks are provided (pending state), show Confirm and Deny buttons. When absent (confirmed state), render read-only — no action buttons. This component is extended in S-03 to show edit/delete actions.

**Contract**: Props `{ enemy: Enemy; onConfirm?: () => void; onDeny?: () => void }`. Display: name (heading), CR, HP, AC, speed, the six ability scores, saving throws, skill modifiers, and the abilities list (each as `name: description`). The `stats` field on `Enemy` is typed as `Record<string, unknown> | null` in `src/types.ts` — cast to `EnemyStats` from `@/lib/schemas/enemy` inside the component using `EnemySchema.parse(enemy.stats)` to get type safety. Show a per-card loading state while a confirm/deny request is in flight.

#### 2. Create `EnemiesSection` component

**File**: `src/components/battles/EnemiesSection.tsx` (new file)

**Intent**: The React island that owns all enemy state for the battle page. Pre-seeded with initial pending and confirmed arrays from the Astro server. Contains the generate form (textarea + submit) and renders the pending and confirmed enemy lists. Handles all API calls for generate, confirm, and deny.

**Contract**: Props `{ battleId: string; initialPending: Enemy[]; initialConfirmed: Enemy[] }`. State: `pending: Enemy[]`, `confirmed: Enemy[]`, `isGenerating: boolean`, `generateError: string | null`. Behavior:

- **Generate form**: A `<textarea>` with placeholder text and a Submit button. On submit, POST to `/api/battles/${battleId}/generate` with `{ prompt }`. On success, prepend the returned enemies to `pending` state. On error, set `generateError` to the sanitized error message from the response (do not display the raw response body — use `data.error ?? 'Generation failed. Please try again.'`). Follow the `useFormStatus` pattern from `CreateBattleForm.tsx` for the submit button's disabled/loading state.
- **Confirm**: Call PATCH `/api/enemies/${enemy.id}`; on success, remove from `pending` and add to `confirmed`.
- **Deny**: Call DELETE `/api/enemies/${enemy.id}`; on success, remove from `pending` (no addition to confirmed).
- Render sections: "Generate" (form + error), "Pending Review" (if any pending), "Confirmed Enemies" (if any confirmed). If both are empty, show an empty state.

#### 3. Update battle detail page

**File**: `src/pages/battles/[id].astro`

**Intent**: Replace the S-02 placeholder with the `EnemiesSection` island. Pre-fetch all enemies for the battle (pending + confirmed) server-side and pass them as initial props so the island starts with correct data without an additional client-side fetch.

**Contract**: After the existing battle fetch, add an enemies query:
```ts
const { data: allEnemies } = await supabase
  .from('enemies')
  .select('*')
  .eq('battle_id', battle.id)
  .order('created_at', { ascending: true });
```
Split into `initialPending` and `initialConfirmed` arrays by `status`. Remove the placeholder div at line 58. Render `<EnemiesSection battleId={battle.id} initialPending={initialPending} initialConfirmed={initialConfirmed} client:load />`. Import `EnemiesSection` from `@/components/battles/EnemiesSection`.

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes with no errors on new component files and updated page
- No TypeScript errors accessing `stats` as `EnemyStats` inside `EnemyCard`

#### Manual Verification

- Opening a battle page shows the generate textarea and no S-02 placeholder
- Typing "3 ice wolves" and clicking Generate shows three enemy cards with full stat blocks (name, CR, HP, AC, all six ability scores, abilities list with descriptions)
- Each card has Confirm and Deny buttons; the submit button disables during the API call
- Clicking Confirm moves the card from "Pending Review" to "Confirmed Enemies"
- Clicking Deny removes the card from the page; the enemy is gone from Supabase
- Navigating away and back to the battle page shows confirmed enemies in the Confirmed section; previously-pending-but-unreviewed enemies reappear in the Pending Review section
- Generating a second batch after confirming some enemies adds the new pending cards alongside any remaining pending from the first batch
- If the Anthropic API is down or returns an error, a sanitized error message appears (not a raw API error) and a "Try Again" button re-enables the form
- On a battle with `party_level = 5` and `location = "frozen cave"`, the generated stat blocks are level-appropriate (not wildly off — CR ~2-5 range for level 5)
- No console errors; no raw error messages visible to the GM

**Implementation Note**: Test the full end-to-end flow (create battle → type prompt → generate → confirm → navigate away → return → confirm enemies persist) before marking S-02 complete.

---

## Testing Strategy

### Automated

- TypeScript compilation (`npm run typecheck`) must pass after each phase
- Astro build (`npm run build`) must pass at end of Phase 4 — catches import errors not caught by typecheck alone

### Manual Testing Steps

1. Create a new battle with `party_level = 5` and `location = "frozen cave"`
2. On the battle detail page, type "2 ice wolves and a frost troll"
3. Click Generate — observe loading state, then three cards appearing
4. Verify each card shows: name, CR, HP, AC, all 6 ability scores, speed, abilities with descriptions
5. Confirm the ice wolf cards; deny the frost troll card
6. Verify Confirmed section shows two confirmed ice wolves; pending section is empty
7. Navigate to `/battles` (list page) and back to the battle — confirmed enemies persist; no pending cards (the denied one was deleted)
8. Generate again with "1 zombie" — new pending card appears alongside confirmed enemies
9. Confirm the zombie — now three confirmed enemies
10. Revoke the Anthropic API key; attempt to generate — verify sanitized error message, form re-enables

## Performance Considerations

The generation call to Claude (`claude-sonnet-4-6`) will take 2–8 seconds under typical conditions. The GM-facing NFR is "within a few seconds." The loading state on the form submit must visually communicate that generation is in progress to prevent duplicate submissions. No timeout is set in Phase 1 — Cloudflare Workers has a 30s CPU budget; a 15s generation is acceptable.

## Migration Notes

No schema migrations are required for S-02. All tables (`campaigns`, `battles`, `enemies`) are deployed. No enum changes needed — `pending` and `confirmed` are the only required statuses.

## References

- Research doc: `context/changes/first-gated-generation/research.md`
- Provider decision: `context/changes/first-gated-generation/ai-provider-research.md`
- API route template: `src/pages/api/battles.ts`
- React form pattern: `src/components/battles/CreateBattleForm.tsx`
- Enemy Zod schema: `src/lib/schemas/enemy.ts` (created in Phase 1)
- Astro env pattern: `src/lib/supabase.ts:3` — `astro:env/server` import

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Foundation — SDK, Env, Schema, AI Lib

#### Automated

- [x] 1.1 `npm install` completes without errors — 92163ed
- [x] 1.2 `npm run typecheck` passes — EnemySchema, EnemyGroup, generateEnemies correctly typed — 92163ed
- [x] 1.3 `anthropic-docs.md` documents Vercel AI SDK pattern (no references to `@anthropic-ai/sdk` or `messages.parse`) — 92163ed

#### Manual

- [x] 1.4 `.dev.vars` contains `ANTHROPIC_API_KEY` set to a valid key — 92163ed
- [x] 1.5 `wrangler secret put ANTHROPIC_API_KEY` succeeds in a shell — 92163ed
- [x] 1.6 Calling `generateEnemies` in isolation returns a valid `EnemyGroup` with at least one enemy — 92163ed

### Phase 2: Generate API Route

#### Automated

- [x] 2.1 `npm run typecheck` passes on `src/pages/api/battles/[id]/generate.ts` — 3a85bc7
- [x] 2.2 Route file exists at `src/pages/api/battles/[id]/generate.ts` — 3a85bc7

#### Manual

- [x] 2.3 POST with valid session + prompt returns 200 with enemy array, each with DB `id` and `status: 'pending'` — 3a85bc7
- [x] 2.4 Endpoint returns 401 for unauthenticated requests — 3a85bc7
- [x] 2.5 Endpoint returns 404 for battleId belonging to a different user — 3a85bc7
- [x] 2.6 Blank/missing prompt returns 400 — 3a85bc7
- [x] 2.7 AI failure returns 500 with sanitized human-readable error (not raw Anthropic error) — 3a85bc7
- [x] 2.8 Generated enemies appear in Supabase with `status = 'pending'` — 3a85bc7

### Phase 3: Enemy Actions API Route

#### Automated

- [x] 3.1 `npm run typecheck` passes on `src/pages/api/enemies/[id].ts`
- [x] 3.2 Route file exists at `src/pages/api/enemies/[id].ts`

#### Manual

- [x] 3.3 PATCH updates enemy to `status = 'confirmed'` and returns updated record
- [x] 3.4 DELETE removes enemy from Supabase
- [x] 3.5 Both endpoints return 401 for unauthenticated requests
- [x] 3.6 PATCH on another user's enemy returns 404
- [x] 3.7 DELETE on another user's enemy returns `{ success: true }` (idempotent)

### Phase 4: Battle Detail UI

#### Automated

- [ ] 4.1 `npm run typecheck` passes on all new component files and updated `[id].astro`
- [ ] 4.2 `npm run build` succeeds (catches import errors)

#### Manual

- [ ] 4.3 Battle page shows generate textarea; S-02 placeholder is gone
- [ ] 4.4 Typing a prompt and generating shows enemy cards with full stat blocks
- [ ] 4.5 Confirm moves card to Confirmed section; Deny removes card from page and DB
- [ ] 4.6 Pending enemies reappear after page reload; confirmed enemies are in the Confirmed section
- [ ] 4.7 Second generation run adds new pending cards without disturbing confirmed ones
- [ ] 4.8 AI error shows sanitized message and re-enables form
- [ ] 4.9 Stat blocks are level-appropriate for the battle's party_level and location
- [ ] 4.10 Full end-to-end flow (create battle → generate → confirm → navigate away → return → confirmed enemies persist)
