"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

type Status = "loading" | "signed-out" | "off" | "on";

// A plus (cross) before the film is saved, a checkmark once it is.
const PLUS = <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>;
const CHECK = <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>;

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
        {PLUS}
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
    <button type="button" className="pill-button" aria-pressed={status === "on"} disabled={busy} onClick={toggle}
      aria-label={status === "on" ? "On your watchlist. Remove it" : "Add to watchlist"}>
      {status === "on" ? CHECK : PLUS}
      Watchlist
    </button>
  );
}
