"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

type Status = "loading" | "signed-out" | "off" | "on";

const ICON = (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3.5h8v13l-4-3-4 3z" /></svg>
);

/**
 * Saves the film to the visitor's watchlist, or takes it off. Checks the session in the
 * browser so film pages stay static.
 */
export default function WatchlistButton({ filmId }: { filmId: string }) {
  const path = usePathname();
  const [status, setStatus] = useState<Status>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) return setStatus("signed-out");
    db.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user.id ?? null;
      setUserId(id);
      if (!id) return setStatus("signed-out");
      const { data: row } = await db.from("watchlist").select("film_id").eq("user_id", id).eq("film_id", filmId).maybeSingle();
      setStatus(row ? "on" : "off");
    });
  }, [filmId]);

  if (status === "signed-out" || status === "loading") {
    return (
      <Link className="pill-button" href={`/login?next=${encodeURIComponent(path)}`} aria-busy={status === "loading"}>
        {ICON}
        Watchlist
      </Link>
    );
  }

  const toggle = async () => {
    const db = getBrowserClient();
    if (!db || !userId) return;
    const next = status === "on" ? "off" : "on";
    setStatus(next);
    setBusy(true);
    const { error } =
      next === "off"
        ? await db.from("watchlist").delete().eq("user_id", userId).eq("film_id", filmId)
        : await db.from("watchlist").upsert({ user_id: userId, film_id: filmId });
    setBusy(false);
    if (error) setStatus(status);
  };

  return (
    <button type="button" className="pill-button" aria-pressed={status === "on"} disabled={busy} onClick={toggle}>
      {ICON}
      {status === "on" ? "On watchlist" : "Watchlist"}
    </button>
  );
}
