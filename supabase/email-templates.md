# Sign-in email templates

Paste these into Supabase → **Authentication → Emails → Templates**. They make sign-in links work in any
browser (including the in-app browsers phones use for email) and add a 6-digit code people can type instead.

Before you start, check **Authentication → URL Configuration → Site URL** is your live address
(for example `https://pheelm.vercel.app`), because the links below are built from it.

## Magic Link

Subject:

```
Your Pheelm sign-in link
```

Body:

```html
<h2>Sign in to Pheelm</h2>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Sign in to Pheelm</a></p>
<p>Or enter this code on the sign-in page: <strong style="font-size:22px;letter-spacing:4px">{{ .Token }}</strong></p>
<p>The link and the code work once and expire in an hour. If you didn't ask to sign in, you can ignore this email.</p>
```

## Confirm signup

This is the email first-time visitors get, so it needs the same treatment.

Subject:

```
Welcome to Pheelm
```

Body:

```html
<h2>Welcome to Pheelm</h2>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Confirm your email and sign in</a></p>
<p>Or enter this code on the sign-in page: <strong style="font-size:22px;letter-spacing:4px">{{ .Token }}</strong></p>
<p>The link and the code work once and expire in an hour.</p>
```

## Sending email to everyone

Supabase's built-in email is meant for testing: it sends only a few emails an hour, and on newer
projects only to members of your Supabase team. That's fine while you're the only one signing in.
Before you share the site, connect your own email sender under **Project Settings → Authentication → SMTP Settings**.
[Resend](https://resend.com) has a free tier that works well: add your domain there, create an SMTP
password, and paste its host (`smtp.resend.com`), port (`465`), username (`resend`) and password into Supabase.
