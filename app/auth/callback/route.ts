import { safeInternalPath } from "@/lib/safe-navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { needsPassword } from "@/lib/password";
import { withToast } from "@/lib/toast-cookie";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const OTP_TYPES = new Set<EmailOtpType>(["email", "magiclink", "signup", "invite", "recovery", "email_change"]);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const remembered = request.cookies.get("signin_next")?.value;
  const next = safeInternalPath(url.searchParams.get("next") ?? remembered ?? null) ?? "/me";

  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, url.origin));
    response.headers.set("Cache-Control", "no-store");
    response.cookies.delete("signin_next");
    return response;
  };
  const fail = (reason: string) => redirect(`/login?error=${encodeURIComponent(reason)}&next=${encodeURIComponent(next)}`);

  if (url.searchParams.has("error") || url.searchParams.has("error_code")) {
    return fail(url.searchParams.get("error_code") === "otp_expired" ? "expired" : "link");
  }
  if (!supabaseEnabled) return fail("setup");

  // Write cookies directly onto the response that is returned to the browser.
  // A separate response is essential: cookies written by a Server Component or
  // a response discarded after verifying the OTP do not survive the redirect.
  let response = NextResponse.redirect(new URL(next, url.origin));
  response.headers.set("Cache-Control", "no-store");
  const db = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        if (headers) {
          for (const [name, value] of Object.entries(headers)) {
            if (typeof value === "string") response.headers.set(name, value);
          }
        }
      },
    },
  });

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");

  let error: { message: string } | null;
  let user: Parameters<typeof needsPassword>[0] = null;
  if (tokenHash && type && OTP_TYPES.has(type as EmailOtpType)) {
    let data;
    ({ data, error } = await db.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType }));
    user = data?.user ?? null;
  } else if (code) {
    let data;
    ({ data, error } = await db.auth.exchangeCodeForSession(code));
    user = data?.user ?? null;
    if (error && /verifier|code challenge/i.test(error.message)) return fail("browser");
  } else {
    return fail("link");
  }

  if (error) return fail(/expired|invalid/i.test(error.message) ? "expired" : "link");
  // A reset link, or a member without a password, goes on to choose one before carrying on.
  if (type === "recovery" || needsPassword(user)) {
    const to = new URL("/login", url.origin);
    to.searchParams.set("step", "new-password");
    if (type === "recovery") to.searchParams.set("reason", "reset");
    to.searchParams.set("next", next);
    response.headers.set("Location", to.toString());
  } else {
    withToast(response, type === "email_change" ? "Email address updated" : "Signed in");
  }
  response.cookies.delete("signin_next");
  return response;
}
