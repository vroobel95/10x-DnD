# S-03: Edit and Remove Confirmed Enemies — Implementation Plan

## Overview

Add two post-confirmation actions to enemy cards: an inline edit mode that lets the GM update any stat field on a confirmed enemy, and an inline remove toggle with a confirmation step. Both write back to the database immediately.

## Current State Analysis

- `src/pages/api/enemies/[id].ts` — PATCH sets `status = 'confirmed'` with no request body; DELETE removes the enemy. Both rely on RLS (two-hop FK chain: enemies → battles → campaigns → user_id) with no explicit row-existence check in code.
- `src/components/battles/EnemiesSection.tsx` — manages `pending` and `confirmed` arrays in React state; `handleConfirm` and `handleDeny` are the only mutation handlers; `actionError` inline banner is the established error pattern.
- `src/components/battles/EnemyCard.tsx` — renders read-only stat block; shows Confirm/Deny only when `onConfirm`/`onDeny` props are present; confirmed cards currently have no actions.
- `src/lib/schemas/enemy.ts` — `EnemySchema` (Zod) defines the full stat contract: name, cr, hp, ac, speed, str/dex/con/int/wis/cha, saving_throws?, skill_modifiers?, abilities[]. Already imported in `EnemyCard.tsx` for parse-time validation.
- `src/types.ts` — `Enemy.stats` is `Record<string, unknown> | null`; `Enemy.name` is a separate top-level TEXT column that must stay in sync with `stats.name`.
- `supabase/migrations/20260527000003_create_enemies.sql` — RLS policy covers ALL operations via WITH CHECK; no schema changes needed for this slice.

## Desired End State

A confirmed enemy card shows two action buttons — "Edit" and "Remove". Clicking Edit flips the card to an edit form pre-populated with all current stat values; Save commits to the DB and flips back to read-only; Cancel discards and flips back. Clicking Remove shows an inline "Confirm remove? Yes / Cancel" row; Yes deletes the enemy and removes it from the list. Only one card can be in edit mode at a time; opening edit on a second card silently discards unsaved changes on the first.

### Key Discoveries

- `EnemySchema` is already imported in `EnemyCard.tsx` — can be reused for edit form draft typing without adding new imports
- `Enemy.name` (TEXT column) and `stats.name` (inside JSONB) are independent DB fields — both must be written on edit or they diverge
- `DELETE /api/enemies/[id]` is already implemented and correct — FR-009 (remove) is purely a UI wire-up plus an ownership-verification fix
- The current DELETE handler returns 500 on any Supabase error, including the case where RLS silently returns 0 rows (enemy not found / not owned) — should return 404 in that case
- `saving_throws` and `skill_modifiers` are `Record<string, number>` optionals — keys come from AI generation and are fixed; only values are editable
- `abilities` is `{name, description}[]` with count locked by EnemySchema `.min(0).max(10)` — count stays fixed in edit mode

## What We're NOT Doing

- No editing of pending (unconfirmed) enemies — Confirm/Deny remains the only pending-card action
- No adding or removing abilities — ability count is locked at what the AI generated
- No adding or removing saving_throw / skill_modifier keys — only the numeric values are editable
- No client-side validation — server-side EnemySchema.parse is the single validation boundary
- No undo / history — Save is permanent; Cancel discards local draft only
- No bulk edit across multiple cards simultaneously

## Implementation Approach

Three sequential phases. Phase 1 extends the PATCH route with a body discriminant so the existing confirm flow is untouched while the new edit path is added. Phase 2 adds the state and handlers to EnemiesSection. Phase 3 adds the edit form and remove toggle UI to EnemyCard. The phases are ordered so Phase 1 can be verified independently via curl before any UI lands.

## Critical Implementation Details

**PATCH body discriminant — safe body parsing**: The current PATCH handler reads no body. To discriminate, check `Content-Type: application/json` before calling `request.json()`. If the content-type is absent or not JSON, treat as the confirm path. Never call `request.json()` unconditionally — an empty body will throw a parse error.

**Sanitize Zod errors before returning them**: Per project lessons, raw third-party error messages must not reach the user. Return only the first Zod issue's `.message` (e.g. "Number must be at most 30"), which describes the field constraint in user-friendly terms without exposing schema internals.

**`editingId` discards without warning**: Opening a second card's edit mode calls `setEditingId(newId)` which causes the first card's draft (local state) to unmount and disappear. This is intentional — do not add a "you have unsaved changes" guard; the interaction is lightweight enough that the tradeoff was explicitly accepted.

---

## Phase 1: Extend PATCH Route

### Overview

Add an edit path to `PATCH /api/enemies/[id]` that accepts a `{ stats }` JSON body, validates against `EnemySchema`, and updates both the `stats` JSONB and the top-level `name` column in one query. Harden the DELETE handler to return 404 when no row was affected.

### Changes Required

#### 1. Extend PATCH handler with body discriminant

**File**: `src/pages/api/enemies/[id].ts`

**Intent**: Keep the existing confirm path intact (no body → set `status = 'confirmed'`). Add an edit path: if the request has `Content-Type: application/json` and a body containing `stats`, validate the stats with `EnemySchema.safeParse`, return 422 with the first Zod issue message on failure, otherwise update `stats`, `name`, and `updated_at` in one Supabase update and return `{ enemy: updatedEnemy }`.

**Contract**: Body discriminant logic — check `context.request.headers.get('content-type')?.includes('application/json')` before calling `context.request.json()`. If the parsed body has a `stats` key, enter the edit path; otherwise fall through to the existing confirm path. The edit path must write `{ stats: parsed.data, name: parsed.data.name, updated_at: new Date().toISOString() }` to cover both the JSONB column and the top-level name column.

#### 2. Harden DELETE to return 404 on missing row

**File**: `src/pages/api/enemies/[id].ts`

**Intent**: The current DELETE returns a generic 500 on any Supabase error, including the case where RLS produces 0 affected rows (enemy not found or not owned by this user). Return 404 with a safe message instead.

**Contract**: After the delete call, check `deleteResult.error` for a real DB error (return 500) vs check that the delete affected exactly one row — use `.select('id')` on the delete call to distinguish "deleted" from "not found". Return `{ error: "Enemy not found" }` with status 404 when 0 rows come back.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run check`
- Linting passes: `npm run lint`

#### Manual Verification

- `PATCH /api/enemies/{id}` with empty body → still confirms the enemy (status = confirmed in DB)
- `PATCH /api/enemies/{id}` with `Content-Type: application/json` and valid `{ stats: {...} }` body → updates stats + name columns, returns updated enemy
- `PATCH /api/enemies/{id}` with invalid stats (e.g. `str: 999`) → 422 with readable message
- `DELETE /api/enemies/{unknown-id}` → 404, not 500

---

## Phase 2: EnemiesSection State and Handlers

### Overview

Add `editingId` and `removingId` state to `EnemiesSection` and wire up the six new handler functions. Pass the new props to confirmed `EnemyCard` instances.

### Changes Required

#### 1. Add edit and remove state

**File**: `src/components/battles/EnemiesSection.tsx`

**Intent**: Track which card is in edit mode (`editingId`) and which is in remove-confirmation mode (`removingId`) as nullable string IDs. Both default to null.

**Contract**: `const [editingId, setEditingId] = useState<string | null>(null)` and `const [removingId, setRemovingId] = useState<string | null>(null)`. These sit alongside the existing `pending`, `confirmed`, `loadingId`, and `actionError` state.

#### 2. Add handleEditSave

**File**: `src/components/battles/EnemiesSection.tsx`

**Intent**: Call `PATCH /api/enemies/{id}` with the edited stats as JSON body. On success, replace the enemy in the `confirmed` array with the returned updated enemy and clear `editingId`. On failure, set `actionError`.

**Contract**: Signature `async function handleEditSave(enemy: Enemy, stats: EnemyStats): Promise<void>`. Sets `loadingId` during the request. Sends `Content-Type: application/json` with body `JSON.stringify({ stats })`. On `!res.ok`, reads the error message from `data.error` and calls `setActionError`. On success, updates the confirmed array using the `data.enemy` from the response and calls `setEditingId(null)`.

#### 3. Add handleEditCancel

**File**: `src/components/battles/EnemiesSection.tsx`

**Intent**: Clear `editingId` to exit edit mode without saving.

**Contract**: `function handleEditCancel() { setEditingId(null); }` — no async work needed.

#### 4. Add handleRemoveStart, handleRemoveConfirm, handleRemoveCancel

**File**: `src/components/battles/EnemiesSection.tsx`

**Intent**: `handleRemoveStart` sets `removingId` to show the inline confirmation. `handleRemoveConfirm` calls `DELETE /api/enemies/{id}`, removes the enemy from `confirmed` on success. `handleRemoveCancel` clears `removingId`.

**Contract**: `handleRemoveConfirm` follows the same fetch pattern as `handleDeny` (sets `loadingId`, checks `!res.ok`, filters from state array). When opening edit mode on a new card while `editingId` is set, call `setEditingId(newId)` directly — the old card's local draft unmounts silently (intentional per design decision).

#### 5. Pass new props to confirmed EnemyCard instances

**File**: `src/components/battles/EnemiesSection.tsx`

**Intent**: Thread the six new handlers and the two state flags into confirmed `EnemyCard` instances so the card can render edit/remove UI.

**Contract**: Each confirmed `EnemyCard` receives: `onEditSave`, `onEditCancel`, `onRemoveStart`, `onRemoveConfirm`, `onRemoveCancel`, `isEditing={editingId === enemy.id}`, `isRemoving={removingId === enemy.id}`, `isLoading={loadingId === enemy.id}`.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run check`
- Linting passes: `npm run lint`

#### Manual Verification

- Clicking "Edit" on a confirmed card sets that card to edit mode; other cards remain unchanged
- Clicking "Edit" on a second card while the first is in edit mode discards the first card's draft silently
- `actionError` banner appears after a failed edit save or remove

---

## Phase 3: EnemyCard Edit Form and Remove Toggle

### Overview

Extend `EnemyCard` with two new confirmed-card UI modes: an inline edit form that pre-populates from the current enemy stats and a remove confirmation toggle. Pending card behaviour is unchanged.

### Changes Required

#### 1. Extend Props interface

**File**: `src/components/battles/EnemyCard.tsx`

**Intent**: Add the six action callbacks and two state flags for confirmed-card behaviour. The existing `onConfirm`, `onDeny`, and `isLoading` props are unchanged.

**Contract**: Add to `Props`:
```
onEditSave?: (stats: EnemyStats) => void;
onEditCancel?: () => void;
onRemoveStart?: () => void;
onRemoveConfirm?: () => void;
onRemoveCancel?: () => void;
isEditing?: boolean;
isRemoving?: boolean;
```
Import `EnemyStats` from `@/lib/schemas/enemy` (already imported for `EnemySchema.parse`).

#### 2. Add edit form local draft state

**File**: `src/components/battles/EnemyCard.tsx`

**Intent**: When `isEditing` becomes true, initialize a local `draft` state from the current parsed stats. The draft holds the in-progress edits until Save or Cancel.

**Contract**: `const [draft, setDraft] = useState<EnemyStats | null>(null)`. In a `useEffect` keyed on `isEditing`: when `isEditing` becomes true and stats parse successfully, set draft to the parsed stats; when `isEditing` becomes false, reset draft to null. All form inputs read from and write to `draft`.

#### 3. Render edit form when isEditing

**File**: `src/components/battles/EnemyCard.tsx`

**Intent**: Replace the read-only stat block with a structured form when `isEditing` is true. Form layout mirrors the read-only layout (name + CR → HP/AC/Speed → 6-stat grid → saving throws → skill modifiers → abilities) but each field becomes an editable input.

**Contract**: Field types follow EnemySchema constraints — numeric inputs (min/max matching schema) for hp, ac, str, dex, con, int, wis, cha; text inputs for name, cr, speed; number inputs for each saving_throw value and skill_modifier value (keys displayed as read-only labels); two text inputs per ability (name + description, count fixed). Save button calls `onEditSave(draft)` disabled while `isLoading`; Cancel calls `onEditCancel()`. No form submit — use `onClick` handlers to avoid native form POST.

#### 4. Render remove confirmation toggle

**File**: `src/components/battles/EnemyCard.tsx`

**Intent**: When `isRemoving` is true, replace the "Remove" button with an inline "Confirm remove? [Yes] [Cancel]" row. When `isRemoving` is false, show the "Remove" button that calls `onRemoveStart`.

**Contract**: `isRemoving` toggles between two footer states. In the non-removing state, confirmed cards (identified by `!!onRemoveStart`) show an "Edit" and a "Remove" button side by side. In the removing state, show a small text "Remove this enemy?" with "Yes" (calls `onRemoveConfirm`, disabled while `isLoading`) and "Cancel" (calls `onRemoveCancel`). Both edit and remove footers are hidden while the card is in edit mode — only Save/Cancel appear then.

#### 5. Add confirmed-card action footer to read-only view

**File**: `src/components/battles/EnemyCard.tsx`

**Intent**: Confirmed cards currently show no footer. Add the Edit + Remove footer to the read-only view so the actions are discoverable without entering edit mode.

**Contract**: The footer renders only when `!!onEditSave` (presence of the prop distinguishes confirmed from unconfirmed confirmed-display-only). Apply the same `border-t border-white/10 pt-3` separator used by the existing pending card footer.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run check`
- Linting passes: `npm run lint`

#### Manual Verification

- Confirmed enemy card shows "Edit" and "Remove" buttons
- Clicking "Edit" flips card to edit form; all stat fields are pre-populated with current values
- Editing a numeric field (e.g. HP) and clicking Save → DB updated, card shows new value
- Editing an ability description and clicking Save → DB updated, card shows new text
- Clicking Cancel in edit mode → card reverts to read-only with original values
- Submitting an invalid value (e.g. str = 50) → inline error banner, card stays in edit mode
- Clicking "Remove" → inline "Confirm remove?" row appears
- Clicking "Yes" on remove → enemy disappears from the confirmed list
- Clicking "Cancel" on remove → card returns to normal
- Opening edit on card A, then clicking edit on card B → card A exits edit mode silently, card B enters edit mode
- Pending cards are unaffected — Confirm/Deny still work as before

---

## Testing Strategy

### Manual Testing Steps

1. Navigate to a battle that has at least two confirmed enemies (run the generate + confirm flow via S-02)
2. Click "Edit" on the first confirmed enemy; verify all fields are pre-populated
3. Change HP to 1, click Save; verify the card shows HP: 1 and the DB row reflects the change
4. Click "Edit" again; change str to 999; click Save; verify a 422 error banner appears and no DB update occurs
5. Click Cancel; verify the card shows the original str value
6. Click "Edit" on card 1; immediately click "Edit" on card 2; verify card 1 silently exits edit mode
7. Click "Remove" on a confirmed enemy; verify the inline confirmation appears
8. Click "Yes"; verify the enemy is removed from the page and the DB row is deleted
9. Click "Remove" on another enemy; click "Cancel"; verify the enemy remains

## References

- Related change: `context/changes/first-gated-generation/plan.md` (EnemiesSection and EnemyCard origin)
- Schema: `src/lib/schemas/enemy.ts`
- Types: `src/types.ts`
- Lessons: `context/foundation/lessons.md` (sanitize external errors, never swallow fetch errors)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Extend PATCH Route

#### Automated

- [x] 1.1 TypeScript compilation passes: `npm run check` — 83e2d09
- [x] 1.2 Linting passes: `npm run lint` — 83e2d09

#### Manual

- [ ] 1.3 PATCH with empty body still confirms enemy
- [ ] 1.4 PATCH with valid `{stats}` body updates stats + name columns
- [ ] 1.5 PATCH with invalid stats returns 422 with readable message
- [ ] 1.6 DELETE with unknown ID returns 404

### Phase 2: EnemiesSection State and Handlers

#### Automated

- [x] 2.1 TypeScript compilation passes: `npm run check` — 8ad02a9
- [x] 2.2 Linting passes: `npm run lint` — 8ad02a9

#### Manual

- [ ] 2.3 Edit on a confirmed card sets that card to edit mode only
- [ ] 2.4 Edit on second card silently discards first card's draft
- [ ] 2.5 actionError banner appears after a failed save or remove

### Phase 3: EnemyCard Edit Form and Remove Toggle

#### Automated

- [x] 3.1 TypeScript compilation passes: `npm run check` — 9a2a941
- [x] 3.2 Linting passes: `npm run lint` — 9a2a941

#### Manual

- [ ] 3.3 Confirmed card shows Edit and Remove buttons
- [ ] 3.4 Edit flips card to pre-populated form; Save persists to DB
- [ ] 3.5 Invalid stat value shows error banner, no DB update
- [ ] 3.6 Cancel reverts card to read-only original values
- [ ] 3.7 Remove shows inline confirmation; Yes deletes; Cancel dismisses
- [ ] 3.8 Pending cards unaffected
