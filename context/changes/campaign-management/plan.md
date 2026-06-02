# S-05: Campaign Management — Implementation Plan

## Overview

Replace the silent single-campaign assumption with a full campaign list UI: GMs see all their campaigns on login, can create, rename, and delete them, and pick one to view its battles. Battle deletion (FR-011, folded from S-06) is included. This is the widest PR in the roadmap — it changes the navigation architecture and breaks a shared helper contract across four callers.

## Current State Analysis

- `src/lib/campaigns.ts` — single helper `getUserCampaign` returns the first campaign (`.limit(1).single()`); called by `battles/[id].astro`, `battles/new.astro`, `api/battles.ts` (×2). All four callers must be migrated in this PR.
- `src/pages/battles/index.astro` — current post-login landing page; will become a redirect.
- `src/pages/battles/[id].astro` — uses `getUserCampaign` to verify ownership before querying the battle; back-link points to `/battles`; redirect targets point to `/battles`.
- `src/pages/battles/new.astro` — back-link points to `/battles`; relies on `getUserCampaign` indirectly via `api/battles.ts`.
- `src/pages/api/battles.ts` — POST calls `getUserCampaign` to find the campaign; GET returns all battles for the single campaign.
- `src/pages/index.astro` — renders `Welcome` component unconditionally.
- `src/pages/dashboard.astro` — redirects to `/battles`.
- `src/middleware.ts` — PROTECTED_ROUTES = `["/battles"]`; `/campaigns` not yet protected.
- `supabase/migrations/` — campaigns table has `id, user_id, name, created_at, updated_at`; no `description` column.
- `src/pages/api/battles/[id]/generate.ts` — already exists; the battle DELETE route must go in `[id]/index.ts` (not `[id].ts`) to coexist in the same directory.

## Desired End State

After logging in, authenticated GMs land on `/campaigns` — a card list of all their campaigns (name, description, battle count, created date) with "New Campaign", rename, and delete actions. Selecting a campaign navigates to `/campaigns/[id]` which shows that campaign's battle list with a "New Battle" button and per-battle delete. Creating a new battle goes to `/battles/new?campaignId=[id]`. The battle detail page (`/battles/[id]`) is unchanged in URL; its back-link derives campaign ID from `battle.campaign_id`. Unauthenticated users hitting `/` still see the Welcome landing page.

### Key Discoveries

- `description` column must be added via a new migration file — it is nullable TEXT; the existing auto-create trigger does not need updating (NULL default is fine).
- `battle.campaign_id` is already returned by every battle query in the codebase — the back-link in `battles/[id].astro` can use it directly without any additional query.
- `battles/[id].astro` can drop `getUserCampaign` entirely: query the battle directly (`.from("battles").select("*").eq("id", id).single()`) and let RLS handle ownership. If `null`, redirect to `/campaigns`.
- The campaign list needs battle counts — use Supabase's FK relation syntax `.select("*, battles(count)")` which returns `battles: [{count: N}]` per campaign.
- `src/pages/api/battles/[id]/index.ts` is the correct path for the DELETE battle endpoint — not `[id].ts` — because `[id]/generate.ts` already occupies the `[id]/` directory and Astro cannot have both `[id].ts` and `[id]/` at the same level.
- Campaign list interactivity (rename inline + delete toggle) requires a React island (`CampaignList.tsx`). The campaign battle list also needs delete toggling (`CampaignBattleList.tsx`).

## What We're NOT Doing

- No campaign description editing after creation (description set at create time only; a future thin slice can add it)
- No campaign ordering / sorting controls
- No per-battle editing from the campaign detail page (that's `battles/[id].astro`)
- No moving battles between campaigns
- No URL restructuring for battle detail (`/battles/[id]` stays as-is)

## Implementation Approach

Four sequential phases. Phase 1 is the data and contract foundation — the migration and the lib/campaigns.ts refactor that all subsequent phases depend on. Phase 2 adds all API routes. Phase 3 adds the new campaign UI and wires navigation. Phase 4 migrates all legacy battle routes and removes the defunct `getUserCampaign` usages. The plan is designed so Phase 1 + 2 can be verified via API calls before any UI lands.

## Critical Implementation Details

**Battle DELETE route placement**: The existing `src/pages/api/battles/[id]/generate.ts` means Astro already has a `[id]/` directory under `api/battles/`. Adding `src/pages/api/battles/[id].ts` alongside it is not valid in Astro's file router — the file and directory would conflict. The DELETE endpoint must be `src/pages/api/battles/[id]/index.ts`, which maps to the route `DELETE /api/battles/[id]` as the index of the existing directory.

**Battle count via FK relation**: Supabase JS client supports `.select("*, battles(count)")` on a table that has a FK relation to `battles`. The result shape is `campaign.battles = [{count: N}]`. Extract as `campaign.battles?.[0]?.count ?? 0` on the Astro page. This avoids a second round-trip query.

**`getUserCampaign` must be fully deleted in this PR**: Leaving it creates the illusion it still works. All four call sites are migrated in Phase 4; the function is removed from `lib/campaigns.ts` in Phase 1 once the new `getUserCampaigns` is added.

---

## Phase 1: Data Layer and Library Refactor

### Overview

Add the `description` column migration, update the `Campaign` type, and replace `getUserCampaign` with `getUserCampaigns` (returns all campaigns with battle counts). Callers are updated in Phase 4 — this phase only adds the new helper and removes the old one from the file (callers will break until Phase 4, so this phase and Phase 4 should be committed together if working on a shared branch).

### Changes Required

#### 1. New migration: add description column

**File**: `supabase/migrations/20260601000001_add_campaign_description.sql`

**Intent**: Add a nullable `description TEXT` column to the campaigns table so GMs can annotate campaigns at creation time.

**Contract**: `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS description TEXT;` — nullable, no default. Filename timestamp must be later than the last existing migration (`20260527000004`).

#### 2. Update Campaign type

**File**: `src/types.ts`

**Intent**: Add `description: string | null` to the `Campaign` interface to reflect the new column.

**Contract**: Add `description: string | null` to the existing `Campaign` interface. No other type changes.

#### 3. Replace getUserCampaign with getUserCampaigns

**File**: `src/lib/campaigns.ts`

**Intent**: Remove the single-campaign helper and replace it with a multi-campaign helper that includes battle counts, enabling the campaign list page.

**Contract**: Export `getUserCampaigns(supabase: SupabaseClient, userId: string)` — queries `.from("campaigns").select("*, battles(count)").eq("user_id", userId).order("created_at", { ascending: false })` and returns the array. Remove the `getUserCampaign` export entirely. All callers that imported it will fail to compile until Phase 4 migrates them — this is intentional and surfaces the contract break at build time.

### Success Criteria

#### Automated Verification

- Migration applies cleanly against a local Supabase instance: `npx supabase db push` (or equivalent)
- TypeScript compilation passes: `npm run check`
- Linting passes: `npm run lint`

#### Manual Verification

- `campaigns` table has a `description` column (check Supabase Studio or `\d campaigns` in psql)
- Existing campaign rows have `description = null` (no data loss)

---

## Phase 2: Campaign and Battle API Routes

### Overview

Add all server-side routes: campaign CRUD (create, rename, delete) and battle DELETE. No UI yet — each route can be tested with curl or a REST client.

### Changes Required

#### 1. Campaign list + create route

**File**: `src/pages/api/campaigns/index.ts`

**Intent**: GET returns all campaigns for the authenticated user (for potential future client-side use). POST creates a new campaign with `name` (required) and `description` (optional).

**Contract**: `GET` — calls `getUserCampaigns` and returns `{ campaigns }`. `POST` — reads `name` and `description` from form data; validates name is non-empty and ≤ 200 chars; description ≤ 500 chars if present; inserts with `user_id: user.id`; redirects to `/campaigns` on success, `/campaigns?error=...` on failure. Never expose raw Supabase errors (per lessons.md).

#### 2. Campaign rename + delete route

**File**: `src/pages/api/campaigns/[id].ts`

**Intent**: PATCH renames a campaign (updates `name` and optionally `description`). DELETE deletes a campaign (cascades to all its battles and enemies).

**Contract**: Both handlers verify the authenticated user owns the campaign by checking the Supabase update/delete result affected exactly one row (RLS rejects unauthorized writes silently — a 0-row result means not found or not owned; return 404). `PATCH` — reads `name` from JSON body; validates non-empty, ≤ 200 chars; updates `name, updated_at`; returns `{ campaign }`. `DELETE` — deletes by id; returns `{ success: true }`. Client redirects are handled on the frontend (React state update), not via server redirect.

#### 3. Battle delete route

**File**: `src/pages/api/battles/[id]/index.ts`

**Intent**: DELETE removes a battle and its enemies (cascade already defined in schema). Must be placed in `[id]/index.ts`, not `[id].ts`, to coexist with `[id]/generate.ts`.

**Contract**: `DELETE` handler. Calls `supabase.from("battles").delete().eq("id", id).select("id").single()`. If result is null (RLS rejects or not found), return 404. On success, return `{ success: true }`. No server-side redirect — the React component removes the battle from state.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run check`
- Linting passes: `npm run lint`

#### Manual Verification

- `POST /api/campaigns` with `name=Test` creates a campaign (visible in Supabase)
- `PATCH /api/campaigns/[id]` with `{"name":"Renamed"}` renames it
- `DELETE /api/campaigns/[id]` removes it and all associated battles (check cascade)
- `DELETE /api/battles/[id]` removes a battle and its enemies
- All routes return 401 when called unauthenticated

---

## Phase 3: Campaign UI and Navigation Wiring

### Overview

Add the two new campaign pages, the CampaignList and CampaignBattleList React islands, update the middleware and root/dashboard redirects.

### Changes Required

#### 1. CampaignList React component

**File**: `src/components/campaigns/CampaignList.tsx`

**Intent**: Interactive campaign list island managing rename (inline edit) and delete (inline confirmation toggle) state. Receives the initial campaign list from the Astro page as props.

**Contract**: Props: `{ campaigns: CampaignWithCount[] }` where `CampaignWithCount = Campaign & { battleCount: number }`. State: `editingId: string | null`, `renamingDraft: string`, `deletingId: string | null`, `loadingId: string | null`, `actionError: string | null`. Actions: `handleRenameStart` (sets editingId, initialises draft to current name), `handleRenameSave` (PATCH JSON to `/api/campaigns/[id]`, updates local array on success), `handleRenameCancel` (clears editingId), `handleDeleteStart` (sets deletingId), `handleDeleteConfirm` (DELETE `/api/campaigns/[id]`, removes from local array), `handleDeleteCancel`. Each campaign row links to `/campaigns/[id]` as a plain anchor; the rename and delete actions are in a footer/actions area on the card. Clicking the campaign name/card (not the action buttons) navigates. Delete confirmation copy: `"Delete '${name}' and its ${battleCount} battle${battleCount !== 1 ? 's' : ''}?"`.

#### 2. CampaignCard visual component

**File**: `src/components/campaigns/CampaignCard.astro`

**Intent**: Read-only card component for the campaign list — matching the visual style of BattleCard.astro. Used inside CampaignList.tsx as the base layout (or CampaignList can render its own card markup).

**Contract**: Not needed as a separate Astro component since CampaignList is a React island — the card markup can live inside CampaignList.tsx directly. Skip this file; CampaignList.tsx renders its own card markup.

#### 3. CampaignBattleList React component

**File**: `src/components/campaigns/CampaignBattleList.tsx`

**Intent**: Battle list for a specific campaign with per-battle delete confirmation. Replaces the static BattleCard loop in the current `battles/index.astro` with an interactive version.

**Contract**: Props: `{ battles: Battle[], campaignId: string }`. State: `deletingId: string | null`, `loadingId: string | null`, `actionError: string | null`. Each battle row is an anchor link to `/battles/${battle.id}`. Delete: inline toggle ("Delete this battle?" → Yes / Cancel), calls `DELETE /api/battles/${id}`, removes from local array on success. Battle row displays name, party level, location, created date — same fields as BattleCard.astro.

#### 4. Campaigns list page

**File**: `src/pages/campaigns/index.astro`

**Intent**: Post-login campaign list. Fetches all campaigns with battle counts server-side and hands off to `CampaignList`.

**Contract**: Protected by middleware (added in step 6). Reads `user` from `Astro.locals.user`; if null, redirect to `/auth/signin`. Calls `getUserCampaigns(supabase, user.id)`. Maps the `battles` FK count field to `battleCount` for each campaign. Renders page heading, a "New Campaign" form (inline at top — `name` + optional `description` inputs, POST to `/api/campaigns`), and `<CampaignList campaigns={...} client:load />`. Reads `?error=` for the error banner.

**Addendum (2026-06-02 impl review)**: Campaign creation implemented as a separate React island (`CreateCampaignForm.tsx`) sending JSON via fetch instead of an inline HTML form with native POST. The API POST handler reads JSON body accordingly. Error handling is fully client-side within the component (no `?error=` query param). This provides better UX (toggle open/close, loading states, client-side redirect to `/campaigns/${id}`).

#### 5. Campaign detail / battle list page

**File**: `src/pages/campaigns/[id].astro`

**Intent**: Battle list for a specific campaign. Replaces `battles/index.astro` as the battle-list destination.

**Contract**: Reads `id` from `Astro.params`. Queries campaign directly: `supabase.from("campaigns").select("*").eq("id", id).single()` — RLS ensures it belongs to the user; if null, redirect to `/campaigns`. Queries battles: `supabase.from("battles").select("*").eq("campaign_id", id).order("created_at", { ascending: false })`. Renders heading (campaign name), "New Battle" button linking to `/battles/new?campaignId=${id}`, `<CampaignBattleList battles={...} campaignId={id} client:load />`, and a sign-out form.

#### 6. Add /campaigns to PROTECTED_ROUTES

**File**: `src/middleware.ts`

**Intent**: Ensure `/campaigns` and `/campaigns/[id]` require authentication, consistent with `/battles`.

**Contract**: Change `PROTECTED_ROUTES = ["/battles"]` to `PROTECTED_ROUTES = ["/battles", "/campaigns"]`.

#### 7. Update root page

**File**: `src/pages/index.astro`

**Intent**: Redirect authenticated users to `/campaigns`; show the Welcome landing page for unauthenticated users.

**Contract**: In the frontmatter: `if (Astro.locals.user) return Astro.redirect("/campaigns")`. Remove the static `<Welcome />` import and render it only in the non-redirect path (i.e., no user → render Welcome as before).

**Addendum (2026-06-02 impl review)**: Intentionally NOT implemented. The root page renders the Welcome landing page for all users. Authenticated users reach `/campaigns` via the post-login redirect through `dashboard.astro`. Keeping "/" as the public landing page allows authenticated users to view it without signing out.

#### 8. Update dashboard redirect

**File**: `src/pages/dashboard.astro`

**Intent**: This page currently redirects to `/battles`; update to `/campaigns`.

**Contract**: Change `return Astro.redirect("/battles")` to `return Astro.redirect("/campaigns")`.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run check`
- Linting passes: `npm run lint`

#### Manual Verification

- Unauthenticated visit to `/` shows the Welcome landing page
- Authenticated visit to `/` redirects to `/campaigns`
- `/campaigns` shows the campaign list with battle counts
- Inline "New Campaign" form creates a campaign and it appears in the list
- Clicking a campaign card navigates to `/campaigns/[id]` with its battles
- Renaming a campaign inline updates the name without page reload
- Delete confirmation copy shows battle count; confirming removes the campaign and its battles
- `/campaigns/[id]` "New Battle" button links to `/battles/new?campaignId=[id]`
- Deleting a battle from the campaign detail removes it from the list

---

## Phase 4: Legacy Route Migration

### Overview

Migrate all four existing callers of the now-deleted `getUserCampaign`, update back-links, and ensure all `/battles/*` routes work correctly under the new multi-campaign world.

### Changes Required

#### 1. Convert battles/index.astro to redirect

**File**: `src/pages/battles/index.astro`

**Intent**: This page is replaced by `/campaigns/[id]`. Redirect all traffic to `/campaigns` so existing links don't 404.

**Contract**: Replace all page content with a single frontmatter redirect: `return Astro.redirect("/campaigns", 301)`.

#### 2. Migrate battles/[id].astro

**File**: `src/pages/battles/[id].astro`

**Intent**: Remove the `getUserCampaign` call; query the battle directly (RLS handles ownership); derive the campaign back-link from `battle.campaign_id`.

**Contract**: Remove `getUserCampaign` import and its call. Replace battle query with `supabase.from("battles").select("*").eq("id", id).single()` — no campaign_id filter needed (RLS enforces it). If result is null, redirect to `/campaigns`. Change back-link `href` from `/battles` to `/campaigns/${battle.campaign_id}`. Change all other `/battles` redirect targets to `/campaigns`.

#### 3. Migrate battles/new.astro

**File**: `src/pages/battles/new.astro`

**Intent**: The new-battle form now requires a `?campaignId` query param. Read it, pass to the form as a hidden field, and redirect to `/campaigns` if absent.

**Contract**: Read `const campaignId = Astro.url.searchParams.get("campaignId")`. If null or empty, `return Astro.redirect("/campaigns?error=" + encodeURIComponent("Select a campaign to create a battle"))`. Pass `campaignId` as a prop to `CreateBattleForm`. Update back-link from `/battles` to `/campaigns/${campaignId}`.

#### 4. Add hidden campaignId to CreateBattleForm

**File**: `src/components/battles/CreateBattleForm.tsx`

**Intent**: The form needs to submit `campaign_id` to the API so the server knows which campaign to create the battle under.

**Contract**: Add `campaignId: string` to props. Render `<input type="hidden" name="campaign_id" value={campaignId} />` inside the form. No other changes to validation or submission logic.

#### 5. Migrate api/battles.ts

**File**: `src/pages/api/battles.ts`

**Intent**: Remove `getUserCampaign` calls. POST reads `campaign_id` from form data and verifies ownership. GET requires `?campaignId` query param.

**Contract**: `POST` — read `campaign_id` from `form.get("campaign_id")`; if empty, redirect to `/campaigns?error=...`. Verify ownership by inserting with `campaign_id` — RLS will reject if the campaign doesn't belong to the user (the insert will fail); return a clean error. Remove `getUserCampaign` import. `GET` — read `campaignId` from `context.url.searchParams`; if absent, return `Response.json({ error: "campaignId required" }, { status: 400 })`; query battles filtered by `campaign_id`.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes (no `getUserCampaign` import errors): `npm run check`
- Linting passes: `npm run lint`

#### Manual Verification

- `/battles` redirects to `/campaigns` (301)
- `/battles/[existing-id]` still loads the battle detail page with the correct back-link pointing to `/campaigns/[campaign_id]`
- `/battles/new?campaignId=[id]` shows the new-battle form with campaign context
- `/battles/new` without campaignId redirects to `/campaigns` with an error
- Creating a battle from `/campaigns/[id]` via "New Battle" → form → submit lands on the battle detail page
- `GET /api/battles` without `?campaignId` returns 400
- Existing auto-created "Default Campaign" is visible and all its battles are accessible

---

## Testing Strategy

### Manual Testing Steps (full end-to-end)

1. Sign up as a new user; verify you land on `/campaigns` with the auto-created "Default Campaign"
2. Create a second campaign with name and description; verify it appears in the list
3. Rename the first campaign inline; verify name updates without page reload
4. Click a campaign; verify the battle list for that campaign
5. Click "New Battle"; verify the form shows and `campaign_id` is in the hidden field
6. Create a battle; verify you land on the battle detail with correct back-link to `/campaigns/[id]`
7. From the campaign detail page, delete a battle; verify it disappears with inline confirmation
8. Delete a campaign with battles; verify count in confirmation message; confirm; verify cascade removes battles
9. Navigate directly to `/battles` — verify redirect to `/campaigns`
10. Navigate directly to `/battles/new` (no campaignId) — verify redirect to `/campaigns` with error
11. Open the Welcome page as a logged-out user at `/` — verify it still shows
12. Log in — verify immediate redirect to `/campaigns`

## Migration Notes

The `description` column migration must be applied to Supabase before deploying this change. Existing campaigns will have `description = null`. No data loss. The auto-create trigger does not need updating.

## References

- Campaigns migration: `supabase/migrations/20260527000001_create_campaigns.sql`
- Battles migration: `supabase/migrations/20260527000002_create_battles.sql`
- Current lib: `src/lib/campaigns.ts`
- Parallelization analysis: `context/changes/campaign-management/change.md`
- Lessons: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Data Layer and Library Refactor

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db push` — aa685f8
- [x] 1.2 TypeScript compilation passes: `npm run check` — aa685f8
- [x] 1.3 Linting passes: `npm run lint` — aa685f8

#### Manual

- [ ] 1.4 `campaigns` table has `description` column
- [ ] 1.5 Existing rows have `description = null`

### Phase 2: Campaign and Battle API Routes

#### Automated

- [x] 2.1 TypeScript compilation passes: `npm run check` — fb375ff
- [x] 2.2 Linting passes: `npm run lint` — fb375ff

#### Manual

- [ ] 2.3 POST /api/campaigns creates a campaign
- [ ] 2.4 PATCH /api/campaigns/[id] renames it
- [ ] 2.5 DELETE /api/campaigns/[id] removes it with cascade
- [ ] 2.6 DELETE /api/battles/[id] removes battle and enemies
- [ ] 2.7 All routes return 401 unauthenticated

### Phase 3: Campaign UI and Navigation Wiring

#### Automated

- [x] 3.1 TypeScript compilation passes: `npm run check` — ebfd492
- [x] 3.2 Linting passes: `npm run lint` — ebfd492

#### Manual

- [ ] 3.3 Unauthenticated / shows Welcome page
- [ ] 3.4 Authenticated / redirects to /campaigns
- [ ] 3.5 /campaigns shows campaign list with counts
- [ ] 3.6 New campaign form works
- [ ] 3.7 Inline rename works without reload
- [ ] 3.8 Delete confirmation shows battle count; cascade confirmed
- [ ] 3.9 /campaigns/[id] battle list renders with New Battle link
- [ ] 3.10 Battle delete from campaign detail works

### Phase 4: Legacy Route Migration

#### Automated

- [x] 4.1 TypeScript compilation passes (no getUserCampaign errors): `npm run check` — 946a219
- [x] 4.2 Linting passes: `npm run lint` — 946a219

#### Manual

- [ ] 4.3 /battles redirects to /campaigns (301)
- [ ] 4.4 /battles/[id] loads with correct back-link
- [ ] 4.5 /battles/new?campaignId=[id] shows form
- [ ] 4.6 /battles/new without campaignId redirects with error
- [ ] 4.7 Full create-battle flow works end-to-end
- [ ] 4.8 GET /api/battles without ?campaignId returns 400
- [ ] 4.9 Default Campaign and its battles are accessible
