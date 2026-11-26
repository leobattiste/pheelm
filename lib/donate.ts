/** Donation amounts: the presets on the Donate page and the limits the server enforces. */
export const DONATION_PRESETS = [5, 10, 25, 50] as const;
export const DONATION_MIN = 1;
export const DONATION_MAX = 1000;
/** What the donation is called in Stripe; made on the spot, so it works in a test account as well as the live one. */
export const DONATION_NAME = "Support Pheelm";

export type Donation = { cents: number; monthly: boolean };

/** A whole-dollar amount from $1 to $1,000, one-time or monthly; anything else is rejected. */
export function parseDonation(input: unknown): Donation | null {
  if (!input || typeof input !== "object") return null;
  const { amount, monthly } = input as { amount?: unknown; monthly?: unknown };
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < DONATION_MIN || amount > DONATION_MAX) return null;
  if (monthly !== undefined && typeof monthly !== "boolean") return null;
  return { cents: amount * 100, monthly: monthly === true };
}

/** The form Stripe's API takes to open an embedded Checkout for this donation. */
export function checkoutParams(d: Donation, returnUrl: string): URLSearchParams {
  const p = new URLSearchParams();
  p.set("ui_mode", "embedded_page");
  p.set("mode", d.monthly ? "subscription" : "payment");
  p.set("return_url", returnUrl);
  p.set("submit_type", "donate");
  p.set("line_items[0][quantity]", "1");
  p.set("line_items[0][price_data][currency]", "usd");
  p.set("line_items[0][price_data][product_data][name]", DONATION_NAME);
  p.set("line_items[0][price_data][unit_amount]", String(d.cents));
  if (d.monthly) {
    p.set("line_items[0][price_data][recurring][interval]", "month");
    p.delete("submit_type"); // Stripe only allows it for one-time payments
  }
  return p;
}
