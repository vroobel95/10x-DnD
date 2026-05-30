---
change_id: create-battle
status: planned
created: 2026-05-30
updated: 2026-05-30
roadmap_id: S-01
prd_refs: FR-002
---

# Change: Create Battle

## Outcome

GM can create a battle within their auto-created campaign and see it listed in the app. The dashboard becomes a battle list; creating a battle navigates to the battle's detail page (skeleton), which S-02 will fill with the enemy generation form.

## Notes

- No campaign selection UI — the single auto-created campaign is looked up by user_id at the API layer
- Form exposes name (required), party_level (optional integer), location (optional text)
- Server-side validation only — redirect with ?error= on failure, mirrors auth API route pattern
- Battle detail page is a skeleton in this slice; S-02 fills it with the generation form
- GET /api/battles returns JSON for future S-02 client-side use; dashboard queries Supabase directly (idiomatic Astro SSR)
