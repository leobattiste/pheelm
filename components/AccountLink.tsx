"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

export default function AccountLink() {
  const path = usePathname();
  const [state, setState] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) {
      setState("out");
      return;
    }
    let active = true;
    const refresh = async () => {
      const { data: { user } } = await db.auth.getUser();
      if (active) setState(user ? "in" : "out");
    };
    void refresh().catch(() => { if (active) setState("out"); });
    const { data } = db.auth.onAuthStateChange(() => {
      // Do not await another Supabase query inside the callback: it can deadlock
      // the auth client while an auth state transition is in progress.
      setTimeout(() => { if (active) void refresh().catch(() => {}); }, 0);
    });
    const onProfile = () => { void refresh().catch(() => {}); };
    window.addEventListener("profilechange", onProfile);
    return () => {
      active = false;
      data.subscription.unsubscribe();
      window.removeEventListener("profilechange", onProfile);
    };
  }, []);

  if (state === "in") return <Link href="/me">Account</Link>;
  const next = path && !path.startsWith("/login") && !path.startsWith("/me") ? `?next=${encodeURIComponent(path)}` : "";
  return <Link href={`/login${next}`} aria-busy={state === "loading"}>Sign in</Link>;
}
