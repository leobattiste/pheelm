"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { startDonation } from "./actions";

type Kind = "once" | "monthly";
const PRESETS: Record<Kind, number[]> = { once: [5, 10, 25, 50], monthly: [5, 10, 25, 50] };

/** Choose once or monthly and an amount, then pay in Stripe's secure form, right on this page. */
export default function DonateForm({ publishableKey }: { publishableKey: string }) {
  const [kind, setKind] = useState<Kind>("once");
  const [amount, setAmount] = useState<number>(10);
  const [custom, setCustom] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Stripe's script loads only once someone chooses to pay, not on every visit to the page.
  const stripePromise = useMemo(() => (secret ? loadStripe(publishableKey) : null), [secret, publishableKey]);

  const value = custom ? Number(custom) : amount;
  const min = kind === "monthly" ? 5 : 1;
  const valid = Number.isFinite(value) && value >= min && value <= 1000;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    const res = await startDonation(kind, value);
    setBusy(false);
    if ("error" in res) setError(res.error);
    else setSecret(res.clientSecret);
  }

  if (secret) {
    return (
      <section className="donate-checkout" aria-label="Payment">
        <div className="donate-checkout-head">
          <p><strong>${value.toLocaleString("en-US")}{kind === "monthly" ? " a month" : ""}</strong> to Pheelm</p>
          <button type="button" className="button ghost" onClick={() => setSecret(null)}>Change amount</button>
        </div>
        <EmbeddedCheckoutProvider key={secret} stripe={stripePromise} options={{ clientSecret: secret }}>
          <EmbeddedCheckout className="donate-embed" />
        </EmbeddedCheckoutProvider>
      </section>
    );
  }

  return (
    <form className="donate-form" onSubmit={start}>
      <div className="donate-kind" role="group" aria-label="How often">
        {(["once", "monthly"] as const).map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => { setKind(k); setError(""); }}>
            {k === "once" ? "Give once" : "Monthly"}
          </button>
        ))}
      </div>
      <div className="donate-amounts" role="group" aria-label="Amount">
        {PRESETS[kind].map((n) => (
          <button key={n} type="button" className="chip" aria-pressed={!custom && amount === n} onClick={() => { setAmount(n); setCustom(""); setError(""); }}>
            ${n}
          </button>
        ))}
      </div>
      <label className="field donate-custom">
        Other amount (USD)
        <input
          inputMode="decimal" type="number" min={min} max={1000} step="1" placeholder={`$${min} to $1,000`}
          value={custom} onChange={(e) => { setCustom(e.target.value); setError(""); }}
        />
      </label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button type="submit" className="button primary donate-submit" disabled={!valid || busy}>
        {busy ? "Opening…" : `Donate ${valid ? `$${value.toLocaleString("en-US")}` : ""}${kind === "monthly" && valid ? " a month" : ""}`}
      </button>
    </form>
  );
}
