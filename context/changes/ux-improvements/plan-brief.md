# UX Improvements — Plan Brief

> Full plan: `context/changes/ux-improvements/plan.md`

## What & Why

The landing page still shows the generic "10x Astro Starter" placeholder identity instead of DnD 5enemy's product. BattleCard navigation links give no visual feedback on click, leaving users uncertain whether the click registered. A third fix (form submit feedback) was noted in the change brief but is already implemented.

## Starting Point

`Welcome.astro` has the original starter-kit heading, subtitle, and feature cards. `BattleCard.astro` is a bare `<a>` tag — no loading state, no script block. `CreateBattleForm.tsx` already has `setIsSubmitting(true)` wired to `SubmitButton`'s `isLoading` prop with a spinner.

## Desired End State

The landing page presents DnD 5enemy's product pitch with three product-specific feature cards. Clicking any battle card immediately fades it to 60% opacity with a wait cursor, confirming the navigation. The create-battle button is confirmed to show a spinner during the POST submit.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| BattleCard loading visual | Opacity fade (60%) + cursor:wait | Zero DOM additions — a single CSS class toggle; consistent with the project's established `disabled:opacity-50` pattern. |
| BattleCard script approach | Astro bundled `<script>` + `data-battle-card` selector | Astro de-duplicates bundled scripts, so one copy of the handler serves all cards; data attribute targeting is resilient to class renames. |
| CreateBattleForm scope | Verify-only phase, no code changes | The implementation is already complete — `change.md` notes were outdated. |

## Scope

**In scope:**
- `Welcome.astro` — heading, subtitle, three feature cards (copy + SVG icons)
- `BattleCard.astro` — `<style>` + `<script>` loading state
- `CreateBattleForm.tsx` — manual verification only

**Out of scope:**
- Accessibility enhancements (aria-busy, live regions)
- Changes to Topbar, auth pages, or any other layout components
- React island conversion of BattleCard

## Architecture / Approach

All three changes are localized to their respective component files. Phase 1 is a pure content swap in an Astro template. Phase 2 adds a CSS class (`.is-navigating`) in a scoped `<style>` block and attaches a `click` listener in a bundled `<script>` block — Astro handles de-duplication automatically. Phase 3 is manual verification with a single automated typecheck.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Landing Page Rebrand | Product-branded landing page | Wrong copy shipped — needs careful review |
| 2. BattleCard Navigation Feedback | Instant visual feedback on card click | Script not firing on keyboard Enter — covered in manual checklist |
| 3. Verify Form Submit Feedback | Confirmed working submit loading state | None — code already exists and is wired |

**Prerequisites:** None — all changes are self-contained.
**Estimated effort:** ~1 session across 3 short phases.

## Open Risks & Assumptions

- SVG icon choices for the three feature cards are left to the implementer — the plan specifies what concept each icon should convey, not the exact paths.
- Astro view transitions (if enabled later) may reset the `.is-navigating` class before the old page fully unloads — not a concern for the current SSR-only setup.

## Success Criteria (Summary)

- Landing page at `/` shows "DnD 5enemy" heading and DnD-specific feature cards
- Clicking a battle card shows an immediate opacity/cursor change before navigation
- Create Battle form submit button shows spinner + "Creating..." with a valid submission
