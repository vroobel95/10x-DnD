<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Data Schema

- **Plan**: context/changes/data-schema/plan.md
- **Scope**: Phase 1–2 of 2 (full plan)
- **Date**: 2026-05-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Missing indexes on foreign key columns

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/ (all three files)
- **Detail**: PostgreSQL does not auto-create indexes on FK columns. Three FK columns lack indexes: campaigns.user_id, battles.campaign_id, and enemies.battle_id. These columns are hit on every RLS policy evaluation, CASCADE delete, and parent-filtered query. The enemies two-hop RLS policy is the most affected.
- **Fix**: Add a new migration 20260527000004_add_fk_indexes.sql with three CREATE INDEX statements.
  - Strength: Eliminates linear-scan RLS checks before data grows. Standard PostgreSQL best practice.
  - Tradeoff: Minor write overhead from maintaining indexes — negligible at MVP scale.
  - Confidence: HIGH — textbook PostgreSQL FK indexing.
  - Blind spot: None significant.
- **Decision**: FIXED — created supabase/migrations/20260527000004_add_fk_indexes.sql

### F2 — Beneficial security hardening beyond plan

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260527000001_create_campaigns.sql:34
- **Detail**: The trigger function includes SET search_path = public, not in the plan but a PostgreSQL best practice for SECURITY DEFINER functions. Positive deviation.
- **Decision**: SKIPPED — acknowledged, no action needed

### F3 — Typo in types.ts header comment

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: src/types.ts:1
- **Detail**: Comment read "DnD 5enemy" — should be "DnD 5e entities".
- **Fix**: Correct the typo.
- **Decision**: FIXED — corrected to "DnD 5e entities"
