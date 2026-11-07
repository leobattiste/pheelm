"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { openSignIn } from "./SignInSheet";

/** Opens the "Get early access" sheet (the sign-up sheet), or the sign-in page without it. */
export default function EarlyAccessButton({ children = "Get early access", className = "button" }: { children?: ReactNode; className?: string }) {
  return (
    <Link data-open className={className} href="/login?mode=signup&next=/films" onClick={(e) => { if (openSignIn("signup")) e.preventDefault(); }}>
      {children}
    </Link>
  );
}

/**
 * On the home page while Pheelm is in early access: films, directors and collections show, but
 * pressing any of them opens "Get early access" instead. Arriving from a members-only page
 * (/?join=1&next=…) opens it straight away and returns there after signing up.
 */
export function EarlyAccessGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("join") !== "1") return;
    const next = params.get("next") ?? undefined;
    // Wait a frame so the sheet in the header is ready.
    requestAnimationFrame(() => openSignIn("signup", next));
    history.replaceState(null, "", "/");
  }, []);

  return (
    <div
      className="early-gate"
      onClickCapture={(e) => {
        const link = (e.target as HTMLElement).closest("a");
        if (!link || link.closest("[data-open]")) return;
        e.preventDefault();
        e.stopPropagation();
        openSignIn("signup", link.getAttribute("href") ?? undefined);
      }}
    >
      {children}
    </div>
  );
}
