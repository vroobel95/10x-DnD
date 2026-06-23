<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Battle Environment in PDF Export

- **Plan**: context/changes/pdf-export-environment/plan.md
- **Scope**: Phases 1–2 (full plan)
- **Date**: 2026-06-23
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Environment drawn without the safeParse-and-skip defense enemies get

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability) / Pattern Consistency
- **Location**: src/lib/pdf/battle-pdf.ts (env block vs enemy block)
- **Detail**: The enemy loop re-validates each row with `EnemySchema.safeParse` and skips invalid ones (defensive, because JSONB from Supabase isn't guaranteed to match its declared type). The environment block trusted `battle.environment` and drew it directly; the route passed the raw Supabase value without `BattleEnvironmentSchema` validation. A malformed/partial environment → `drawText(undefined)` → whole export 500s, losing the enemy pages too.
- **Fix**: Guard the env page with `BattleEnvironmentSchema.safeParse(battle.environment)` and skip drawing when it fails, mirroring the enemy `if (!parsed.success) continue` pattern.
  - Strength: Restores parity with the enemy defense; one bad env row can't abort a document that still has valid enemy cards.
  - Tradeoff: A couple lines + a schema import; a malformed env silently produces no env page (acceptable — matches enemy behavior).
  - Confidence: HIGH — identical pattern five lines away in the same function.
  - Blind spot: None significant.
- **Decision**: FIXED — added `BattleEnvironmentSchema.safeParse` guard in `buildBattlePdf` + a unit test asserting a malformed environment is skipped (not thrown on).

### F2 — Builder signature adapted from the plan's contract (documented)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/pdf/battle-pdf.ts:34-38
- **Detail**: Plan contract was `Pick<Battle,"name"|"environment">` + required `envLabels`. Actual: `Pick<Battle,"name"> & Partial<Pick<Battle,"environment">>` + optional `envLabels?`. Deliberate adaptation (flagged at implementation time) so Phase 1 typechecks before the route is wired in Phase 2. Sound phasing.
- **Decision**: ACKNOWLEDGED — no action (documented adaptation).

### F3 — Extra change folder `pdf-unicode-fonts/` in the diff (documented)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/pdf-unicode-fonts/change.md
- **Detail**: A second change folder scaffolded inside the Phase 2 commit — triage output of the Polish/WinAnsi bug found in manual verification, an explicit user decision. Benign and documented in both change.md files.
- **Decision**: ACKNOWLEDGED — no action (documented decision).
