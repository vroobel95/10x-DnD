# S-04: Reset Password — Implementation Plan

## Overview

Add a full forgot-password → reset-password flow using Supabase's built-in PKCE reset mechanism. A GM who cannot sign in can request a reset link, click it, enter and confirm a new password, and land back on the sign-in page with a success message.

## Current State Analysis

- `src/pages/api/auth/callback.ts` — already handles `exchangeCodeForSession(code)` for email confirmation; reused for password reset with a `?next=` redirect param. Currently routes ALL errors to `/auth/signin` — needs to also support routing errors to `/auth/forgot-password` when the flow is a recovery type.
- `src/pages/auth/signin.astro` — reads `?error=` and passes it to `SignInForm`; needs `?success=` handling for the post-reset banner and a "Forgot password?" link.
- `src/components/auth/` — `FormField`, `PasswordToggle`, `SubmitButton`, `ServerError` are the established building blocks; both new form components use them.
- `src/pages/auth/confirm-email.astro` — SSR page that renders different content based on `import.meta.env.DEV`; the forgot-password page uses a similar "show form OR success message" pattern driven by `?success=` query param.
- No schema or RLS changes needed — `supabase.auth.resetPasswordForEmail` and `supabase.auth.updateUser` are Supabase Auth operations with no DB schema involvement.

## Desired End State

A "Forgot password?" link on the sign-in page leads to `/auth/forgot-password`. The GM enters their email; the page confirms a link was sent (without revealing whether the address is registered). Clicking the email link establishes a recovery session via the existing callback route and lands on `/auth/reset-password`. The GM enters and confirms a new password; on success they land on `/auth/signin` with a green "Password updated" banner. Expired or already-used links redirect to `/auth/forgot-password` with an explanatory error.

### Key Discoveries

- `@supabase/ssr` uses PKCE — the reset email link carries `?code=xxx`, not `?token_hash=xxx`. The existing `/api/auth/callback` route already calls `exchangeCodeForSession(code)` and redirects to the `?next=` param on success. No new token logic is required.
- `resetPasswordForEmail` must receive `redirectTo` pointing at the callback with `?next=/auth/reset-password&type=recovery` — the `type` param is how the callback distinguishes password-reset errors from signup-confirmation errors.
- The forgot-password API must **never reveal whether an email is registered** — always redirect to `?success=1` regardless of whether Supabase returned a "user not found" response. Only genuine server errors (SMTP misconfiguration, rate limiting) warrant a generic `?error=` redirect.
- `SubmitButton` uses `useFormStatus` which only fires for React Server Actions, not native `method="POST"` forms. Both new form components use native POST (matching all existing auth forms); the `pendingText` prop won't visually activate. This is a known project-wide gap tracked in S-08.
- `/auth/reset-password` must guard against no-session access. The Astro page reads `context.locals.user` (set by middleware) — if null, redirect to `/auth/forgot-password?error=Reset+link+is+invalid+or+has+expired`.

## What We're NOT Doing

- No OAuth / magic-link password reset — only email+password accounts exist
- No email-existence confirmation — the forgot-password response is always the same regardless of whether the address is registered
- No password strength meter — only minimum length validation (Supabase default: 6 characters)
- No rate-limit UI — if Supabase returns a rate-limit error it is treated as a server error; the GM sees a generic error and can wait before retrying
- No "change password while logged in" flow — this slice covers the lost-password recovery case only

## Implementation Approach

Three sequential phases, each independently testable. Phase 1 updates two existing files (callback error routing + sign-in page success message + forgot-password link) without adding any new pages — this can be verified before any new pages exist. Phase 2 adds the forgot-password entry point. Phase 3 adds the reset-password completion page.

## Critical Implementation Details

**`type=recovery` in the redirectTo URL**: Pass `type=recovery` as a query param in the `redirectTo` value given to `resetPasswordForEmail` (i.e. `…/api/auth/callback?next=/auth/reset-password&type=recovery`). The callback reads this to decide whether a code-exchange failure redirects to `/auth/forgot-password` (recovery) or `/auth/signin` (signup confirmation). Without this, all callback errors land on the sign-in page regardless of context.

**Anti-enumeration on forgot-password API**: The POST handler must call `resetPasswordForEmail` and then unconditionally redirect to `?success=1` — even if Supabase returns a "User not found" error. Only log the error server-side; never surface it to the client. This prevents an attacker from enumerating registered email addresses by observing different responses.

---

## Phase 1: Callback Routing + Sign-in Page Updates

### Overview

Update the existing `/api/auth/callback` to route recovery-flow errors to `/auth/forgot-password`. Update `signin.astro` to render a green success banner when `?success=` is present and add the "Forgot password?" link.

### Changes Required

#### 1. Add type-aware error routing to callback

**File**: `src/pages/api/auth/callback.ts`

**Intent**: When `type=recovery` is in the query params and the code exchange fails, redirect to `/auth/forgot-password` with an expiry error rather than `/auth/signin`. This gives the GM a direct path to request a new link.

**Contract**: Read `context.url.searchParams.get('type')`. On code-exchange failure: if `type === 'recovery'`, redirect to `/auth/forgot-password?error=Reset+link+is+invalid+or+has+expired`; otherwise keep the existing redirect to `/auth/signin?error=Email+confirmation+failed.+Please+try+again.`

#### 2. Add success banner and forgot-password link to sign-in page

**File**: `src/pages/auth/signin.astro`

**Intent**: Show a green "Password updated — please sign in" banner when `?success=` is present in the URL, and add a "Forgot password?" link below the sign-in form so GMs can find the reset flow.

**Contract**: Read `const success = Astro.url.searchParams.get('success')`. Render the success banner as a server-side conditional HTML block directly in the Astro template (not inside the React `SignInForm`) — same approach as the `confirm-email.astro` inline rendering. Add the "Forgot password?" link in the footer paragraph below the form, alongside the existing "Sign up" link.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run check`
- Linting passes: `npm run lint`

#### Manual Verification

- Navigating to `/auth/signin?success=1` shows a green banner
- Navigating to `/auth/signin` without `?success=` shows no banner
- "Forgot password?" link is visible on the sign-in page and links to `/auth/forgot-password`
- Opening an already-used or expired reset link triggers the callback error path and redirects to `/auth/forgot-password` with an error message (test by manually constructing a `/api/auth/callback?code=invalid&type=recovery` URL)

---

## Phase 2: Forgot-Password Page and API

### Overview

Add the entry point of the reset flow: a page with an email input that submits to a POST route, which fires `resetPasswordForEmail` and redirects back with a `?success=` flag. The page swaps the form for a confirmation message when `?success=` is set.

### Changes Required

#### 1. New forgot-password React form component

**File**: `src/components/auth/ForgotPasswordForm.tsx`

**Intent**: Client-side form with a single email field, email format validation on submit, and the standard `SubmitButton`/`ServerError` components. Follows the same structure as `SignInForm.tsx`.

**Contract**: Props `{ serverError?: string | null }`. Native `method="POST"` form with `action="/api/auth/forgot-password"`. Single `FormField` for email (type="email", icon=`<Mail />`). Client-side validation: non-empty + basic email regex, same pattern as `SignInForm`. `SubmitButton` with `pendingText="Sending..."`.

#### 2. New forgot-password Astro page

**File**: `src/pages/auth/forgot-password.astro`

**Intent**: Render the `ForgotPasswordForm` when no `?success=` param is present; render a "check your email" confirmation message when `?success=` is present. Mirrors the `confirm-email.astro` conditional-content pattern.

**Contract**: Read `const success = Astro.url.searchParams.get('success')` and `const error = Astro.url.searchParams.get('error')` in the frontmatter. When `success` is truthy, render a static card (no React island) with heading "Check your email" and the body "If that address is registered, you'll receive a password reset link.". When not, render `<ForgotPasswordForm serverError={error} client:load />`. Card layout matches `confirm-email.astro`.

#### 3. New forgot-password API route

**File**: `src/pages/api/auth/forgot-password.ts`

**Intent**: Accept a POST with `email` form field, call `supabase.auth.resetPasswordForEmail` with the correct `redirectTo`, and always redirect to `?success=1` to avoid revealing email existence.

**Contract**: `POST` handler. Build `redirectTo` as `new URL('/api/auth/callback?next=/auth/reset-password&type=recovery', context.request.url).href`. Call `supabase.auth.resetPasswordForEmail(email, { redirectTo })`. On any Supabase error that is NOT clearly a server/config error, redirect to `/auth/forgot-password?success=1` anyway (anti-enumeration). On a genuine server error (non-auth error), redirect to `/auth/forgot-password?error=Something+went+wrong.+Please+try+again.`. On success, redirect to `/auth/forgot-password?success=1`. Never expose raw Supabase error messages (per lessons.md).

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run check`
- Linting passes: `npm run lint`

#### Manual Verification

- Navigating to `/auth/forgot-password` shows the email form
- Submitting a registered email shows the "check your email" confirmation message on the same page
- Submitting an unregistered email shows the same "check your email" message (no difference)
- Submitting an empty or malformed email shows a client-side validation error without submitting
- A real reset email arrives in the inbox with a working link (requires Supabase SMTP configured and Redirect URLs set in dashboard)

---

## Phase 3: Reset-Password Page and API

### Overview

Add the completion end of the reset flow: a session-guarded page where the GM enters and confirms their new password, and a POST route that calls `updateUser({ password })` and redirects to the sign-in page with a success message.

### Changes Required

#### 1. New reset-password React form component

**File**: `src/components/auth/ResetPasswordForm.tsx`

**Intent**: Form with two password fields (new password + confirm password), client-side match validation, and `PasswordToggle` on both fields. Follows `SignInForm.tsx` structure.

**Contract**: Props `{ serverError?: string | null }`. Native `method="POST"` form with `action="/api/auth/reset-password"`. Two `FormField` components: `id="password"` and `id="confirm_password"`, both type password with `PasswordToggle`. Client-side validation on submit: both fields non-empty, both values match — if they don't match, show an inline error on the confirm field ("Passwords do not match") and call `e.preventDefault()`. `SubmitButton` with `pendingText="Updating..."`. Uses `Lock` icon from lucide-react (already imported in `SignInForm`).

#### 2. New reset-password Astro page

**File**: `src/pages/auth/reset-password.astro`

**Intent**: Session-guarded page that renders the `ResetPasswordForm`. Redirects to `/auth/forgot-password` if no active session exists (the user landed here without a valid recovery link).

**Contract**: In the frontmatter: if `!Astro.locals.user`, return `Astro.redirect('/auth/forgot-password?error=Reset+link+is+invalid+or+has+expired')`. Otherwise render `ResetPasswordForm` with the `?error=` query param. Page layout matches `signin.astro` and `forgot-password.astro`.

#### 3. New reset-password API route

**File**: `src/pages/api/auth/reset-password.ts`

**Intent**: Accept a POST with `password` and `confirm_password` form fields, validate they match server-side, call `supabase.auth.updateUser({ password })`, and redirect to the sign-in page with a success message on completion.

**Contract**: `POST` handler. Read `password` and `confirm_password` from form data. Server-side match check: if they don't match, redirect to `/auth/reset-password?error=Passwords+do+not+match`. Call `supabase.auth.updateUser({ password })`. On error: redirect to `/auth/reset-password?error=Could+not+update+password.+Please+try+again.` (sanitize — never expose raw Supabase error). On success: redirect to `/auth/signin?success=1`. Requires an authenticated user (user comes from `context.locals.user`); if no user, redirect to `/auth/forgot-password`.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run check`
- Linting passes: `npm run lint`

#### Manual Verification

- Visiting `/auth/reset-password` without a session redirects to `/auth/forgot-password` with error
- Clicking a valid reset email link lands on `/auth/reset-password` with the form visible
- Entering mismatched passwords shows "Passwords do not match" client-side without submitting
- Entering matching passwords and submitting redirects to `/auth/signin?success=1` with green banner
- Trying to reuse the same reset link after a successful update redirects to `/auth/forgot-password` with expiry error

---

## Testing Strategy

### Manual Testing Steps

1. Sign out; navigate to `/auth/signin`; verify "Forgot password?" link is visible
2. Click "Forgot password?"; enter a registered email; verify confirmation message appears
3. Check email inbox; click reset link; verify landing on `/auth/reset-password` with form
4. Enter mismatched passwords; verify client-side error without network request
5. Enter matching passwords; verify redirect to `/auth/signin?success=1` with green banner
6. Sign in with new password; verify success
7. Try clicking the same reset link again; verify redirect to `/auth/forgot-password` with error
8. Navigate directly to `/auth/reset-password` without clicking a link; verify redirect to `/auth/forgot-password`
9. Submit forgot-password with an unregistered email; verify same confirmation message as registered email

## References

- Auth callback: `src/pages/api/auth/callback.ts`
- Pattern reference: `src/components/auth/SignInForm.tsx`, `src/pages/auth/confirm-email.astro`
- Lessons: `context/foundation/lessons.md` (sanitize external errors, never expose raw Supabase messages)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Callback Routing + Sign-in Page Updates

#### Automated

- [ ] 1.1 TypeScript compilation passes: `npm run check`
- [ ] 1.2 Linting passes: `npm run lint`

#### Manual

- [ ] 1.3 `/auth/signin?success=1` shows green banner
- [ ] 1.4 "Forgot password?" link visible on sign-in page
- [ ] 1.5 Invalid recovery code redirects to `/auth/forgot-password` with error

### Phase 2: Forgot-Password Page and API

#### Automated

- [ ] 2.1 TypeScript compilation passes: `npm run check`
- [ ] 2.2 Linting passes: `npm run lint`

#### Manual

- [ ] 2.3 `/auth/forgot-password` shows email form
- [ ] 2.4 Registered email submission shows confirmation message
- [ ] 2.5 Unregistered email shows same confirmation message
- [ ] 2.6 Invalid email shows client-side error

### Phase 3: Reset-Password Page and API

#### Automated

- [ ] 3.1 TypeScript compilation passes: `npm run check`
- [ ] 3.2 Linting passes: `npm run lint`

#### Manual

- [ ] 3.3 Direct visit to `/auth/reset-password` without session redirects to forgot-password
- [ ] 3.4 Valid reset link lands on reset-password form
- [ ] 3.5 Mismatched passwords show client-side error
- [ ] 3.6 Matching passwords redirect to sign-in with success banner
- [ ] 3.7 Reusing reset link redirects to forgot-password with expiry error
