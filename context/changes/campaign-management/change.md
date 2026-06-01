---
change_id: campaign-management
status: proposed
created: 2026-06-01
updated: 2026-06-01
roadmap_id: S-05
prd_refs: FR-001
---

# Change: Campaign Management

## Outcome

After logging in, GM sees a list of their campaigns and can choose one, create a new campaign, or delete an existing campaign. Selecting a campaign navigates to its battle list (currently the dashboard from S-01).

## Notes

- Upgrades FR-001 from nice-to-have to must-have; replaces the silent auto-created-campaign assumption from S-01
- The dashboard flow changes: login → `/campaigns` (campaign list) → `/campaigns/[id]` (battle list, previously `/`) → battle detail
- Auto-created campaign from S-01/data-schema is preserved; it appears in the list with a default name ("Default Campaign")
- New page: `/campaigns` — lists all campaigns, "New campaign" button, delete button per row
- Existing `src/pages/index.astro` battle-list page moves to `/campaigns/[id]` (or the route is replicated); the root `/` redirects to `/campaigns`
- Campaign create: name (required), optional description — server action POST `/api/campaigns`
- Campaign delete: DELETE `/api/campaigns/[id]` — cascades to battles and enemies via FK ON DELETE CASCADE (already in schema)
- If only one campaign exists, deleting it should be allowed; the GM can create a new one
- Middleware route guard must cover both `/campaigns` and `/campaigns/[id]`
