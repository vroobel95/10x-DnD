---
change_id: battle-environment
title: Battle Environmental Effects
status: proposed
created: 2026-06-04
updated: 2026-06-04
archived_at: null
---

## Notes

AI-generated atmospheric and environmental details for a battle: terrain features, environmental hazards, lighting, ambiance, and battleground trivia. Displayed on the battle page and persisted.

Open questions to resolve in `/10x-plan`:
- Scope: pure flavor text vs. D&D mechanical effects (difficult terrain rules, etc.) vs. both
- Generation trigger: auto on battle creation, auto when location is set, or on-demand button
- Allow regeneration?
- Storage: new column on `battles` or separate JSONB field
- UI placement on the battle page
