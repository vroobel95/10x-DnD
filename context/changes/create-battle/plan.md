# Create Battle Implementation Plan

## Overview

Implement S-01: the GM can create a battle within their auto-created campaign and see it listed on the dashboard. Creating a battle navigates to a skeleton battle detail page that S-02 will fill with the enemy generation form. This is the thinnest slice that unblocks the north star (S-02) while delivering a complete, usable feature.

## Current State Analysis

The app has a working auth flow and a placeholder dashboard that shows only the GM's email and a sign-out button. No application API routes exist yet — only three auth routes under `src/pages/api/auth/`. The `battles` table is live with RLS (F-01), and `src/types.ts` exports the `Battle` type. The middleware protects only `/dashboard`. The GM's auto-created campaign (from the DB trigger) exists in `campaigns` from the moment they sign up.

## Desired End State

- Dashboard (`/dashboard`) shows a list of the GM's battles (name, party level, created date) with a "New Battle" button/link.
- Navigating to `/battles/new` presents a form with name (required), party level (optional integer), and location (optional text).
- Submitting the form creates a battle and redirects the GM to `/battles/[id]`.
- `/battles/[id]` shows the battle's metadata and a placeholder indicating enemy generation arrives in S-02.
- All `/battles/*` routes are protected by the middleware redirect.
- `GET /api/battles` returns the GM's battles as JSON (for S-02's future client-side use).

### Key Discoveries

- `src/pages/api/auth/signin.ts` is the exact pattern to follow: `createClient` from `@/lib/supabase`, read FormData, call Supabase, `context.redirect(...)` with `?error=` on failure.
- `context.locals.user` is available in API routes (middleware runs for all requests including API routes) — use it to get `user.id` without a second `supabase.auth.getUser()` call.
- `src/pages/auth/signin.astro` is the exact pattern for the create-battle page: read `?error` from `Astro.url.searchParams`, pass as `serverError` prop to a `client:load` React form component.
- Middleware uses `startsWith` matching, so adding `"/battles"` to `PROTECTED_ROUTES` covers all `/battles/*` routes automatically.
- Dashboard queries Supabase directly in the Astro frontmatter (idiomatic SSR) — no client-side fetch needed for the list. GET /api/battles is available for S-02.
- RLS on the `battles` table enforces ownership via the FK chain (`battles.campaign_id → campaigns.user_id`). The battle detail page does not need an explicit ownership check — if Supabase returns null, the battle doesn't exist or doesn't belong to this user; redirect to dashboard.

## What We're NOT Doing

- No campaign selection UI — campaign is always looked up by `user_id`; the GM never sees or chooses it
- No client-side form validation — server-side redirect with `?error=` only, consistent with existing auth routes
- No battle editing in this slice — FR-007 is S-03
- No battle deletion in this slice — FR-009 is S-03
- No enemy list or generation form on the battle detail page — that's S-02's job
- No pagination on the battle list — out of scope for MVP scale
- No "New Battle" modal — separate `/battles/new` page keeps the pattern consistent

## Implementation Approach

Follow the existing auth route pattern exactly: Astro pages with React islands for forms, API routes that read FormData and redirect, server errors surfaced via URL params. New components go in `src/components/battles/`. New pages go in `src/pages/battles/`. The dashboard page is overhauled from a placeholder into a functional battle list.

## Critical Implementation Details

- **`updated_at` on INSERT**: The schema has no auto-update trigger — the application sets `updated_at` on every write. Always include `updated_at: new Date().toISOString()` in the INSERT payload for battles.
- **Campaign lookup failure message**: If the campaign lookup returns null, the error message should direct the GM to sign out and back in (`"No campaign found — please sign out and sign back in"`). This covers the rare edge case where the DB trigger didn't fire (e.g., trigger race on a brand-new account).
- **`party_level` parsing**: The form sends a string; parse it with `parseInt` and validate it is a positive integer before inserting. An empty string means the field was left blank — treat as `null`, not an error.

---

## Phase 1: API Layer

### Overview

Create `src/pages/api/battles.ts` exporting both `GET` (list battles as JSON) and `POST` (create a battle and redirect). This is the only server-side data layer S-01 adds.

### Changes Required

#### 1. Battles API route

**File**: `src/pages/api/battles.ts`

**Intent**: Handle battle creation (POST) and list retrieval (GET). POST is used by the create-battle form; GET returns JSON for future S-02 client-side use and is available for any server-side consumer.

**Contract**:

`POST`:
- Reads FormData fields: `name` (string), `party_level` (string, optional), `location` (string, optional).
- Creates Supabase client via `createClient(context.request.headers, context.cookies)`. If null, redirects to `/battles/new?error=Supabase+is+not+configured`.
- Gets user from `context.locals.user`. If null, redirects to `/auth/signin`.
- Looks up the user's campaign: `.from("campaigns").select("id").eq("user_id", user.id).limit(1).single()`. If not found, redirects to `/battles/new?error=<campaign-not-found message>`.
- Validates `name` is non-empty; if empty, redirects to `/battles/new?error=Battle+name+is+required`.
- Parses `party_level`: empty string → `null`; non-empty string → `parseInt`; if result is `NaN` or `≤ 0`, redirects with error.
- Inserts `{ campaign_id, name, party_level, location: location || null, updated_at: new Date().toISOString() }` into `battles`. On DB error, redirects to `/battles/new?error=<message>`.
- On success, redirects to `/battles/${battle.id}`.

`GET`:
- Same client + user check; returns `Response.json({ error: "Unauthorized" }, { status: 401 })` if not authenticated.
- Looks up campaign, queries `battles` ordered by `created_at DESC`. Returns `Response.json({ battles })`.

### Success Criteria

#### Automated Verification

- `POST /api/battles` with valid FormData creates a row in `battles` and returns a 302 to `/battles/[id]`
- `POST /api/battles` with empty name returns a 302 to `/battles/new?error=...`
- `GET /api/battles` returns `{ battles: [...] }` for an authenticated user
- `npx tsc --noEmit` reports no TypeScript errors
- `npx eslint src/pages/api/battles.ts` passes with no errors

#### Manual Verification

- Submit the create-battle form with a valid name → new battle appears in Supabase dashboard under the correct campaign_id
- Submit with an empty name → error message visible on the form page
- Submit with a non-integer party level (e.g., "abc") → error message visible

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Dashboard Overhaul

### Overview

Replace the placeholder dashboard with a battle list showing each battle's name, party level, and created date. Adds a "New Battle" link. Adds a `BattleCard.astro` component for each list item.

### Changes Required

#### 1. Battle card component

**File**: `src/components/battles/BattleCard.astro`

**Intent**: Render a single battle as a clickable card linking to `/battles/[id]`, showing name, party level (or "—" if null), and formatted created date. Follows the glassmorphic card style in `Welcome.astro`.

**Contract**: Props: `battle: Battle` (imported from `@/types`). The card is an `<a href="/battles/{battle.id}">` wrapping the card content — the entire card is clickable.

#### 2. Dashboard page overhaul

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the placeholder content with a battle list. Server-side: look up the user's campaign, fetch all battles ordered by `created_at DESC`. Render the list of BattleCard components or an empty state with a "Create your first battle" prompt.

**Contract**: Uses `createClient(Astro.request.headers, Astro.cookies)` directly in the Astro frontmatter (same pattern as middleware) to query Supabase. If campaign lookup or battle fetch fails (e.g., Supabase not configured), renders an empty list with no error — the "New Battle" button is always visible. Top of page: "My Battles" heading + "New Battle" button (`<a href="/battles/new">`).

### Success Criteria

#### Automated Verification

- `npx tsc --noEmit` reports no TypeScript errors
- `npx eslint src/pages/dashboard.astro src/components/battles/BattleCard.astro` passes

#### Manual Verification

- Sign in → dashboard shows "My Battles" heading and "New Battle" button
- After creating a battle, its card appears in the list with correct name, party level, and date
- Empty state (no battles yet) shows a helpful prompt instead of a blank list
- Clicking a battle card navigates to `/battles/[id]`

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Create Battle Page & Form

### Overview

Add `/battles/new.astro` (mirrors `signin.astro` structure) and `CreateBattleForm.tsx` (mirrors `SignInForm.tsx` structure). Exposes three fields: name (required), party level (optional integer), location (optional text).

### Changes Required

#### 1. Create battle form component

**File**: `src/components/battles/CreateBattleForm.tsx`

**Intent**: React form that POSTs to `/api/battles`. Displays server-side errors from the `serverError` prop using the existing `ServerError` component. Uses `SubmitButton` for loading state. No client-side validation — server handles it.

**Contract**: Props: `serverError: string | null`. Form: `<form method="POST" action="/api/battles">`. Three fields using the existing `FormField` component: `name` (text, required), `party_level` (number input, `min="1"`, optional), `location` (text, optional). Renders `<ServerError message={serverError} />` above the form fields (same as `SignInForm`/`SignUpForm`). Submit button text: "Create Battle".

#### 2. Create battle page

**File**: `src/pages/battles/new.astro`

**Intent**: Host the create-battle form. Reads `?error` from URL params and passes to the form component as `serverError`.

**Contract**: Mirrors `src/pages/auth/signin.astro` exactly. `const error = Astro.url.searchParams.get("error");`, then `<CreateBattleForm serverError={error} client:load />` in the page body. Title: "New Battle".

### Success Criteria

#### Automated Verification

- `npx tsc --noEmit` reports no TypeScript errors
- `npx eslint src/pages/battles/new.astro src/components/battles/CreateBattleForm.tsx` passes

#### Manual Verification

- Navigate to `/battles/new` → form renders with name, party level, and location fields
- Submit without a name → page reloads with error message visible above the form
- Submit with name "Test Battle", party level 5, location "Ice Cave" → redirected to `/battles/[id]`

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Battle Detail Skeleton & Route Guard

### Overview

Add a skeleton `/battles/[id].astro` page as the post-creation landing destination and extend middleware to protect all `/battles/*` routes.

### Changes Required

#### 1. Battle detail skeleton page

**File**: `src/pages/battles/[id].astro`

**Intent**: Display the battle's metadata (name, party level, location, created date) and a placeholder section where the enemy generation form will appear in S-02. If the battle ID doesn't exist or doesn't belong to the current user (RLS returns null), redirect to `/dashboard`.

**Contract**: `const { id } = Astro.params`. Queries `supabase.from("battles").select("*").eq("id", id).single()`. If `!battle`, `return Astro.redirect("/dashboard")`. Renders: battle name as `<h1>`, metadata chips for party level and location (omit if null), formatted created date, and a placeholder `<div>` with text "Enemy generation — coming in S-02" styled as a muted card.

#### 2. Middleware route guard

**File**: `src/middleware.ts`

**Intent**: Extend the protected routes list so all `/battles/*` routes redirect unauthenticated users to sign-in.

**Contract**: Change `const PROTECTED_ROUTES = ["/dashboard"]` to `const PROTECTED_ROUTES = ["/dashboard", "/battles"]`. No other changes.

### Success Criteria

#### Automated Verification

- `npx tsc --noEmit` reports no TypeScript errors
- `npx eslint src/pages/battles/[id].astro src/middleware.ts` passes

#### Manual Verification

- Visit `/battles/new` while signed out → redirected to `/auth/signin`
- Visit `/battles/[valid-id]` as the owning user → battle metadata visible, S-02 placeholder visible
- Visit `/battles/[id-belonging-to-another-user]` → redirected to `/dashboard` (RLS returns null)
- Visit `/battles/[nonexistent-id]` → redirected to `/dashboard`

**Implementation Note**: After completing this phase and all automated verification passes, pause for final manual sign-off that the full create-battle flow works end-to-end before marking S-01 complete.

---

## Testing Strategy

### Manual Testing Steps

1. Sign up as a new user → verify the auto-created campaign exists in Supabase (prerequisite)
2. Navigate to `/dashboard` → see empty battle list with "New Battle" button
3. Click "New Battle" → `/battles/new` form appears
4. Submit with empty name → error: "Battle name is required"
5. Submit with name "Frozen Cave Ambush", party level 5, location "Ice Cave" → redirected to `/battles/[id]`
6. Battle detail skeleton shows correct name, party level, location, created date, and S-02 placeholder
7. Navigate back to `/dashboard` → new battle card appears in the list
8. Create a second battle to verify the list shows multiple cards ordered newest-first
9. Sign out → attempt to visit `/battles/new` → redirected to `/auth/signin`

## References

- Roadmap: S-01 in `context/foundation/roadmap.md`
- PRD: FR-002 in `context/foundation/prd.md`
- Auth API route pattern: `src/pages/api/auth/signin.ts`
- Auth page pattern: `src/pages/auth/signin.astro`
- Form component pattern: `src/components/auth/SignInForm.tsx`
- Types: `src/types.ts` (`Battle`, `Campaign`)
- Supabase client: `src/lib/supabase.ts`
- Middleware: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: API Layer

#### Automated

- [x] 1.1 POST /api/battles with valid FormData creates a row and returns 302 to /battles/[id]
- [x] 1.2 POST /api/battles with empty name returns 302 to /battles/new?error=...
- [x] 1.3 GET /api/battles returns `{ battles: [...] }` for authenticated user
- [x] 1.4 npx tsc --noEmit reports no TypeScript errors
- [x] 1.5 npx eslint src/pages/api/battles.ts passes

#### Manual

- [x] 1.6 Valid form submission creates a battles row in Supabase with correct campaign_id
- [x] 1.7 Empty name submission shows error message on form page
- [x] 1.8 Non-integer party level shows error message on form page

### Phase 2: Dashboard Overhaul

#### Automated

- [x] 2.1 npx tsc --noEmit reports no TypeScript errors
- [x] 2.2 npx eslint src/pages/dashboard.astro src/components/battles/BattleCard.astro passes

#### Manual

- [x] 2.3 Sign in → dashboard shows "My Battles" heading and "New Battle" button
- [x] 2.4 After creating a battle, card appears with correct name, party level, and date
- [x] 2.5 Empty state shows helpful prompt
- [x] 2.6 Clicking a battle card navigates to /battles/[id]

### Phase 3: Create Battle Page & Form

#### Automated

- [x] 3.1 npx tsc --noEmit reports no TypeScript errors
- [x] 3.2 npx eslint src/pages/battles/new.astro src/components/battles/CreateBattleForm.tsx passes

#### Manual

- [x] 3.3 /battles/new renders form with all three fields
- [x] 3.4 Submit without name → error message visible above form
- [x] 3.5 Submit with valid data → redirect to /battles/[id]

### Phase 4: Battle Detail Skeleton & Route Guard

#### Automated

- [x] 4.1 npx tsc --noEmit reports no TypeScript errors
- [x] 4.2 npx eslint src/pages/battles/[id].astro src/middleware.ts passes

#### Manual

- [x] 4.3 /battles/new while signed out → redirect to /auth/signin
- [x] 4.4 /battles/[valid-id] shows battle metadata and S-02 placeholder
- [x] 4.5 /battles/[other-user-id] → redirect to /dashboard
- [x] 4.6 Full end-to-end flow confirmed: create → detail page → back to list
