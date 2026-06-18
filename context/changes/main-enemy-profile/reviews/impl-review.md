<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Main Enemy Profile

- **Plan**: context/changes/main-enemy-profile/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-06-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 3 warnings · 3 observations

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

### F1 — Fire-and-forget battle profile write

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/battles/[id]/generate.ts:100–108
- **Detail**: The battles.update() call writing main_enemy_id and main_enemy_profile was not checked for errors. If it silently failed, the response still returned main_enemy_id and main_enemy_profile to the client — the UI rendered the Main Villain section — but the battle row was never updated. On next hard reload the profile would be gone.
- **Fix Applied (Fix A)**: Capture profileUpdateResult; if error is truthy, leave mainEnemyId and mainEnemyProfile as null so the response is honest about what was actually persisted.
- **Decision**: FIXED via Fix A

### F2 — Fragile AI name matching

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/battles/[id]/generate.ts:96
- **Detail**: Main enemy matching used strict string equality. Minor AI inconsistencies (whitespace, capitalisation) caused mainRow to be undefined and the profile to be silently dropped.
- **Fix Applied**: Normalised both sides with .trim().toLowerCase() before comparison.
- **Decision**: FIXED

### F3 — No test for non-main-enemy delete (main_enemy_cleared: false)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/integration/api/enemies-id.test.ts:142–154
- **Detail**: The DELETE 200 test mock always resolved main_enemy_cleared: true. The false branch was untested.
- **Fix Applied**: Extended makeSupabaseMock to support per-call result sequences (QueryResult[]). Added a new test case asserting main_enemy_cleared: false when the profile-clear update returns 0 rows.
- **Decision**: FIXED

### F4 — Profile-clear error intentionally swallowed

- **Severity**: 👁 OBSERVATION
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/enemies/[id].ts:149–155
- **Detail**: Plan explicitly specified not to block the delete on profile-clear errors. A failure here leaves main_enemy_profile orphaned while the FK cascade clears main_enemy_id. Accepted as-is; risk documented in a code comment and in lessons.md.
- **Decision**: ACCEPTED-AS-RULE: Pre-delete cleanup of non-FK companion columns is inherently non-atomic

### F5 — DELETE operation order is the only viable approach

- **Severity**: 👁 OBSERVATION
- **Dimension**: Architecture
- **Location**: src/pages/api/enemies/[id].ts:149–162
- **Detail**: Profile-clear must run before the delete because after the FK cascade clears main_enemy_id the .eq filter becomes a no-op. Constrained by lack of transaction support in Supabase JS/Edge. Covered by F4's comment.
- **Decision**: SKIPPED

### F6 — Pre-existing two-hop auth pattern

- **Severity**: 👁 OBSERVATION
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/enemies/[id].ts:119–146
- **Detail**: Same campaigns→battles auth chain duplicated in both PATCH and DELETE. Not introduced by this feature.
- **Fix Applied**: Extracted resolveUserBattleIds() helper shared by PATCH and DELETE, taking an actionError string for the operation-specific 500 message.
- **Decision**: FIXED
