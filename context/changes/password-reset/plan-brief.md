# Reset Password — Plan Brief

> Full plan: `context/changes/password-reset/plan.md`

## What & Why

Add a forgot-password → reset-password flow so GMs who cannot sign in can recover their accounts via email. Without it, a lost password permanently locks a user out (FR-010, reported as a real blocker).

## Starting Point

Sign-in, sign-up, and sign-out are fully implemented. The `/api/auth/callback` route (added as a bug fix on 2026-06-01) already handles Supabase PKCE code exchange and supports a `?next=` redirect param — the password reset flow reuses it directly. All form components (`FormField`, `SubmitButton`, `ServerError`, `PasswordToggle`) are in place.

## Desired End State

A "Forgot password?" link on the sign-in page leads to an email-input form. After submission, the same page shows a "check your email" message (identical regardless of whether the address is registered). Clicking the reset link establishes a recovery session and lands on a password-update form. Entering and confirming the new password redirects to `/auth/signin` with a green "Password updated" banner. Expired or reused links redirect back to the forgot-password page with an explanation.

## Key Decisions Made

| Decision                  | Choice                                                           | Why                                                          |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Post-reset landing        | `/auth/signin?success=1` with green banner                       | Forces a clean re-login confirming the new password works    |
| Confirm password field    | Yes — two fields with client-side match validation               | Prevents typos that would lock the user out again            |
| Expired link destination  | `/auth/forgot-password?error=...`                                | Actionable — puts user exactly where they request a new link |
| Email-sent UX             | Same page, form swaps to confirmation message                    | Mirrors `confirm-email.astro` pattern; no extra page needed  |
| Reset-password page guard | Redirect to forgot-password if no session                        | Prevents a broken empty form for direct URL access           |
| Anti-enumeration          | Always redirect to `?success=1` from forgot-password API         | Never reveal whether an email is registered                  |
| Error routing in callback | `type=recovery` query param distinguishes reset vs signup errors | One callback handles both flows; errors go to the right page |

## Scope

**In scope:** Forgot-password email form, reset-password new-password form, callback error routing for recovery type, sign-in page success banner, "Forgot password?" link.

**Out of scope:** Password strength meter, rate-limit UI, "change password while logged in" flow, OAuth/magic-link reset.

## Architecture / Approach

Reuses the existing PKCE callback route entirely — `resetPasswordForEmail` sends the user to `/api/auth/callback?next=/auth/reset-password&type=recovery`, the callback exchanges the code, establishes the recovery session, and redirects. The two new API routes (`forgot-password.ts`, `reset-password.ts`) follow the identical pattern of all existing auth routes: read form data, call Supabase, redirect with `?error=` or `?success=`.

## Phases at a Glance

| Phase                         | What it delivers                                                       | Key risk                                         |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| 1. Callback + Sign-in updates | Error routing for recovery type; success banner; forgot-password link  | Minimal — two small changes to existing files    |
| 2. Forgot-password page + API | Email form, confirmation message, `resetPasswordForEmail` call         | Anti-enumeration logic must be verified manually |
| 3. Reset-password page + API  | Session-guarded new-password form, `updateUser` call, success redirect | Recovery session expiry edge case must be tested |

**Prerequisites:** Supabase dashboard — Auth → URL Configuration → Redirect URLs must include the production URL + `http://localhost:4321` (required for the PKCE callback to be allowed)
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- Supabase default minimum password length is 6 characters — the API will return an error if a shorter password is submitted; the error message is sanitized before reaching the user
- `SubmitButton`'s `pendingText` won't visually activate on native POST forms (known project-wide gap, tracked in S-08) — the button will appear static during submission
