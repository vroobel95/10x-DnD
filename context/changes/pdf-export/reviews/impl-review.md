<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: PDF Export Implementation Plan

- **Plan**: context/changes/pdf-export/plan.md
- **Scope**: All phases (1–3)
- **Date**: 2026-06-18
- **Verdict**: APPROVED (after triage fixes)
- **Findings**: 0 critical · 2 warnings · 5 observations

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

### F1 — Content-Disposition filename not RFC 5987 encoded

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/battles/[id]/export.pdf.ts:75-77
- **Detail**: Header built as `filename="${filename}"` via raw interpolation. `pdfFilename()` sanitizes to `[a-z0-9-]+` so no injection is possible today, but the guarantee is implicit. Also: non-ASCII battle names collapse to `battle.pdf`.
- **Fix A ⭐ Recommended**: Switch to RFC 5987 `filename*=UTF-8''${encodeURIComponent(filename)}` encoding.
  - Strength: Immune to injection by construction; handles Unicode names.
  - Tradeoff: IE11 incompatible (not a target).
  - Confidence: HIGH — standard pattern for safe Content-Disposition.
  - Blind spot: None significant.
- **Fix B**: Add a defensive char-strip guard before interpolation.
  - Strength: Minimal change.
  - Tradeoff: Doesn't fix non-ASCII names.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — also updated integration test regex and EnemiesSection filename parser to handle RFC 5987 form.

### F2 — Detached anchor element may not trigger download on Firefox/Safari

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/battles/EnemiesSection.tsx:164-167
- **Detail**: `a.click()` on element never appended to the DOM. Chrome tolerates this; Firefox and Safari require the element to be in the document.
- **Fix**: `document.body.appendChild(a); a.click(); document.body.removeChild(a);`
- **Decision**: SKIPPED

### F3 — No lower-bound guard on `y` cursor in PDF builder

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/pdf/battle-pdf.ts:234-267 (abilities loop)
- **Detail**: `y` is decremented per section with no check against bottom margin. An enemy with many long abilities could push `y` below 0 and silently clip content.
- **Fix**: Add `if (y < MARGIN) break;` at the top of the abilities loop.
- **Decision**: FIXED — guard added at top of abilities loop.

### F4 — `select("*")` on enemies query inconsistent with project pattern

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/battles/[id]/export.pdf.ts:49
- **Detail**: Route uses `.select("*")` while sibling routes name only columns they consume.
- **Fix**: Change to `.select("id, name, stats, created_at, updated_at")`.
- **Decision**: FIXED — narrowed select columns.

### F5 — Campaign DB error (non-PGRST116) path has no integration test

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/integration/api/battles-export.test.ts (missing case)
- **Detail**: `export.pdf.ts:43-44` returns 500 on non-PGRST116 campaign error but the branch was untested.
- **Fix**: Added test with `campaigns: { data: null, error: { code: "23505", message: "DB error" } }` asserting status 500.
- **Decision**: FIXED — test added; suite now 127 tests.

### F6 — `buildBattlePdf` throw path in route has no integration test

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/integration/api/battles-export.test.ts (missing case)
- **Detail**: `export.pdf.ts:65-69` try/catch → 500 branch had no test coverage.
- **Fix**: Added `vi.spyOn(battlePdf, "buildBattlePdf").mockRejectedValueOnce(...)` test asserting status 500.
- **Decision**: FIXED — test added.

### F7 — Dual error slots in confirmed section can show two errors simultaneously

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/battles/EnemiesSection.tsx:263-272
- **Detail**: `exportError` and `actionError` rendered in two separate blocks; both could display at once.
- **Fix**: Cross-clear errors on handler start — `handleExport` clears `actionError`; card action handlers clear `exportError`.
- **Decision**: FIXED — cross-clearing added to all five handlers.
