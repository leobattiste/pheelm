"use client";

import Script from "next/script";

const KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * The bot check inside a form. It only shows itself when Cloudflare isn't sure; it adds a hidden
 * token the server checks. Renders nothing until the keys are set.
 */
export default function Turnstile() {
  if (!KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
      <div className="cf-turnstile" data-sitekey={KEY} data-appearance="interaction-only" data-size="flexible" />
    </>
  );
}
