"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { openSignIn } from "./SignInSheet";

/** Opens the "Get early access" sheet (the sign-up sheet), or the sign-in page without it. */
export default function EarlyAccessButton({ children = "Get Early Access", className = "button" }: { children?: ReactNode; className?: string }) {
  return (
    <Link data-open className={className} href="/login?mode=signup&next=/films" onClick={(e) => { if (openSignIn("signup")) e.preventDefault(); }}>
      {children}
    </Link>
  );
}

/** Opens sign-in when returning from a protected action; public links navigate normally. */
export function EarlyAccessGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("join") !== "1") return;
    const next = params.get("next") ?? undefined;
    // Wait a frame so the sheet in the header is ready.
    requestAnimationFrame(() => openSignIn("signup", next));
    history.replaceState(null, "", "/");
  }, []);

  return <div className="early-gate">{children}</div>;
}
