---
change_id: enemy-post-confirm-management
status: impl_reviewed
created: 2026-06-01
updated: 2026-06-02
roadmap_id: S-03
prd_refs: FR-007, FR-009
---

# Change: Edit and Remove Confirmed Enemies

## Outcome

GM can edit a confirmed enemy's full stat block in-place (all fields including ability text, one card at a time), and remove a confirmed enemy with an inline confirmation toggle. Both actions persist to the database immediately.

## Notes

- Edit mode is confirmed-only — pending cards keep Confirm/Deny only
- Inline edit: card flips to edit state; `editingId` lives in EnemiesSection (one at a time)
- Opening edit on a second card auto-discards unsaved changes on the first (no silent save, no warning)
- Remove toggle: "Remove" → "Confirm remove? Yes / Cancel" (`removingId` in EnemiesSection)
- PATCH body discriminant: empty body = confirm (existing behaviour); JSON body with `{stats}` = edit stats
- Server-side EnemySchema validation on edit; 422 with first Zod issue message on failure
- Both `stats` JSONB and top-level `name` column updated in sync on edit
- Abilities: name and description of existing abilities are editable; count is locked (no add/remove)
- saving_throws and skill_modifiers: values editable as number inputs; keys are fixed
