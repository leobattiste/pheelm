# Pheelm authentication emails

## Passwords (Authentication settings)

Pheelm signs in with **email and password**, confirmed by a six-digit code. Code sign-in stays
available, and members without a password are asked to choose one.

In **Supabase → Authentication**:

- **Providers → Email:** Email provider on, **Confirm email** on, minimum password length **8**.
  Turn on **Prevent use of leaked passwords** if your plan includes it.
- **Emails → Reset password:** paste `supabase/email/reset-password.html`, subject `Reset your Pheelm password`.
  It must contain `{{ .Token }}`: the app asks for the six-digit code.
- **Emails → Confirm signup:** paste `supabase/email/confirm-signup.html` (it contains the code too).
- **Rate limits:** keep the defaults or tighter; they also limit password guessing.


Paste these templates in **Supabase → Authentication → Email Templates**. The magic link and
six-digit code should both be offered in the same email. Use the **actual live
URL** in **Authentication → URL Configuration → Site URL**, and allow the live
`https://YOUR-DOMAIN/auth/callback` as a redirect URL.

Using `{{ .RedirectTo }}` preserves the exact login destination, including the
`next` query parameter. Using `{{ .SiteURL }}` alone silently loses it.

## Magic Link

Subject: `Sign in to Pheelm`

```html
<h2>Sign in to Pheelm</h2>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in to Pheelm</a></p>
<p>Or enter this six-digit code on the Pheelm sign-in page: <strong>{{ .Token }}</strong></p>
<p>Each method works once. If you didn't request this email, you can ignore it.</p>
```

## Confirm signup

Subject: `Welcome to Pheelm`

```html
<h2>Welcome to Pheelm</h2>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirm your email and sign in</a></p>
<p>Or enter this six-digit code on the Pheelm sign-in page: <strong>{{ .Token }}</strong></p>
<p>If you didn't request this email, you can ignore it.</p>
```

**Note:** These templates expect the `emailRedirectTo` supplied by
`app/login/page.tsx` to be `https://YOUR-DOMAIN/auth/callback?next=...`.
It already has a query parameter, so the template appends `&token_hash=`.
If you later change the redirect URL, update the template too.

For production, connect custom SMTP in Supabase. The built-in email sender is
for limited testing and may not deliver to arbitrary visitors. Configure a
verified sending domain and suitable rate limits before inviting the public.
