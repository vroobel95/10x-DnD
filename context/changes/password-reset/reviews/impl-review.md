<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-04 Reset Password

- **Plan**: context/changes/password-reset/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-06-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical, 5 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Open redirect via unvalidated `next` parameter

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/callback.ts:6,14
- **Detail**: The `next` query parameter is read on line 6 and used directly in `context.redirect(next)` on line 14 without validation. An attacker can craft a URL like `?code=VALID&next=https://evil.com` and after successful code exchange, the user is redirected off-site. Pre-existing in the codebase — not introduced by this plan — but the file was modified as part of Phase 1.
- **Fix**: Validate that `next` is a relative path: `const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";`
  - Strength: Two-line change; eliminates the entire open redirect class.
  - Tradeoff: None significant — `next` is always an internal path.
  - Confidence: HIGH — standard mitigation, no edge cases.
  - Blind spot: None significant.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Validate redirect targets to prevent open redirects

### F2 — False success when Supabase client is null on password reset

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/reset-password.ts:21-32
- **Detail**: If `createClient` returns null (Supabase misconfigured), code falls through past the `if (supabase)` block on line 22 and reaches line 32: `redirect("/auth/signin?success=1")`. The user sees "Password updated" but nothing happened. They cannot sign in with either the old or the new password.
- **Fix**: Return an error redirect when `supabase` is null, matching the guard pattern in `signin.ts`.
  - Strength: Prevents misleading success. Consistent with how `signin.ts` handles the null case.
  - Tradeoff: Minor — one guard clause addition.
  - Confidence: HIGH — `signin.ts` already uses this exact pattern.
  - Blind spot: None significant.
- **Decision**: FIXED

### F3 — Missing minimum password length validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/ResetPasswordForm.tsx:19-23, src/pages/api/auth/reset-password.ts:15
- **Detail**: `SignUpForm.tsx` enforces `MIN_PASSWORD_LENGTH = 6` (lines 8, 33-34). `ResetPasswordForm.tsx` only checks non-empty. The server-side `reset-password.ts` only checks password match, not length. A user can reset to a 1-character password.
- **Fix**: Add `MIN_PASSWORD_LENGTH = 6` to both `ResetPasswordForm.tsx` and `reset-password.ts`, matching `SignUpForm.tsx`.
  - Strength: Matches signup flow exactly; prevents weak passwords.
  - Tradeoff: None — aligns with existing pattern.
  - Confidence: HIGH — direct port from SignUpForm.
  - Blind spot: None significant.
- **Decision**: FIXED

### F4 — Unplanned recovery-callback.ts + plan drift

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline / Plan Adherence
- **Location**: src/pages/api/auth/recovery-callback.ts (new, unplanned), src/pages/api/auth/forgot-password.ts:10 (drift)
- **Detail**: Plan specified routing reset emails through the shared callback: `redirectTo = /api/auth/callback?next=/auth/reset-password&type=recovery`. Implementation uses a dedicated `/api/auth/recovery-callback` route instead (commit e578762). The `type === "recovery"` branch in `callback.ts:19-23` is now effectively dead code. `recovery-callback.ts` duplicates the code-exchange pattern from `callback.ts`.
- **Fix A ⭐ Recommended**: Update the plan and remove dead code
  - Strength: Keeps plan as source of truth; removes dead code.
  - Tradeoff: Minor — plan becomes a slightly moving target.
  - Confidence: HIGH — the dedicated route is clearly the intended path.
  - Blind spot: If any other code references `/api/auth/callback?type=recovery`.
- **Fix B**: Leave as-is, dead branch as defensive fallback
  - Strength: Stale email links still route correctly.
  - Tradeoff: Dead code accumulates; plan diverges from reality.
  - Confidence: MEDIUM — edge case is very unlikely with PKCE links.
  - Blind spot: Whether Supabase could ever generate a link targeting the old callback.
- **Decision**: FIXED via Fix A — dead type=recovery branch removed from callback.ts, plan addendum added

### F5 — Silent success when Supabase client is null on forgot-password

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/forgot-password.ts:12-26
- **Detail**: Same pattern as F2. If `createClient` returns null, code falls through to line 26: `redirect("?success=1")`. User sees "check your email" but no email could ever be sent. Less severe than F2 because anti-enumeration already makes this response ambiguous, but a server config error should not be silent.
- **Fix**: Guard against null supabase with a generic error redirect.
  - Strength: Consistent with F2 fix and `signin.ts` pattern.
  - Tradeoff: Slightly weakens anti-enumeration for config errors only.
  - Confidence: HIGH — standard guard pattern.
  - Blind spot: None significant.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Guard against null Supabase client instead of falling through to success

### F6 — Lint fails repo-wide due to CRLF line endings

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: Repo-wide
- **Detail**: `npm run lint` exits with hundreds of `Delete ␍` (CRLF) errors. The plan's progress marks lint as passing, but the merge commit `3d5e12d` likely re-introduced CRLF endings. Not specific to the password-reset implementation. TypeScript compilation passes cleanly.
- **Fix**: Run `npm run lint:fix` or `npm run format` to normalize line endings, then commit.
- **Decision**: FIXED — ran lint:fix, zero CRLF errors remain

### F7 — Rate-limit (429) errors silently swallowed

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/forgot-password.ts:18
- **Detail**: Anti-enumeration logic only surfaces errors with `status >= 500`. A 429 (rate limit) from Supabase is treated as success. User gets "check your email" but the request was throttled — no email sent, no feedback to wait.
- **Fix**: Also surface 429 with a generic "Please wait before trying again" message.
- **Decision**: FIXED
