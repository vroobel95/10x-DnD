# UX Improvements Implementation Plan

## Overview

Three UI polish changes: rebrand the landing page from the starter-kit placeholder to DnD 5enemy's product identity, add click-feedback to BattleCard navigation links, and verify the already-implemented form submit loading state in CreateBattleForm.

## Current State Analysis

- `src/components/Welcome.astro` — heading reads "10x Astro Starter", subtitle describes the generic starter kit, and the three feature cards advertise auth/stack/DX features unrelated to the product.
- `src/components/battles/BattleCard.astro` — a plain `<a>` tag with no click feedback; SSR navigation can take a visible moment with no visual acknowledgement.
- `src/components/battles/CreateBattleForm.tsx` — `handleSubmit` already calls `setIsSubmitting(true)` after validation passes, and `SubmitButton` already receives `isLoading={isSubmitting}` with a full spinner implementation. The `change.md` notes describing this as missing are outdated.

### Key Discoveries:

- No existing `<script>` tags in any `.astro` file — the BattleCard script will be the first; Astro bundles and de-duplicates component scripts automatically.
- The project has no `cursor-wait` usage; `disabled:opacity-50` (inline CSS via `button.tsx`) is the established disabled-state pattern. For the BattleCard Astro component, inline style manipulation in the script is safer than Tailwind dynamic class scanning.
- `SubmitButton` (`src/components/auth/SubmitButton.tsx:13`) fully implements the loading state: spinner, `pendingText`, and `disabled`. No code changes are needed there.

## Desired End State

- Landing page: heading is "DnD 5enemy", subtitle pitches the AI encounter-card generator, and the three feature cards describe "AI-Generated Stat Blocks", "Encounter-Level Balancing", and "Instant Combat Ready".
- BattleCard: clicking any battle card immediately dims it to ~60% opacity and sets `cursor: wait`, giving users instant visual confirmation of navigation.
- CreateBattleForm: confirmed working — submitting a valid form disables the button and shows "Creating..." for the navigation window.

## What We're NOT Doing

- No new React islands in BattleCard — the loading feedback stays as an Astro `<script>` block.
- No changes to auth pages, the Topbar, or other layout components.
- No changes to `SubmitButton` or `CreateBattleForm` — the implementation is already correct.
- No accessibility overhaul — `aria-busy` or ARIA live regions are out of scope for this pass.

## Implementation Approach

Phase 1 is pure content: swap copy and SVG icons in `Welcome.astro`. Phase 2 adds a `<style>` + `<script>` block to `BattleCard.astro` using Astro's bundled script pattern and `data-*` attribute targeting. Phase 3 is a verification-only phase — no code changes, just manual confirmation that the existing form loading state works as intended.

---

## Phase 1: Landing Page Rebrand

### Overview

Replace all placeholder content in `Welcome.astro` with DnD 5enemy product identity: heading, subtitle, and three feature cards.

### Changes Required:

#### 1. Hero heading and subtitle

**File**: `src/components/Welcome.astro`

**Intent**: Change the `<h1>` text from "10x Astro Starter" to "DnD 5enemy" and replace the generic subtitle with a product pitch.

**Contract**: `<h1>` text node → `DnD 5enemy`. `<p>` subtitle text → `Generate AI-powered D&D 5e encounter cards from a natural-language description. Balanced, combat-ready, and instant.`

#### 2. Feature card 1 — AI-Generated Stat Blocks

**File**: `src/components/Welcome.astro`

**Intent**: Replace the "Authentication Ready" card with a card describing AI stat block generation. Keep the same `<div>` / SVG / `<h3>` / `<p>` structure — only the SVG path, heading text, and body text change.

**Contract**: Heading → `AI-Generated Stat Blocks`. Body → `Describe an enemy in plain English and get a complete 5e stat block in seconds.` SVG → a wand, sparkle, or brain icon (inline SVG following the same 24×24 `stroke="currentColor"` pattern used by the existing cards).

#### 3. Feature card 2 — Encounter-Level Balancing

**File**: `src/components/Welcome.astro`

**Intent**: Replace the "Modern Stack" card with a card describing encounter difficulty balancing.

**Contract**: Heading → `Encounter-Level Balancing`. Body → `Set your party level and size; the system calibrates challenge ratings to match.` SVG → a scales/balance or shield icon.

#### 4. Feature card 3 — Instant Combat Ready

**File**: `src/components/Welcome.astro`

**Intent**: Replace the "Developer Experience" card with a card describing instant usability of generated encounters.

**Contract**: Heading → `Instant Combat Ready`. Body → `Encounter cards are formatted and ready to use at the table the moment they're generated.` SVG → crossed swords or lightning bolt icon.

### Success Criteria:

#### Automated Verification:

- TypeScript / Astro build passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Landing page (`/`) shows "DnD 5enemy" as the heading
- Subtitle reads the product pitch (not the starter-kit description)
- Three feature cards show the DnD 5enemy product benefits with appropriate icons
- No regressions in other pages (Sign In, Sign Up, battles list)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: BattleCard Navigation Feedback

### Overview

Add a `<style>` block and a bundled `<script>` block to `BattleCard.astro` so clicking any battle card immediately applies an opacity-fade + cursor:wait loading state.

### Changes Required:

#### 1. Data attribute on the anchor element

**File**: `src/components/battles/BattleCard.astro`

**Intent**: Mark the `<a>` element with a `data-battle-card` attribute so the bundled script can target it without relying on CSS selectors that could break if the class list changes.

**Contract**: Add `data-battle-card` (no value needed) to the existing `<a>` element.

#### 2. Scoped loading style

**File**: `src/components/battles/BattleCard.astro`

**Intent**: Define the visual loading state as a CSS class rather than inline styles set by JS, so the visual contract is readable in one place.

**Contract**: Add a `<style>` block (Astro scoped by default) with:

```css
a[data-battle-card].is-navigating {
  opacity: 0.6;
  cursor: wait;
  pointer-events: none;
  transition: opacity 150ms ease;
}
```

#### 3. Bundled click listener script

**File**: `src/components/battles/BattleCard.astro`

**Intent**: On click, add `is-navigating` to the card's anchor element. Astro bundles and de-duplicates `<script>` blocks from components automatically, so one copy of this handler serves all cards on the page.

**Contract**: Add a `<script>` block (no `is:inline` — let Astro bundle it). The script uses `querySelectorAll('[data-battle-card]')` and attaches a `click` listener that calls `link.classList.add('is-navigating')`. No cleanup is needed — the class resets on navigation.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Clicking a battle card immediately shows the opacity-fade and wait cursor
- The loading state persists until the new page loads
- Multiple cards on the battles list each respond independently to their own click
- Keyboard navigation (Enter on a focused card) also triggers the loading state

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Verify Form Submit Feedback

### Overview

No code changes. Confirm that `CreateBattleForm.tsx`'s existing `isSubmitting` implementation functions correctly end-to-end.

### Changes Required:

_(none)_

### Success Criteria:

#### Automated Verification:

- TypeScript check passes: `npm run typecheck`

#### Manual Verification:

- Navigate to the Create Battle form
- Fill in a valid battle name and click "Create Battle"
- Button immediately disables and shows spinner + "Creating..." text
- Browser navigates to the new battle page after the POST completes
- Submitting with an empty name shows the validation error without triggering the loading state

---

## Phase 4: Topbar Redesign + Global Header

### Overview

Redesign the Topbar to be a sticky full-width header, move it into Layout.astro so it appears on every page, and remove inline sign-out buttons from page bodies.

### Changes Required:

#### 1. Redesign Topbar.astro

**File**: `src/components/Topbar.astro`

**Intent**: Replace the current pill-shaped Topbar with a sticky, full-width header. Logged-in: email on left, home icon link + sign-out button on right. Logged-out: "Not signed in" text only (no sign-in/sign-up links here — those live on the landing page).

**Contract**: `sticky top-0 z-20`, `border-b border-white/10 bg-black/40 backdrop-blur-xl`. Use a `<header>` element. Home icon → inline SVG house (24×24 stroke), links to `/`. Sign-out button uses rose-300/rose-100 colors.

#### 2. Move Topbar into Layout.astro

**File**: `src/layouts/Layout.astro`

**Intent**: Import Topbar and render it as the first child of `<body>`. Update the default page title.

**Contract**: `<Topbar />` renders before the banner list and `<slot />`. Default `title` prop changes from `"10x Astro Starter"` to `"DnD 5enemy"`.

#### 3. Remove Topbar from Welcome.astro

**File**: `src/components/Welcome.astro`

**Intent**: Topbar now comes from Layout, so the import and usage in Welcome.astro must be removed.

**Contract**: No `import Topbar` line, no `<Topbar />` element.

#### 4. Remove sign-out from campaigns/index.astro

**File**: `src/pages/campaigns/index.astro`

**Intent**: The inline sign-out form at the bottom is now redundant — the Topbar handles it.

**Contract**: Remove the `<form method="POST" action="/api/auth/signout">` block entirely.

#### 5. Remove sign-out from campaigns/[id].astro

**File**: `src/pages/campaigns/[id].astro`

**Intent**: Same — remove the inline sign-out form at the bottom.

**Contract**: Remove the `<form method="POST" action="/api/auth/signout">` block entirely.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Topbar is visible on every page (landing, campaigns list, campaign detail, battle detail)
- Topbar sticks to the top when scrolling
- Logged-in: email on left, home icon + Sign out on right
- Logged-out: "Not signed in" on left only, no links
- Sign-out works and redirects to sign-in
- Home icon navigates to `/`
- Campaigns list and campaign detail no longer show inline sign-out button

---

## Phase 5: Rose-800 Color Theme

### Overview

Replace all interactive UI purple accents with rose-800 (dark maroon). Preserve decorative elements: cosmic orbs (`bg-purple-500/20`) and heading gradients (`from-blue-200 via-purple-200 to-pink-200`) stay purple.

### Changes Required:

#### 1. SubmitButton.tsx

**File**: `src/components/auth/SubmitButton.tsx`

**Contract**: `bg-purple-600 hover:bg-purple-500` → `bg-rose-800 hover:bg-rose-700`.

#### 2. BattleHeader.tsx

**File**: `src/components/battles/BattleHeader.tsx`

**Contract**: Save Changes button: `bg-purple-600 hover:bg-purple-500` → `bg-rose-800 hover:bg-rose-700`.

#### 3. EnemiesSection.tsx

**File**: `src/components/battles/EnemiesSection.tsx`

**Contract**: Generate and Export PDF buttons: `bg-purple-600 hover:bg-purple-500` → `bg-rose-800 hover:bg-rose-700`. Textarea focus ring: `focus:border-purple-500/50 focus:ring-purple-500/50` → `focus:border-rose-500/50 focus:ring-rose-500/50`.

#### 4. EnemyCard.tsx

**File**: `src/components/battles/EnemyCard.tsx`

**Contract**: Confirm button and Edit form Save button: `bg-purple-600 hover:bg-purple-500` → `bg-rose-800 hover:bg-rose-700`. All input focus borders: `focus:border-purple-500/50` → `focus:border-rose-500/50`.

#### 5. EnvironmentSection.tsx

**File**: `src/components/battles/EnvironmentSection.tsx`

**Contract**: `bg-purple-600 hover:bg-purple-500` → `bg-rose-800 hover:bg-rose-700`.

#### 6. CampaignList.tsx

**File**: `src/components/campaigns/CampaignList.tsx`

**Contract**: Rename Save button: `bg-purple-600 hover:bg-purple-500` → `bg-rose-800 hover:bg-rose-700`. Campaign link hover: `hover:text-purple-300` → `hover:text-rose-300`. Rename input focus: `focus:border-purple-400/60` → `focus:border-rose-400/60`.

#### 7. CampaignBattleList.tsx

**File**: `src/components/campaigns/CampaignBattleList.tsx`

**Contract**: Empty-state CTA: `bg-purple-600 hover:bg-purple-500` → `bg-rose-800 hover:bg-rose-700`. Battle link hover: `hover:text-purple-300` → `hover:text-rose-300`. Card hover border: `hover:border-purple-400/30` → `hover:border-rose-400/30`.

#### 8. Welcome.astro

**File**: `src/components/Welcome.astro`

**Contract**: Hero CTA button: `bg-purple-600 hover:bg-purple-500` → `bg-rose-800 hover:bg-rose-700`. Campaign card hover border: `hover:border-purple-400/30` → `hover:border-rose-400/30`. Empty state link: `text-purple-300 hover:text-purple-200` → `text-rose-300 hover:text-rose-200`. Feature card SVG icons: `class="mb-4 text-purple-300"` → `class="mb-4 text-rose-300"` (×3). Do NOT touch `bg-purple-500/20` or heading gradients.

#### 9. campaigns/index.astro

**File**: `src/pages/campaigns/index.astro`

**Contract**: New Campaign button: `bg-purple-600 hover:bg-purple-500` → `bg-rose-800 hover:bg-rose-700`.

#### 10. campaigns/[id].astro

**File**: `src/pages/campaigns/[id].astro`

**Contract**: New Battle button: `bg-purple-600 hover:bg-purple-500` → `bg-rose-800 hover:bg-rose-700`.

#### 11. BattleCard.astro

**File**: `src/components/battles/BattleCard.astro`

**Contract**: Card hover border: `hover:border-purple-400/30` → `hover:border-rose-400/30`.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- All primary action buttons are dark maroon (rose-800), not purple
- Card hover borders are rose-tinted, not purple
- Form focus rings are rose-tinted, not purple
- Heading gradients and cosmic orbs remain purple (unchanged)
- No visual regression on auth pages (Sign In / Sign Up)

---

## Testing Strategy

### Manual Testing Steps:

1. Load `/` and verify the heading, subtitle, and all three feature card texts
2. Navigate to the battles list; click a battle card and watch for the opacity fade before navigation
3. Navigate to `/battles/new` (or equivalent create-battle entry point); submit with a valid name and observe the button loading state
4. Submit with an empty name to confirm validation still blocks submission and no loading state appears

## References

- Change identity: `context/changes/ux-improvements/change.md`
- `SubmitButton` implementation: `src/components/auth/SubmitButton.tsx`
- Existing opacity pattern: `src/components/ui/button.tsx:8` (`disabled:opacity-50`)

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Landing Page Rebrand

#### Automated

- [x] 1.1 Build passes: `npm run build` — f1abda9
- [x] 1.2 Linting passes: `npm run lint` — f1abda9

#### Manual

- [x] 1.3 Landing page shows "DnD 5enemy" as the heading — f1abda9
- [x] 1.4 Subtitle reads the product pitch — f1abda9
- [x] 1.5 Three feature cards show DnD 5enemy product benefits with appropriate icons — f1abda9
- [x] 1.6 No regressions in other pages (Sign In, Sign Up, battles list) — f1abda9

### Phase 2: BattleCard Navigation Feedback

#### Automated

- [x] 2.1 Build passes: `npm run build` — 2b9fc93
- [x] 2.2 Linting passes: `npm run lint` — 2b9fc93

#### Manual

- [x] 2.3 Clicking a battle card immediately shows opacity-fade and wait cursor — 2b9fc93
- [x] 2.4 Loading state persists until the new page loads — 2b9fc93
- [x] 2.5 Multiple cards each respond independently to their own click — 2b9fc93
- [x] 2.6 Keyboard navigation (Enter on focused card) also triggers loading state — 2b9fc93

### Phase 3: Verify Form Submit Feedback

#### Automated

- [x] 3.1 TypeScript check passes: `npm run typecheck`

#### Manual

- [x] 3.2 Submit with valid name: button disables and shows "Creating..."
- [x] 3.3 Submit with empty name: validation error shows, no loading state triggered

### Phase 4: Topbar Redesign + Global Header

#### Automated

- [x] 4.1 Build passes: `npm run build`
- [x] 4.2 Linting passes: `npm run lint`

#### Manual

- [x] 4.3 Topbar visible on every page (landing, campaigns, campaign detail, battle detail)
- [x] 4.4 Topbar sticks to top when scrolling
- [x] 4.5 Logged-in: email left, home icon + Sign out right
- [x] 4.6 Logged-out: navbar hidden entirely (revised from "Not signed in" text)
- [x] 4.7 Sign-out works and redirects to sign-in
- [x] 4.8 Home icon navigates to `/`
- [x] 4.9 Campaigns list and campaign detail no longer show inline sign-out

### Phase 5: Rose-800 Color Theme

#### Automated

- [x] 5.1 Build passes: `npm run build`
- [x] 5.2 Linting passes: `npm run lint`

#### Manual

- [x] 5.3 Primary action buttons are dark maroon (rose-800), not purple
- [x] 5.4 Card hover borders are rose-tinted, not purple
- [x] 5.5 Form focus rings are rose-tinted, not purple
- [x] 5.6 Heading gradients and cosmic orbs remain purple (unchanged)
- [x] 5.7 No visual regression on auth pages (Sign In / Sign Up)
