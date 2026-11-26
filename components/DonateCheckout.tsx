"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useEffect, useRef, useState } from "react";
import { DONATION_MAX, DONATION_MIN, DONATION_PRESETS } from "@/lib/donate";

// Loaded once per page, however many times someone changes the amount.
let stripeLoad: Promise<Stripe | null> | null = null;

/** Pick an amount, one-time or monthly, then pay in Stripe's checkout shown right on the page. */
export default function DonateCheckout({ publishableKey }: { publishableKey: string }) {
  const [amount, setAmount] = useState<number>(25);
  const [custom, setCustom] = useState("");
  const [monthly, setMonthly] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mount = useRef<HTMLDivElement>(null);

  // Stripe allows one embedded checkout on a page at a time: it is made when the payment view opens
  // and destroyed when it closes, so "Change amount" and a new Donate always start clean.
  useEffect(() => {
    if (!secret) return;
    let cancelled = false;
    let embedded: { mount: (el: HTMLElement) => void; destroy: () => void } | null = null;
    (async () => {
      try {
        const stripe = await (stripeLoad ??= loadStripe(publishableKey));
        if (!stripe || cancelled) return;
        const made = await stripe.createEmbeddedCheckoutPage({ fetchClientSecret: async () => secret });
        if (cancelled) { made.destroy(); return; }
        embedded = made;
        if (mount.current) made.mount(mount.current);
      } catch {
        if (!cancelled) { setSecret(null); setError("We could not start the payment. Please try again."); }
      }
    })();
    return () => { cancelled = true; try { embedded?.destroy(); } catch {} };
  }, [secret, publishableKey]);

  const chosen = custom.trim() ? Number(custom) : amount;
  const valid = Number.isInteger(chosen) && chosen >= DONATION_MIN && chosen <= DONATION_MAX;

  async function start() {
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      // Ask for the checkout first, so a failure shows here in our own words instead of inside Stripe's box.
      const res = await fetch("/api/donate/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: chosen, monthly }) });
      const json = (await res.json().catch(() => ({}))) as { clientSecret?: string; error?: string; why?: string };
      if (!res.ok || !json.clientSecret) throw new Error(json.why ? `${json.error ?? "failed"} (${json.why})` : json.error || "failed");
      setSecret(json.clientSecret);
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith("We could not") ? e.message : "We could not start the payment. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (secret) {
    return (
      <section className="donate-card donate-pay" aria-label="Payment">
        <button type="button" className="button ghost" onClick={() => setSecret(null)}>← Change amount</button>
        <div ref={mount} className="donate-embed" />
      </section>
    );
  }

  return (
    <section className="donate-card" aria-label="Donate">
      <div className="donate-freq" role="group" aria-label="How often">
        <button type="button" className={monthly ? "button ghost" : "button"} aria-pressed={!monthly} onClick={() => setMonthly(false)}>One time</button>
        <button type="button" className={monthly ? "button" : "button ghost"} aria-pressed={monthly} onClick={() => setMonthly(true)}>Monthly</button>
      </div>
      <div className="donate-amounts" role="group" aria-label="Amount">
        {DONATION_PRESETS.map((n) => (
          <button key={n} type="button" className={!custom.trim() && amount === n ? "button" : "button ghost"} aria-pressed={!custom.trim() && amount === n} onClick={() => { setAmount(n); setCustom(""); }}>${n}</button>
        ))}
      </div>
      <label className="donate-custom">
        <span>Other amount (USD)</span>
        <input inputMode="numeric" pattern="[0-9]*" placeholder="Other amount" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 4))} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="button" disabled={!valid || busy} onClick={start}>
        {busy ? "One moment…" : valid ? `Donate $${chosen}${monthly ? " a month" : ""}` : `Choose $${DONATION_MIN}–$${DONATION_MAX}`}
      </button>
    </section>
  );
}
