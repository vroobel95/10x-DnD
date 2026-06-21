<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: i18n-polish (S-16) EN/PL Internationalization

- **Plan**: context/changes/i18n-polish/plan.md
- **Scope**: All 3 phases (complete)
- **Date**: 2026-06-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- **Plan adherence** — all planned changes present and faithful: Paraglide v2 + cookie
  strategy + middleware composed via `sequence()`; dynamic `<html lang>`; navbar
  `LocaleSwitcher` (visible when logged out); all pages/islands + API errors use `m.*()`;
  stray-Polish strings folded into the catalog; AI generation locale-aware via
  `getLocale()` → `ai.ts` language directive. "What We're NOT Doing" respected (no URL
  prefixes, no Accept-Language auto-detect, no retro-translation, no 3rd language, no
  README translation).
- **Success criteria (re-verified)**: typecheck 0 errors; lint clean; build passes; unit
  129/129; e2e 4/4. No leftover debug code. Fresh-clone safe — removing `src/paraglide`
  and running `npm run typecheck` still yields 0 errors because `astro check` regenerates
  it via the Paraglide Vite plugin.

## Findings

### F1 — Phase 2 included changes beyond pure string extraction

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/middleware.ts; tests/e2e/{seed,enemy-persistence}.spec.ts; src/pages/api/campaigns/[id].ts
- **Detail**: Beyond translating strings, Phase 2 also (a) changed the i18n middleware to
  `next(request)` — necessary because Paraglide's request clone otherwise broke
  `formData()` in POST endpoints; (b) fixed two pre-existing E2E tests (user-authorized);
  (c) unified one dev-facing 400 message "Invalid JSON body" → "Invalid request body".
  All justified/authorized; (a) and (b) documented in the commit body.
- **Fix**: None needed — recorded for traceability.
- **Decision**: ACCEPTED (no action)

### F2 — Three pre-existing UX issues found, deferred (not fixed)

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/battles/CreateBattleForm.tsx, src/components/battles/EnvironmentSection.tsx, src/lib/ai.ts
- **Detail**: Manual testing surfaced a form hydration race (Create Battle), the Generate
  Environment button needing multiple clicks, and the AI sometimes returning the wrong
  enemy count. Verified pre-existing (edits to these files were text-only) and logged in
  change.md for a separate follow-up change.
- **Fix**: None in this change — tracked for a follow-up.
- **Decision**: ACCEPTED (deferred to follow-up)
