# Edit Battle Implementation Plan

## Overview

S-12 adds inline editing for a battle's name, party_level, and location on the battle detail page. The GM clicks an Edit button in the header, changes one or more fields, and saves — updated values appear in-place without a page reload.

## Current State Analysis

The battle detail page (`src/pages/battles/[id].astro`) is pure Astro SSR: the battle name renders as a static `<h1>` and party_level/location render as static badges. There is no edit UI and no PATCH endpoint for battles. The create/list API (`src/pages/api/battles.ts`) handles only POST and GET.

The `Battle` type (`src/types.ts`) exposes `id`, `campaign_id`, `name`, `party_level`, `location`, `environment`, `created_at`, and `updated_at`. No `description` field exists — the roadmap entry's "description" referred loosely to the existing descriptive fields.

Two React islands already live on the page — `EnvironmentSection` and `EnemiesSection` — each managing their own local state. The enemy edit pattern (S-03: `PATCH /api/enemies/[id].ts` + inline edit in `EnemiesSection`) is the direct template.

### Key Discoveries

- `src/pages/api/battles.ts` — POST (create) + GET (list); no PATCH
- `src/pages/battles/[id].astro:52–88` — static header block to be replaced by the new island
- `src/pages/api/enemies/[id].ts` — PATCH pattern: JSON body, ownership cascade via campaign join, structured JSON response with status codes
- `src/components/battles/EnemiesSection.tsx` — island pattern to follow: local state + fetch handler + error display
- `src/components/battles/EnvironmentSection.tsx` — receives `location` prop at SSR time; will not see location changes from BattleHeader until the page reloads (acceptable limitation, documented below)
- `src/components/battles/CreateBattleForm.tsx` — `FormField`, `SubmitButton`, `ServerError` components available for reuse in the edit form

## Desired End State

The GM clicks an "Edit" button (pencil icon) next to the battle header. The h1 and badges area switches to an inline form pre-populated with the current name, party level, and location. The GM edits one or more fields and clicks Save; the updated values render immediately in-place and the form collapses back to the read view. Clicking Cancel discards any changes. The updated name appears on the campaign page the next time it is visited (SSR refetch on navigation — no extra work needed).

### Key Discoveries

- `CampaignBattleList.tsx` fetches battle data server-side via `campaigns/[id].astro` — updated names are picked up automatically on the next page load.
- `<title>` reflects the SSR-rendered name and will remain stale until page reload — acceptable; the in-page h1 updates immediately.

## What We're NOT Doing

- No new `description` column on the battles table — no schema migration required.
- No deletion of battles (handled by campaign-management, S-05).
- No editing of the battle's `environment` JSONB — managed by the EnvironmentSection island.
- No client-side validation — server-side only, matching the established pattern.
- No real-time sync of `location` to `EnvironmentSection` — if the GM edits location and immediately generates environment without reloading, the environment API receives the old location prop. The GM can reload to pick up the new location for generation.
- No `document.title` update after an inline save — the `<title>` tag reflects the SSR value until the next page load.

## Implementation Approach

Three phases: PATCH API endpoint → BattleHeader React island → wire island into the detail page. Each phase is independently verifiable. The PATCH endpoint follows the `api/enemies/[id].ts` pattern (JSON body, ownership cascade, structured JSON response). The island follows the `EnvironmentSection`/`EnemiesSection` pattern (client:load, local state, error display).

---

## Phase 1: PATCH /api/battles/[id]

### Overview

Create the new API endpoint that validates and persists the three editable battle fields.

### Changes Required

#### 1. New PATCH endpoint

**File**: `src/pages/api/battles/[id].ts`

**Intent**: Handle `PATCH /api/battles/[id]` requests from the BattleHeader island. Validate the JSON body, verify the GM owns the battle, update the row, and return the full updated battle object.

**Contract**: Exports `PATCH: APIRoute`. Reads `context.params.id`. Parses a JSON body with shape `{ name: string, party_level?: number | null, location?: string | null }`. Validates: `name` required, max 200 chars; `party_level` integer 1–30 or null; `location` max 200 chars or null. Ownership check: fetch the battle's `campaign_id`, then verify `campaigns.user_id = user.id`. On success: `supabase.from("battles").update({name, party_level, location, updated_at}).eq("id", id).select().single()`, return `Response.json({ battle }, { status: 200 })`. Error responses follow the enemies pattern: `{ error: string }` with 400 (bad request/missing name), 401 (no user), 403 (not owner), 404 (battle not found), 422 (field validation failure), 500 (DB error).

### Success Criteria

#### Automated Verification

- TypeScript build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification

- `PATCH /api/battles/{valid-id}` with valid body returns 200 and the updated battle object
- `PATCH /api/battles/{valid-id}` with missing name returns 400 with error message
- `PATCH /api/battles/{valid-id}` with party_level 0 or 31 returns 422
- `PATCH /api/battles/{other-user-battle-id}` returns 403 or 404 (not 500)
- `PATCH /api/battles/{nonexistent-id}` returns 404

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: BattleHeader React Island

### Overview

Create the React island that renders the battle header in read mode and toggles to an inline edit form.

### Changes Required

#### 1. BattleHeader component

**File**: `src/components/battles/BattleHeader.tsx`

**Intent**: Render the battle's name, party_level badge, location badge, and created date in read mode with an Edit button. When the GM clicks Edit, switch to an inline form with the same three editable fields. On Save, call `PATCH /api/battles/[id]` and update local state with the returned battle data. On Cancel, restore the previous values and exit edit mode.

**Contract**: Props: `battleId: string`, `initialName: string`, `initialPartyLevel: number | null`, `initialLocation: string | null`, `createdDate: string` (pre-formatted string from Astro frontmatter). State: `isEditing: boolean`, `name: string`, `partyLevel: string` (controlled number input as string), `location: string`, `isLoading: boolean`, `error: string | null`. The read view renders the gradient h1 (class matching the current `battles/[id].astro:62–64`), the badges div (class matching `:66–84`), and a pencil-icon Edit button (lucide-react `Pencil`). The edit view renders `FormField` inputs for each field, a `SubmitButton` (with loading state), and a Cancel button; `ServerError` at top if `error` is set. On save: `fetch(\`/api/battles/${battleId}\`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({name, party_level, location}) })` → parse JSON response → on success set state from `data.battle`, set `isEditing(false)`; on failure set `error` from `data.error`.

### Success Criteria

#### Automated Verification

- TypeScript build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification

- Edit button (pencil icon) is visible in the battle header read view
- Clicking Edit renders an inline form pre-populated with current values
- Cancel returns to read view with original values intact
- Saving with a blank name shows a validation error (server-side)
- Saving valid changes updates the h1 and badges in-place without a page reload
- Saving with party_level 0 or 31 shows the server error message

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Battle Detail Page Wiring

### Overview

Replace the static header block in the battle detail page with the new `BattleHeader` island.

### Changes Required

#### 1. Replace static header with BattleHeader island

**File**: `src/pages/battles/[id].astro`

**Intent**: Remove the static `<h1>` and badges `<div>` (lines 62–84) and replace them with `<BattleHeader ... client:load />`, passing the SSR-fetched battle data as initial props. Import `BattleHeader` from `@/components/battles/BattleHeader`.

**Contract**: The `createdDate` string (already computed on line 45) is passed as a prop so the island doesn't need to reformat the timestamp client-side. Props passed: `battleId={b.id}`, `initialName={b.name}`, `initialPartyLevel={b.party_level}`, `initialLocation={b.location}`, `createdDate={createdDate}`.

### Success Criteria

#### Automated Verification

- TypeScript build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification

- Battle detail page renders with no visual regression compared to before (name, badges, created date all present)
- Full edit flow works end-to-end: edit name + location → save → in-place update → navigate back to campaign → updated name visible in battle list
- Party level badge updates immediately after saving a changed party_level
- Navigating to the battle page in a fresh session shows the updated name (SSR confirms DB was persisted)
- EnvironmentSection and EnemiesSection are unaffected

**Implementation Note**: Pause here for manual confirmation before marking the change complete.

---

## Testing Strategy

### Unit Tests

- None required for this scope — the PATCH endpoint is thin CRUD without complex branching logic. Integration via manual verification is sufficient.

### Integration Tests

- Not applicable for this scope.

### Manual Testing Steps

1. Sign in as a GM and navigate to a battle detail page.
2. Click the Edit button — verify the form appears with current values pre-populated.
3. Change the name to something new and click Save — verify the h1 updates in-place.
4. Click Edit again, change party_level, click Save — verify the badge updates.
5. Click Edit, clear the name field, click Save — verify an error message appears and no save occurs.
6. Click Edit, change location, click Cancel — verify the original location is restored.
7. Navigate back to the campaign page — verify the updated battle name appears in the battle list.
8. Reload the battle page — verify the saved values persist (DB round-trip confirmed).

## References

- Roadmap entry: `context/foundation/roadmap.md` (S-12)
- Enemy edit pattern (template): `src/pages/api/enemies/[id].ts`, `src/components/battles/EnemiesSection.tsx`, `src/components/battles/EnemyCard.tsx`
- Existing battle API: `src/pages/api/battles.ts`
- Battle detail page: `src/pages/battles/[id].astro`
- Types: `src/types.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: PATCH /api/battles/[id]

#### Automated

- [x] 1.1 TypeScript build passes: `npm run build` — bd37149
- [x] 1.2 Lint passes: `npm run lint` — bd37149

#### Manual

- [x] 1.3 PATCH with valid body returns 200 and updated battle object — bd37149
- [x] 1.4 PATCH with missing name returns 400 — bd37149
- [x] 1.5 PATCH with out-of-range party_level returns 422 — bd37149
- [x] 1.6 PATCH for another user's battle returns 403 or 404 — bd37149
- [x] 1.7 PATCH for nonexistent battle returns 404 — bd37149

### Phase 2: BattleHeader React Island

#### Automated

- [x] 2.1 TypeScript build passes: `npm run build` — 1358a97
- [x] 2.2 Lint passes: `npm run lint` — 1358a97

#### Manual

- [x] 2.3 Edit button visible in battle header read view — f9842e4
- [x] 2.4 Clicking Edit shows inline form pre-populated with current values — f9842e4
- [x] 2.5 Cancel restores original values without saving — f9842e4
- [x] 2.6 Saving blank name shows server error message — f9842e4
- [x] 2.7 Saving valid changes updates h1 and badges in-place — f9842e4

### Phase 3: Battle Detail Page Wiring

#### Automated

- [x] 3.1 TypeScript build passes: `npm run build` — f9842e4
- [x] 3.2 Lint passes: `npm run lint` — f9842e4

#### Manual

- [x] 3.3 Battle detail page renders with no visual regression — f9842e4
- [x] 3.4 Full edit flow works end-to-end (edit → save → in-place update → back to campaign → updated name in list) — f9842e4
- [x] 3.5 Saved values persist across page reload — f9842e4
- [x] 3.6 EnvironmentSection and EnemiesSection unaffected — f9842e4
