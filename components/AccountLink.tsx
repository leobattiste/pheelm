"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * The menu's account link: the member's name once signed in, otherwise Sign in, which
 * brings them back to the page they were on. Checks the session in the browser so every
 * public page can stay static.
 */
export default function AccountLink() {
  const path = usePathname();
  const [state, setState] = useState<"loading" | "in" | "out">("loading");
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) {
      setState("out");
      return;
    }
    const read = async (userId: string | undefined) => {
      setState(userId ? "in" : "out");
      if (!userId) return setName(null);
      const { data } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      setName(data?.display_name?.trim() || null);
    };
    db.auth.getSession().then(({ data }) => read(data.session?.user.id));
    const { data } = db.auth.onAuthStateChange((_e, session) => read(session?.user.id));
    const onProfile = () => db.auth.getSession().then(({ data }) => read(data.session?.user.id));
    window.addEventListener("profilechange", onProfile);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("profilechange", onProfile);
    };
  }, []);

  if (state === "in") return <Link href="/me">Account</Link>;
  const next = path && !path.startsWith("/login") && !path.startsWith("/me") ? `?next=${encodeURIComponent(path)}` : "";
  return (
    <Link href={`/login${next}`} aria-busy={state === "loading"}>
      Sign in
    </Link>
  );
}
