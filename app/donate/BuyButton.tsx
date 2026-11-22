"use client";

import Script from "next/script";
import { createElement, useState } from "react";

/**
 * Stripe's Buy Button. Stripe draws the button and opens its secure checkout; card details go to
 * Stripe, never to Pheelm. Its colors and text are set in Stripe (Payment Links → Buy button).
 */
export default function BuyButton({ buttonId, publishableKey }: { buttonId: string; publishableKey: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="donate-button">
      <Script src="https://js.stripe.com/v3/buy-button.js" strategy="afterInteractive" onError={() => setFailed(true)} />
      {createElement("stripe-buy-button", { "buy-button-id": buttonId, "publishable-key": publishableKey })}
      {failed && (
        <p className="notice error" role="alert">
          The donate button couldn&rsquo;t load. Check your connection or turn off a blocker for this page, then reload.
        </p>
      )}
    </div>
  );
}
