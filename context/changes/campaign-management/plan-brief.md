# Campaign Management — Plan Brief

> Full plan: `context/changes/campaign-management/plan.md`

## What & Why

Replace the silent single-campaign assumption with a full campaign list: GMs see all their campaigns on login, can create, rename, and delete them. Battle deletion (S-06) is folded in. Without this slice, GMs are locked into one nameless campaign and have no way to organise encounters across different parties or settings.

## Starting Point

Every user has one auto-created "Default Campaign" (DB trigger). All current pages — `battles/index.astro`, `battles/[id].astro`, `battles/new.astro`, `api/battles.ts` — assume a single campaign via `getUserCampaign()`. The root `/` renders the Welcome page unconditionally. `/campaigns` does not exist.

## Desired End State

Login → `/campaigns` (card list with battle counts, create/rename/delete). Click a campaign → `/campaigns/[id]` (battle list, new-battle button, per-battle delete). New battle → `/battles/new?campaignId=[id]`. Battle detail (`/battles/[id]`) unchanged in URL; back-link derived from `battle.campaign_id`. Unauthenticated users still see the Welcome landing page at `/`.

## Key Decisions Made

| Decision                  | Choice                                    | Why                                                           |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| Campaign description      | Add via migration (nullable TEXT)         | GMs want to annotate campaigns with setting/party notes       |
| Campaign rename           | Yes — inline on campaign list             | Completes FR-001; small PATCH route + inline edit UX          |
| Battle URL                | Keep `/battles/[id]`                      | battle.campaign_id already in data; no URL churn              |
| New battle route          | `/battles/new?campaignId=[id]`            | Reuses existing page; one hidden field added                  |
| Delete warning            | Show battle count in confirmation         | "Delete 'X' and its 3 battles?" prevents accidental data loss |
| Campaign list UI          | React island (CampaignList.tsx)           | Rename + delete need client-side state                        |
| Battle list UI            | React island (CampaignBattleList.tsx)     | Delete confirmation needs client-side state                   |
| Root redirect             | Auth → /campaigns, no-auth → Welcome      | Landing page preserved for new visitors                       |
| Ownership in battles/[id] | Direct query + RLS (no getUserCampaign)   | Simpler; RLS already verified in data-schema                  |
| Missing campaignId        | Redirect to /campaigns with error         | Recoverable — GM lands where they pick a campaign             |
| GET /api/battles          | Require ?campaignId, return 400 if absent | Explicit contract; prevents cross-campaign data leaks         |

## Scope

**In scope:** Campaign list/create/rename/delete; campaign detail (battle list); battle delete (folded S-06); `description` migration; `getUserCampaign` retirement; navigation rewiring (root, dashboard, battles/index, back-links); middleware update.

**Out of scope:** Editing description after creation; campaign ordering; moving battles between campaigns; per-battle editing from campaign page.

## Architecture / Approach

Two new React islands (`CampaignList.tsx`, `CampaignBattleList.tsx`) handle interactivity on Astro SSR pages. Four new API routes. One migration. The `getUserCampaign` helper is deleted and all four callers migrated in Phase 4. The battle DELETE route lives at `api/battles/[id]/index.ts` (not `[id].ts`) due to an Astro routing constraint with the existing `[id]/generate.ts`.

## Phases at a Glance

| Phase                       | What it delivers                               | Key risk                                             |
| --------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| 1. Data Layer & Lib         | Migration + Campaign type + getUserCampaigns   | Migration must be applied before deploy              |
| 2. Campaign & Battle APIs   | All CRUD routes + battle DELETE                | Battle DELETE path constraint (index.ts not [id].ts) |
| 3. Campaign UI & Navigation | CampaignList, pages, middleware, root redirect | Widest phase — most new files                        |
| 4. Legacy Route Migration   | All getUserCampaign callers migrated           | Compiler errors until this phase completes           |

**Prerequisites:** F-01 and S-01 implemented (campaigns and battles tables exist, battles flow works)
**Estimated effort:** ~2-3 sessions across 4 phases

## Open Risks & Assumptions

- Phase 1 and Phase 4 must land together (or in very quick succession) on a shared branch — Phase 1 removes `getUserCampaign`, which causes compile errors until Phase 4 migrates all callers
- Supabase dashboard Redirect URLs must include the production URL before deploying (standard deployment prerequisite)
- The `battles(count)` FK relation query syntax works in `@supabase/ssr` — it is standard Supabase JS client syntax and has been confirmed to work in this stack

## Success Criteria (Summary)

- Login lands on `/campaigns` showing the auto-created "Default Campaign" with correct battle count
- Full create-campaign → create-battle → view-battle → back-to-campaign flow works end-to-end
- Deleting a campaign with battles shows the battle count in the confirmation and cascades correctly
