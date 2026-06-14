# Campaign New Page Implementation Plan

## Overview

Create a dedicated `/campaigns/new` page that mirrors the `/battles/new` pattern, replacing the current inline toggle/modal form on the campaigns index. The `POST /api/campaigns` endpoint is reused unchanged.

## Current State Analysis

- `src/pages/campaigns/index.astro` renders `<CreateCampaignForm client:load />` as a toggle/modal in the page header
- `src/components/campaigns/CreateCampaignForm.tsx` manages open/closed state internally; submits via `fetch` to `POST /api/campaigns` (JSON API); navigates on success via `window.location.href`
- `src/components/campaigns/CampaignList.tsx:87` empty state says "Create your first campaign above to get started." — this copy references the inline form location and will be stale after the change
- `src/pages/battles/new.astro` is the established pattern: centered card layout, `<h1>New Battle</h1>`, form component with `serverError` prop, back link
- Shared form components live at `src/components/auth/`: `FormField`, `SubmitButton`, `ServerError`
- `POST /api/campaigns` at `src/pages/api/campaigns/index.ts` accepts JSON; returns `{ campaign: { id } }` on success or `{ error: string }` on failure — no changes needed

## Desired End State

GM sees a `+ New Campaign` link-button on `/campaigns` that navigates to `/campaigns/new`. The new page uses the same centered-card layout as `/battles/new`, with a form built from shared `FormField`/`SubmitButton`/`ServerError` components. On success the user is redirected to the new campaign's detail page. On error the message appears inline. The CampaignList empty state links to `/campaigns/new` instead of referencing "above".

### Key Discoveries:

- `src/components/campaigns/CreateCampaignForm.tsx` — toggle/cancel logic (lines 5-8, 12-18, 50-59) is removed; the fetch submit logic (lines 22-48) is kept verbatim with added client-side validation
- `src/components/campaigns/CampaignList.tsx:87` — "Create your first campaign above to get started." must become a link to `/campaigns/new`
- Unlike `battles/new.astro`, the campaign page does **not** need a `serverError` query-param — errors are returned as JSON and stay in component state
- `POST /api/campaigns` is at `src/pages/api/campaigns/index.ts` (directory routing); untouched

## What We're NOT Doing

- Adding a redirect from any other source to `/campaigns/new`
- Updating any page beyond `campaigns/index.astro` and `CampaignList.tsx` (other than the form component and API endpoint)

## Implementation Approach

Phase 1 creates the new page and cleans up the form component. Phase 2 wires the index and fixes the empty state. This ordering means the new page is live before the index is updated — lower risk, easy to verify in isolation.

## Critical Implementation Details

**Architectural pivot from fetch/JSON to native form POST.** The original plan called for a fetch/JSON island pattern (form submits to API via fetch, errors stay in component state). During implementation a hydration-gap bug was discovered: with `client:load`, users can interact with the SSR HTML before React hydrates, and when React hydrates it resets controlled-input state to initial values (empty). To fix this, the implementation adopted the same native form POST pattern used by `battles/new.astro`:

- `POST /api/campaigns` was changed from a JSON API to a formData + redirect API.
- `campaigns/new.astro` reads `?error` from the URL and passes it as `serverError` prop.
- `CreateCampaignForm` uses `method="POST" action="/api/campaigns"` (no fetch); validation errors prevent submission client-side, server errors arrive via redirect query param.
- On success the API redirects to `/campaigns/${campaign.id}`; on error it redirects to `/campaigns/new?error=...`.

---

## Phase 1: New page and reworked form component

### Overview

Create `src/pages/campaigns/new.astro` and rewrite `src/components/campaigns/CreateCampaignForm.tsx` to be a clean page form using shared auth components.

### Changes Required:

#### 1. New page

**File**: `src/pages/campaigns/new.astro`

**Intent**: Dedicated campaign creation page. No query params needed — campaigns are tied to the authenticated user, not a parent resource.

**Contract**: Same structure as `battles/new.astro`. Outer wrapper: `.bg-cosmic flex min-h-screen items-center justify-center p-4`. Inner card: `w-full max-w-sm rounded-2xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur-xl`. Title: "New Campaign" (same gradient heading as battles). Renders `<CreateCampaignForm client:load />` with no props. Back link at the bottom points to `/campaigns`.

#### 2. Rewritten form component

**File**: `src/components/campaigns/CreateCampaignForm.tsx`

**Intent**: Replace the toggle/modal component with a clean page form. Adopt `FormField`, `SubmitButton`, `ServerError` for visual and behavioral consistency with `CreateBattleForm`. Keep the existing fetch/JSON submit logic and `window.location.href` redirect on success.

**Contract**:
- Props: none
- State: `name`, `description`, `errors: { name?: string }`, `serverError: string | null`, `loading: boolean`
- Client-side validation: required check on `name` before fetch (same `validate()` / `clearError()` pattern as `CreateBattleForm`)
- Fields: `name` (required, max 200) via `FormField` with `<BookOpen className="size-4" />` icon; `description` (optional, max 500) via `FormField` with `<FileText className="size-4" />` icon
- Error display: `<ServerError message={serverError} />` above the fields
- Submit: `<SubmitButton pendingText="Creating..." icon={<BookOpen className="size-4" />}>Create Campaign</SubmitButton>`
- On success: `window.location.href = /campaigns/${data.campaign.id}`
- Server error lands in `serverError` state, not thrown

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- `/campaigns/new` renders the centered card with title "New Campaign"
- Submitting with empty name shows a client-side error on the name field
- Submitting a valid name creates the campaign and redirects to `/campaigns/<new-id>`
- Submitting causes a server-side rejection (e.g. name too long) → inline error appears
- "Back to campaigns" link navigates to `/campaigns`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 2. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Index page wiring and empty state fix

### Overview

Remove the inline `CreateCampaignForm` from `campaigns/index.astro`, replace it with a plain link button to `/campaigns/new`, and update the CampaignList empty state.

### Changes Required:

#### 1. Campaign index page

**File**: `src/pages/campaigns/index.astro`

**Intent**: Remove `<CreateCampaignForm client:load />` and its import. Add a plain `<a>` link in the same header position that navigates to `/campaigns/new`.

**Contract**: The `<a href="/campaigns/new">` sits in the right slot of the existing `flex items-center justify-between` header row. Tailwind classes: `inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500`. Link text: `+ New Campaign`. Remove the `CreateCampaignForm` import line.

#### 2. CampaignList empty state

**File**: `src/components/campaigns/CampaignList.tsx`

**Intent**: Replace the stale "above" copy in the empty state (lines 82-89) with a direct call-to-action link to `/campaigns/new`.

**Contract**: Keep the outer card wrapper unchanged. Replace the second `<p>` (the "Create your first campaign above…" line) with `<a href="/campaigns/new" className="text-purple-300 hover:underline text-sm">Create your first campaign</a>`.

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- `+ New Campaign` button on `/campaigns` navigates to `/campaigns/new`
- No inline form or toggle button remains on the campaigns index
- Empty state on campaign list shows a link to `/campaigns/new` (no stale "above" copy)
- No regressions: rename and delete on existing campaigns still work

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before marking the change complete. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Manual Testing Steps:

1. Navigate to `/campaigns` — confirm `+ New Campaign` link button is present, no inline form or toggle
2. Click `+ New Campaign` — land on `/campaigns/new` centered card
3. Submit empty form — name field shows client-side error, form does not submit
4. Fill a valid name and submit — redirect to `/campaigns/<new-id>`
5. Trigger a server error (e.g., 201-char name) — inline error message appears without page reload
6. Delete all campaigns, return to `/campaigns` — empty state has working link to `/campaigns/new`
7. Click empty state link — navigates to `/campaigns/new`
8. Back link on `/campaigns/new` — navigates to `/campaigns`
9. Rename and delete an existing campaign — no regressions

## References

- Pattern source: `src/pages/battles/new.astro`
- Form component pattern: `src/components/battles/CreateBattleForm.tsx`
- Shared form components: `src/components/auth/FormField.tsx`, `src/components/auth/SubmitButton.tsx`, `src/components/auth/ServerError.tsx`
- API endpoint: `src/pages/api/campaigns/index.ts`
- Roadmap entry: S-13 in `context/foundation/roadmap.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: New page and reworked form component

#### Automated

- [x] 1.1 TypeScript compilation passes: `npm run typecheck` — 15eb5f0
- [x] 1.2 Linting passes: `npm run lint` — 15eb5f0

#### Manual

- [x] 1.3 `/campaigns/new` renders the centered card with title "New Campaign" — 15eb5f0
- [x] 1.4 Submitting with empty name shows a client-side error on the name field — 15eb5f0
- [x] 1.5 Submitting a valid name creates the campaign and redirects to `/campaigns/<new-id>` — 15eb5f0
- [x] 1.6 Server-side rejection shows inline error message — 15eb5f0
- [x] 1.7 "Back to campaigns" link navigates to `/campaigns` — 15eb5f0

### Phase 2: Index page wiring and empty state fix

#### Automated

- [x] 2.1 TypeScript compilation passes: `npm run typecheck` — 0f59839
- [x] 2.2 Linting passes: `npm run lint` — 0f59839

#### Manual

- [x] 2.3 `+ New Campaign` button on `/campaigns` navigates to `/campaigns/new` — 0f59839
- [x] 2.4 No inline form or toggle button remains on campaigns index — 0f59839
- [x] 2.5 Empty state link points to `/campaigns/new` (no stale "above" copy) — 0f59839
- [x] 2.6 No regressions: rename and delete on existing campaigns still work — 0f59839
