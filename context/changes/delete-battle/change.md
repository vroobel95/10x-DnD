---
change_id: delete-battle
status: proposed
created: 2026-06-01
updated: 2026-06-01
roadmap_id: S-06
prd_refs: FR-011
---

# Change: Delete Battle

## Outcome

GM can delete a battle from the battle list. All confirmed enemies attached to the battle are removed with it.

## Notes

- Delete button on each battle row in the campaign's battle list (introduced in S-05's `/campaigns/[id]` page)
- Should require confirmation to prevent accidental data loss — a simple browser `confirm()` dialog or an inline "Are you sure?" toggle is sufficient for MVP; no modal component needed
- DELETE `/api/battles/[id]` — verifies the battle belongs to the requesting user's campaign before deleting (RLS + explicit ownership check)
- Enemies cascade-delete via FK ON DELETE CASCADE already defined in data-schema
- After deletion, redirect back to the battle list (or refresh in-place)
- Sequenced after S-05 because the battle list lives under the campaign page introduced in that slice; can be implemented as part of the same PR if expedient
