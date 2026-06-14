---
change_id: main-enemy-profile
title: Main Enemy Profile
status: implementing
created: 2026-06-04
updated: 2026-06-14
archived_at: null
---

## Notes

If a battle has a designated main enemy (boss/villain), generate and display a profile card containing:
- Narrative description (appearance, backstory hook)
- Unique characteristics and tactics
- 3 example roleplay dialogue lines (for GM use at the table)

Open questions to resolve in `/10x-plan`:
- Designation UX: toggle on enemy card, field on battle creation, or auto-inferred from highest CR?
- Storage: new `main_enemy_profile` JSONB column on `battles` or extended field on the `enemies` row?
- Generation trigger: on designation or separate on-demand button?
- Whether the profile regenerates if stats are edited
