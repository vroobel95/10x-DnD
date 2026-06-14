# Campaign New Page — Plan Brief

> Full plan: `context/changes/campaign-new-page/plan.md`

## What & Why

Replace the inline toggle/modal campaign creation form on `/campaigns` with a dedicated `/campaigns/new` page, matching the UX pattern established by `/battles/new`. The inline form requires two clicks (toggle open, then submit) and is visually coupled to the list — moving creation to its own page makes the flow consistent across the app and removes JS overhead from the index page header.

## Starting Point

`campaigns/index.astro` renders `<CreateCampaignForm client:load />` in the page header — a React component that toggles between a "Create Campaign" button and an inline card form. The `POST /api/campaigns` endpoint accepts JSON and already works; no data layer changes are needed.

## Desired End State

A plain `+ New Campaign` link on `/campaigns` navigates to `/campaigns/new`, which renders a centered card page (same layout as `/battles/new`) containing the reworked `CreateCampaignForm`. The form uses the shared `FormField`, `SubmitButton`, and `ServerError` components. On success the user lands on the new campaign's detail page. The campaigns list empty state links directly to `/campaigns/new` instead of referencing the now-gone "above" form.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Form submission strategy | Keep fetch/JSON (no API change) | Roadmap S-13 explicitly calls out no API changes; the existing endpoint already works | Roadmap |
| Error display | In component state (no query-param flow) | Fetch-based API returns JSON errors — no redirect-with-error needed, unlike battles | Plan |
| CreateCampaignForm strategy | Rewrite in-place (remove toggle/modal) | The inline form is the only consumer; rewriting avoids dead code and leaves one file with one job | Plan |
| Form components | Shared FormField / SubmitButton / ServerError | Matches CreateBattleForm pattern for visual and behavioral consistency | Plan |
| Index nav trigger | Plain `<a>` link button (no JS) | Navigation doesn't need client-side JS; matches hypermedia-native approach of the rest of the index | Plan |
| CampaignList empty state | Update copy + add link to /campaigns/new | Current copy references "above" which will be stale after form removal | Plan |

## Scope

**In scope:**
- `src/pages/campaigns/new.astro` — new dedicated page
- `src/components/campaigns/CreateCampaignForm.tsx` — rewritten to plain page form with shared components
- `src/pages/campaigns/index.astro` — remove inline form, add `<a>` link button
- `src/components/campaigns/CampaignList.tsx` — update empty state copy + link

**Out of scope:**
- `POST /api/campaigns` — no changes
- Any other page or component
- Query-param error flow (serverError prop) — not applicable

## Architecture / Approach

The new page is a thin Astro shell (no server-side data fetching needed — no parent resource to validate) wrapping the reworked React form. The form keeps its fetch/JSON submit logic unchanged; only the toggle/modal shell is removed and the input/button markup is swapped for shared components. The `POST /api/campaigns` endpoint is untouched.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. New page + form | `/campaigns/new` live; `CreateCampaignForm` uses shared components | Shared component API mismatch (icon/error prop names) |
| 2. Index + empty state | Index links to new page; empty state points to `/campaigns/new` | Inadvertent regression in rename/delete on CampaignList |

**Prerequisites:** S-05 (campaign-management) implemented — `campaigns/index.astro` and `CampaignList.tsx` must exist  
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- `FormField` and `SubmitButton` accept the same props used in `CreateBattleForm` — confirmed by reading both components; if the API diverges, adjust accordingly
- No auth guard is added to `campaigns/new.astro` beyond what the existing middleware already enforces for `/campaigns/**` routes

## Success Criteria (Summary)

- `/campaigns/new` renders, accepts input, creates a campaign, and redirects to the campaign detail page
- `/campaigns` index has a plain link button and no inline form
- CampaignList empty state links to `/campaigns/new`
