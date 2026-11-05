"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

type Status = "loading" | "signed-out" | "none" | "listed" | "seen";

/**
 * Add to watchlist and mark as seen. Checks the session in the browser so film pages stay static.
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
      const { data: row } = await db.from("watchlist").select("seen").eq("user_id", id).eq("film_id", filmId).maybeSingle();
      setStatus(row ? (row.seen ? "seen" : "listed") : "none");
    });
  }, [filmId]);

  if (status === "loading") return <div className="watch-actions" aria-busy="true" />;
  if (status === "signed-out") {
    return (
      <div className="watch-actions">
        <Link className="button" href={`/login?next=${encodeURIComponent(path)}`}>
          + Watchlist
        </Link>
      </div>
    );
  }

  const update = async (next: Status) => {
    const db = getBrowserClient();
    if (!db || !userId) return;
    const prev = status;
    setStatus(next);
    setBusy(true);
    const { error } =
      next === "none"
        ? await db.from("watchlist").delete().eq("user_id", userId).eq("film_id", filmId)
        : await db.from("watchlist").upsert({ user_id: userId, film_id: filmId, seen: next === "seen" });
    setBusy(false);
    if (error) setStatus(prev);
  };

  return (
    <div className="watch-actions">
      <button type="button" className="button" aria-pressed={status !== "none"} disabled={busy}
        onClick={() => update(status === "none" ? "listed" : "none")}>
        {status === "none" ? "+ Watchlist" : "✓ On your watchlist"}
      </button>
      <button type="button" className="button ghost" aria-pressed={status === "seen"} disabled={busy}
        onClick={() => update(status === "seen" ? "listed" : "seen")}>
        {status === "seen" ? "✓ Seen" : "Mark as seen"}
      </button>
    </div>
  );
}
