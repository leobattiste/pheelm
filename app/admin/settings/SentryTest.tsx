"use client";

import { useState } from "react";

/** Sends one harmless test error from this browser, so it's easy to see that error reporting is alive. */
export default function SentryTest() {
  const [sent, setSent] = useState(false);
  return (
    <div className="admin-row-body">
      <button
        type="button"
        className="button"
        onClick={() => {
          // Thrown outside React so it reaches the page's global error handler, like a real bug would.
          setTimeout(() => {
            throw new Error("Sentry test error from Admin → Settings (safe to ignore)");
          }, 0);
          setSent(true);
        }}
      >
        Send a test error
      </button>
      <p role="status" aria-live="polite">
        {sent ? "Sent. It should show up in Sentry Issues within a minute or two." : "Throws one harmless error from this browser."}
      </p>
    </div>
  );
}
