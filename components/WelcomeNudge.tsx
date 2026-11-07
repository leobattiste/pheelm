"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const WELCOMED = "pheelm:welcomed";

/**
 * Sends a new member (signed in, no handle yet, never welcomed on this device) to the welcome
 * steps once. Anyone who skips them isn't sent again.
 */
export default function WelcomeNudge() {
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    const check = (handle: string | null) => {
      if (handle || /^\/(welcome|login|auth|account|profile|admin)(\/|$)/.test(path)) return;
      try {
        if (localStorage.getItem(WELCOMED)) return;
        localStorage.setItem(WELCOMED, "1");
      } catch { return; }
      router.push(`/welcome?next=${encodeURIComponent(path)}`);
    };
    const seen = (window as { __pheelmMe?: { handle: string | null } }).__pheelmMe;
    if (seen) check(seen.handle);
    const on = (e: Event) => check((e as CustomEvent<{ handle: string | null }>).detail.handle);
    window.addEventListener("pheelm:me", on);
    return () => window.removeEventListener("pheelm:me", on);
  }, [path, router]);

  return null;
}
