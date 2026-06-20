---
change_id: ux-improvements
status: impl_reviewed
created: 2026-06-01
updated: 2026-06-20
roadmap_id: S-08
prd_refs: —
---

# Change: UX Improvements

## Outcome

The landing page presents DnD 5enemy's product identity rather than the starter-kit placeholder. Users get visual feedback whenever a page load or form submission is in progress.

## Notes

### Landing page rebrand (`src/components/Welcome.astro`)

- Heading: "10x Astro Starter" → "DnD 5enemy"
- Subtitle: generic starter description → product pitch (AI-generated D&D 5e encounter cards from a natural-language description)
- Feature cards (3): replace starter benefits with product benefits — e.g. "AI-Generated Stat Blocks", "Encounter-Level Balancing", "Instant Combat Ready"

### Navigation loading feedback (`src/components/battles/BattleCard.astro`)

- BattleCard is a plain `<a>` tag — no feedback on click. The SSR battle detail page can take a visible moment to load.
- Add an inline `<script>` that sets a CSS loading class on the link element on click, showing a subtle visual state (opacity or spinner overlay) until the browser navigates away
- Keeps BattleCard as an Astro component (no React island needed for this)

### Form submit feedback (`src/components/battles/CreateBattleForm.tsx`)

- Form uses native `method="POST"` — React state set in `onSubmit` never re-renders because the browser navigates away immediately after the event handler returns
- Fix: set an `isSubmitting` state flag in `handleSubmit` before allowing the native submit to proceed; disable the submit button and show "Creating..." for the brief window before navigation
- `SubmitButton` already accepts `pendingText` — the missing piece is the state flag being set unconditionally (currently only `validate()` runs, no `isSubmitting` flag is set on success)
