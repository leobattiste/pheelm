import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { checkoutParams, parseDonation } from "@/lib/donate";
import { SITE_URL } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

// Pinned, so a change on Stripe's side never changes what this asks for.
const STRIPE_VERSION = "2025-09-30.clover";

/** Opens an embedded Stripe Checkout for a chosen amount and hands the browser its client secret. */
export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Donations are not set up here yet." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  const donation = parseDonation(body);
  if (!donation) return NextResponse.json({ error: "Choose a whole-dollar amount from $1 to $1,000." }, { status: 400 });
  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": STRIPE_VERSION },
      body: checkoutParams(donation, `${SITE_URL}/donate?thanks=1`),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const json = (await res.json()) as { client_secret?: string; error?: { type?: string; code?: string; param?: string; message?: string } };
    if (!res.ok || !json.client_secret) {
      // The code says what went wrong (a key without permission, a bad version...) without the message,
      // which can quote part of the key.
      const why = [res.status, json.error?.type, json.error?.code, json.error?.param].filter(Boolean).join(" ");
      console.error("Stripe checkout session failed:", why, json.error?.message);
      Sentry.captureMessage(`Stripe checkout session failed: ${why}`, "error");
      return NextResponse.json({ error: "We could not start the payment. Please try again.", why }, { status: 502 });
    }
    return NextResponse.json({ clientSecret: json.client_secret });
  } catch (error) {
    console.error("Stripe checkout session failed:", error instanceof Error ? error.message : "unknown");
    Sentry.captureException(error);
    return NextResponse.json({ error: "We could not start the payment. Please try again.", why: "network" }, { status: 502 });
  }
}
