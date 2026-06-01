---
change_id: campaign-management
status: proposed
created: 2026-06-01
updated: 2026-06-01
roadmap_id: S-05
prd_refs: FR-001, FR-011
---

# Change: Campaign Management (+ Delete Battle, folded from S-06)

## Outcome

After logging in, GM sees a list of their campaigns and can choose one, create a new campaign, or delete an existing campaign. Selecting a campaign navigates to its battle list, where each battle row has a delete button (FR-011, folded in from S-06).

## Notes

- Upgrades FR-001 from nice-to-have to must-have; replaces the silent auto-created-campaign assumption from S-01
- The dashboard flow changes: login → `/campaigns` (campaign list) → `/campaigns/[id]` (battle list, previously `/`) → battle detail
- Auto-created campaign from S-01/data-schema is preserved; it appears in the list with a default name ("Default Campaign")
- New page: `/campaigns` — lists all campaigns, "New campaign" button, delete button per row
- New page: `/campaigns/[id]` — battle list for a specific campaign, "New battle" button, delete button per battle row
- Existing `src/pages/battles/index.astro` becomes a redirect to `/campaigns`; the root `/` also redirects to `/campaigns`
- Campaign create: name (required), optional description — server action POST `/api/campaigns`
- Campaign delete: DELETE `/api/campaigns/[id]` — cascades to battles and enemies via FK ON DELETE CASCADE (already in schema)
- Battle delete (FR-011 folded): DELETE `/api/battles/[id]` — verify battle belongs to user's campaign before deleting; cascades to enemies
- `getUserCampaign` in `lib/campaigns.ts` changes contract: must support multi-campaign lookup; all existing callers (`battles/[id].astro`, `battles/new.astro`, `api/battles.ts`) must be migrated in this PR
- Back-links in `battles/[id].astro` (`/battles` → `/campaigns/[campaign_id]`) and `battles/new.astro` must be updated
- Middleware PROTECTED_ROUTES must add `/campaigns`
- If only one campaign exists, deleting it should be allowed; the GM can create a new one

## Parallel-with analysis (from 2026-06-01 review)

- Safe to run in parallel with S-03 (component-only; zero file overlap)
- Safe to run in parallel with S-04 (auth-only; zero file overlap)
- S-07 writes `battles/[id].astro` — must be based on this slice's version; S-05 added as S-07 prerequisite
