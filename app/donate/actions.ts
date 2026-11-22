"use server";

import { headers } from "next/headers";
import { createDonationSession, donationCents, EMBEDDED_DONATIONS, type DonationKind } from "@/lib/donate";

/** Creates the checkout for the amount the donor picked. Amounts are re-checked here, never trusted. */
export async function startDonation(kind: DonationKind, dollars: number): Promise<{ clientSecret: string } | { error: string }> {
  if (!EMBEDDED_DONATIONS) return { error: "Donations aren't available right now." };
  if (kind !== "once" && kind !== "monthly") return { error: "Choose once or monthly." };
  const cents = donationCents(kind, dollars);
  if (cents === null) return { error: kind === "monthly" ? "Monthly gifts are $5 to $1,000." : "Gifts are $1 to $1,000." };
  const h = await headers();
  // Donors only ever come back to Pheelm itself (or its preview and local builds).
  const raw = (h.get("x-forwarded-host") || h.get("host") || "").toLowerCase();
  const host = /^([a-z0-9-]+\.)*(pheelm\.com|pheelm[a-z0-9-]*\.vercel\.app)$/.test(raw) || /^localhost(:\d+)?$/.test(raw) ? raw : "www.pheelm.com";
  const origin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  try {
    return { clientSecret: await createDonationSession(kind, cents, origin) };
  } catch (e) {
    console.error("donation checkout failed", e);
    return { error: "We couldn't open the payment form. Please try again in a moment." };
  }
}
