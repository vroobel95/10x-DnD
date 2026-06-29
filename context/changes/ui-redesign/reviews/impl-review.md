<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: "Blood & Ink" Visual Redesign

- **Plan**: context/changes/ui-redesign/plan.md
- **Scope**: All 6 phases
- **Date**: 2026-07-01
- **Verdict**: APPROVED (with minor notes)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Ornate tabs replaced with stacked sections

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; already discussed and accepted
- **Dimension**: Plan Adherence
- **Location**: src/components/battles/EnemiesSection.tsx, src/components/battles/EnvironmentSection.tsx
- **Detail**: Plan Phase 4 + success criterion 4.5 specified "ornate tabs" (Environment | Enemies). Implementation keeps the app's existing two-island stacked-section layout, restyled with section-labels. The two sections are separate React islands wired into [id].astro; tabbing them would require merging islands + rewiring fetch state. Progress row 4.5 was edited to note the deviation. The plan's "What We're NOT Doing" already de-scoped radix tabs, so this is a narrowing, not a regression — but a stated criterion not delivered as written.
- **Fix**: None needed — accept as documented deviation. Optional follow-up: add a true tabbed island later.
- **Decision**: SKIPPED — accepted as documented deviation

### F2 — Unplanned files/sections touched beyond the plan's list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; all benign or user-requested
- **Dimension**: Scope Discipline
- **Location**: src/components/battles/BattleCard.astro, src/components/ui/LibBadge.astro, src/styles/global.css, src/components/Welcome.astro
- **Detail**: Changes outside the plan's enumerated scope: BattleCard.astro + LibBadge.astro (unused) restyled for the Phase 6 zero-old-tokens gate; global.css gained a cursor-pointer base rule (Tailwind v4 fix) + dark scrollbar styling (user-requested); Welcome.astro testimonial + "free to start" sections removed (user-requested). All benign; none touch logic or data.
- **Fix**: None needed — extras are intentional. Optional: note them as a plan addendum.
- **Decision**: FIXED — added "## Post-Plan Additions" section to plan.md

### F3 — Decorative inline SVGs lack aria-hidden

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; narrowly scoped
- **Dimension**: Safety & Quality (accessibility)
- **Location**: src/components/Welcome.astro (chip, feature trio, ritual, hero CTA icons), src/components/Ornament.astro
- **Detail**: Decorative SVGs in .astro components have no aria-hidden="true". They carry no <title> so screen readers mostly ignore them, but aria-hidden is the explicit convention. jsx-a11y doesn't lint .astro inline SVG, so these slipped the linter. Interactive icon buttons (Topbar) correctly use aria-label, so functional a11y is fine — polish only.
- **Fix**: Add aria-hidden="true" to the decorative SVGs in the .astro files.
- **Decision**: FIXED — aria-hidden="true" added to all decorative SVGs in Welcome.astro + Ornament.astro
