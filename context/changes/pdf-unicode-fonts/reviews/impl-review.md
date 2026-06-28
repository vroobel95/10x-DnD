<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Unicode-safe PDF Export

- **Plan**: context/changes/pdf-unicode-fonts/plan.md
- **Scope**: All 3 phases
- **Date**: 2026-06-28
- **Verdict**: NEEDS ATTENTION (all findings triaged & resolved)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Automated re-run at review time: 137 tests pass · tsc clean · build OK (bundle within budget).
After triage fixes: 145 tests pass · tsc clean · lint clean.

## Findings

### F1 — Implementation modified all four file classes the plan said it would NOT touch

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural/process stakes
- **Dimension**: Scope Discipline
- **Location**: src/pages/api/battles/[id]/export.pdf.ts, src/lib/schemas/enemy.ts, src/components/battles/EnemyCard.tsx, src/lib/ai.ts
- **Detail**: The plan's "What We're NOT Doing" lists "Modifying any API route, schema, component, or Supabase query." The implementation modified all four (plus the AI prompt and a new villain-rendering feature) as Phase-3 manual-testing bug fixes — all correct and tested-green, but undocumented, leaving plan.md contradicting the shipped change.
- **Fix A ⭐ Recommended**: Add a "Scope Addendum" to plan.md documenting the three discovered bugs and why each crossed a guardrail.
  - Strength: Preserves correct work; realigns source of truth; matches how pdf-export-environment closed its own drift.
  - Tradeoff: Plan becomes a post-hoc record rather than a pure forward spec.
  - Confidence: HIGH — addendum pattern established in this repo.
  - Blind spot: None significant — work already committed and verified.
- **Decision**: FIXED via Fix A — Scope Addendum added to plan.md ("What We're NOT Doing" section).

### F2 — Net-new villain rendering and normalizeDialogueLine ship without unit tests

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real coverage gap
- **Dimension**: Pattern Consistency
- **Location**: tests/unit/lib/pdf/battle-pdf.test.ts (absence), src/lib/pdf/battle-pdf.ts:360-410, src/lib/schemas/enemy.ts:53-60
- **Detail**: The builder test file covers each rendering behavior, but the new villain profile section and the normalizeDialogueLine quote fix (the crux of the closing-quote bug) shipped with no automated coverage. The 2 Polish tests assert only the %PDF- prefix.
- **Fix**: Add a normalizeDialogueLine table test (unclosed „/", already-closed, straight-quote pass-through) + builder tests passing a villain with unclosed-quote dialogue.
  - Strength: Locks in the bug fixes against regression; trivial given existing helpers.
  - Tradeoff: Builder tests assert structure, not glyphs.
  - Confidence: HIGH — normalizeDialogueLine is pure and directly testable.
  - Blind spot: Visual rendering of U+201D still relies on manual check.
- **Decision**: FIXED — 5 normalizeDialogueLine tests added to tests/unit/lib/schemas/enemy.test.ts; 3 villain-path builder tests added to tests/unit/lib/pdf/battle-pdf.test.ts (render, ignore-non-matching-id, overflow-pagination).

### F3 — Villain profile is silently clipped when the enemy page lacks vertical space

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/lib/pdf/battle-pdf.ts:366-409
- **Detail**: The villain section used `if (y >= MARGIN)` guards and `break` when out of vertical space but never added a continuation page (unlike the environment section). A villain on an enemy with many abilities could have its profile partially/fully dropped — ironic given Phase 3 was about this section being missing.
- **Fix**: Pre-wrap the block, compute its full height, and start a fresh page (addPage + reset y) before drawing when it won't fit — mirroring the environment page's overflow handling.
  - Strength: Guarantees the profile is never clipped; consistent with the env-page pattern.
  - Tradeoff: Requires the enemy-loop `page` to be reassignable (`let`).
  - Confidence: HIGH — covered by the new overflow-pagination test.
  - Blind spot: A profile taller than a full fresh page is not handled, but that exceeds realistic profile length.
- **Decision**: FIXED — villain block now reserves height and paginates to a new page on overflow; enemy-loop `page` changed to `let`. Verified by new test "pushes the villain profile to a new page when it can't fit below the stat block".
