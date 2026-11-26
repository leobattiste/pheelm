"use client";

import { useEffect, useRef, useState } from "react";

const CLIENT_ID = "BAA714jN1az7F-kzBdbi2G70PFXU75Kp8Sr7eVMC0Bfhcq57HK6mQNa5G26Lf-Jq55pd-xh3kwCma1hyY4";
const SDK = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&components=hosted-buttons&enable-funding=venmo&currency=USD`;

type PayPal = { HostedButtons: (o: { hostedButtonId: string }) => { render: (el: HTMLElement) => Promise<unknown> } };
declare global { interface Window { paypal?: PayPal } }

let sdk: Promise<PayPal> | null = null;
function loadSdk(): Promise<PayPal> {
  if (window.paypal) return Promise.resolve(window.paypal);
  sdk ??= new Promise<PayPal>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK;
    s.async = true;
    s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("no paypal")));
    s.onerror = () => { sdk = null; reject(new Error("paypal failed to load")); };
    document.head.appendChild(s);
  });
  return sdk;
}

/** PayPal's hosted Donate button (card, PayPal or Venmo); the amount and thank-you are set up in PayPal. */
export default function PayPalDonate({ buttonId }: { buttonId: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const el = box.current;
    loadSdk()
      .then((paypal) => {
        if (cancelled || !el) return;
        el.replaceChildren();
        return paypal.HostedButtons({ hostedButtonId: buttonId }).render(el);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; el?.replaceChildren(); };
  }, [buttonId]);

  return (
    <section className="donate-card donate-paypal" aria-label="Donate">
      <div ref={box} className="donate-paypal-box" />
      {failed && <p className="error" role="alert">PayPal could not load. Turn off any content blocker for this page and try again.</p>}
    </section>
  );
}
