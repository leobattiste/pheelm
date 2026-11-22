import "server-only";
import Stripe from "stripe";

/** The "Support Pheelm" product in Stripe; every donation is recorded against it. */
export const DONATION_PRODUCT = "prod_VfyGr9uaAbYC9P";

/** Limits, in cents. Monthly gifts start at $5; one-time gifts at $1. Both stop at $1,000. */
export const DONATE_LIMITS = { once: { min: 100, max: 100_000 }, monthly: { min: 500, max: 100_000 } } as const;
export type DonationKind = keyof typeof DONATE_LIMITS;

const secret = process.env.STRIPE_SECRET_KEY || "";
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
/** The on-page checkout needs both keys; without them the Donate page uses the Stripe links. */
export const EMBEDDED_DONATIONS = Boolean(secret && PUBLISHABLE_KEY);

let client: Stripe | null = null;
const stripe = () => (client ??= new Stripe(secret));

/** Whole dollars in, cents out, or null if the amount is outside the limits for that kind of gift. */
export function donationCents(kind: DonationKind, dollars: number): number | null {
  if (!Number.isFinite(dollars)) return null;
  const cents = Math.round(dollars * 100);
  const { min, max } = DONATE_LIMITS[kind];
  return cents >= min && cents <= max ? cents : null;
}

/** Starts an embedded Stripe Checkout for a donation and returns the secret the page needs to show it. */
export async function createDonationSession(kind: DonationKind, cents: number, origin: string): Promise<string> {
  const monthly = kind === "monthly";
  const session = await stripe().checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: monthly ? "subscription" : "payment",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        product: DONATION_PRODUCT,
        unit_amount: cents,
        ...(monthly ? { recurring: { interval: "month" as const } } : {}),
      },
    }],
    ...(monthly
      ? { subscription_data: { description: "Monthly donation to Pheelm", metadata: { purpose: "donation", kind } } }
      : { submit_type: "donate" as const, customer_creation: "always" as const, payment_intent_data: { description: "Donation to Pheelm", metadata: { purpose: "donation", kind } } }),
    custom_text: { submit: { message: "Pheelm is not a tax-exempt charity, so donations are not tax-deductible. Thank you for supporting Black filmmakers." } },
    metadata: { purpose: "donation", kind, source: "pheelm.com/donate" },
    return_url: `${origin}/donate?session_id={CHECKOUT_SESSION_ID}`,
  });
  if (!session.client_secret) throw new Error("Stripe returned no client secret");
  return session.client_secret;
}

/** After checkout: whether the donor's session went through, and if it was a monthly gift. */
export async function donationResult(sessionId: string): Promise<{ paid: boolean; monthly: boolean } | null> {
  if (!EMBEDDED_DONATIONS || !/^cs_(live|test)_[A-Za-z0-9]{10,}$/.test(sessionId)) return null;
  try {
    const s = await stripe().checkout.sessions.retrieve(sessionId);
    if (s.metadata?.purpose !== "donation") return null;
    return { paid: s.status === "complete", monthly: s.mode === "subscription" };
  } catch {
    return null;
  }
}
