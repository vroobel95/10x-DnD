---
change_id: password-reset
status: planned
created: 2026-06-01
updated: 2026-06-01
roadmap_id: S-04
prd_refs: FR-010
---

# Change: Reset Password

## Outcome

GM who has forgotten their password can request a reset email, click the link, set a new password, and regain access to the app.

## Notes

- Supabase Auth has a built-in reset-password flow (`supabase.auth.resetPasswordForEmail` + `PKCE` redirect); no custom token handling needed
- Two new pages: `/forgot-password` (email input form) and `/reset-password` (new password form, activated by the Supabase email link)
- Email link redirects to `/reset-password?token_hash=...&type=recovery` — Supabase handles token validation; the page calls `supabase.auth.updateUser({ password })` on submit
- Mirror existing auth pattern: server-side form action, redirect with `?error=` on failure, redirect to `/` on success
- "Forgot password?" link added to sign-in page
- No new RLS or schema changes required
