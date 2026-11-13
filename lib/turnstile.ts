import "server-only";
import { headers } from "next/headers";

/**
 * Cloudflare Turnstile: a quiet check that a form was sent by a person, not a bot. Off until
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set (free at dash.cloudflare.com).
 */
export async function passesTurnstile(f: FormData) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return true;
  const token = String(f.get("cf-turnstile-response") ?? "");
  if (!token) return false;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    return !!((await res.json()) as { success?: boolean }).success;
  } catch {
    // If Cloudflare can't be reached, the form asks the visitor to try again rather than letting
    // everything through: the forms are saved with the server's own key.
    return false;
  }
}
