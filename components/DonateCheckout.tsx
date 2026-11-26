"use client";

import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useRef, useState } from "react";
import { DONATION_MAX, DONATION_MIN, DONATION_PRESETS } from "@/lib/donate";

/** Pick an amount, one-time or monthly, then pay in Stripe's checkout shown right on the page. */
export default function DonateCheckout({ publishableKey }: { publishableKey: string }) {
  const [amount, setAmount] = useState<number>(25);
  const [custom, setCustom] = useState("");
  const [monthly, setMonthly] = useState(false);
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mount = useRef<HTMLDivElement>(null);
  const checkout = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => () => { checkout.current?.destroy(); checkout.current = null; }, []);

  const chosen = custom.trim() ? Number(custom) : amount;
  const valid = Number.isInteger(chosen) && chosen >= DONATION_MIN && chosen <= DONATION_MAX;

  async function start() {
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      const stripe = await loadStripe(publishableKey);
      if (!stripe) throw new Error("no stripe");
      const embedded = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: async () => {
          const res = await fetch("/api/donate/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: chosen, monthly }) });
          const json = (await res.json()) as { clientSecret?: string; error?: string };
          if (!res.ok || !json.clientSecret) throw new Error(json.error || "failed");
          return json.clientSecret;
        },
      });
      setPaying(true);
      requestAnimationFrame(() => { if (mount.current) { embedded.mount(mount.current); checkout.current = embedded; } });
    } catch {
      setError("We could not start the payment. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function change() { checkout.current?.destroy(); checkout.current = null; setPaying(false); }

  if (paying) {
    return (
      <section className="donate-card donate-pay" aria-label="Payment">
        <button type="button" className="button ghost" onClick={change}>← Change amount</button>
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
