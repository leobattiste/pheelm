import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

const safeNext = (v: string | null | undefined) =>
  v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : null;

const OTP_TYPES = new Set(["email", "magiclink", "signup", "invite", "recovery", "email_change"]);

/**
 * Where every sign-in email lands. It accepts both kinds of link Supabase can send:
 * - token_hash links, which work in any browser (the email template in the README sends these)
 * - code links, which only work in the browser that asked for the email
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  // Where to go afterwards: from the link, or remembered by the sign-in page in this browser.
  const remembered = request.cookies.get("signin_next")?.value;
  const next = safeNext(searchParams.get("next")) ?? safeNext(remembered ? decodeURIComponent(remembered) : null) ?? "/me";

  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${reason}&next=${encodeURIComponent(next)}`);

  // Supabase sends people back with an error when a link has expired or was already used.
  if (searchParams.get("error") || searchParams.get("error_code")) {
    return fail(searchParams.get("error_code") === "otp_expired" ? "expired" : "link");
  }

  const db = await getServerClient();
  if (!db) return fail("setup");

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  let error: { message: string } | null = null;
  if (tokenHash && type && OTP_TYPES.has(type)) {
    ({ error } = await db.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType }));
  } else if (code) {
    ({ error } = await db.auth.exchangeCodeForSession(code));
    // A code link opened in a different browser can't be completed here, but the code in the
    // same email still works on the sign-in page.
    if (error && /verifier|code challenge/i.test(error.message)) return fail("browser");
  } else {
    return fail("link");
  }

  if (error) return fail(/expired|invalid/i.test(error.message) ? "expired" : "link");

  const res = NextResponse.redirect(`${origin}${next}`);
  res.cookies.delete("signin_next");
  return res;
}
