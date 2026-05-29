---
change_id: data-schema
status: implemented
created: 2026-05-27
updated: 2026-05-29
roadmap_id: F-01
prd_refs: FR-002, FR-005, FR-007, FR-009
---

# Change: Data Schema

## Outcome

Campaigns, battles, and enemies tables are deployed via Supabase migrations with RLS enabled; a DB trigger auto-creates a default campaign on user signup; TypeScript entity types are defined in `src/types.ts`. Every downstream slice (S-01, S-02, S-03) has a typed, secure data layer to build on.

## Notes

- Enemy stat block stored as free-form JSONB — no CHECK constraint, no upfront shape lock
- RLS ownership: `user_id` on campaigns only; battles and enemies validated via FK-chain subqueries
- Enemy lifecycle: `pending` on generation insert, `confirmed` on GM approval, deleted on denial
- Default campaign created by a DB trigger (`AFTER INSERT ON auth.users`) — not application-level
- Hard deletes only; CASCADE on battle → enemy and campaign → battle relationships
