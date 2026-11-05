"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

type Status = "loading" | "signed-out" | "none" | "listed" | "seen";

const BOOKMARK = "M6 3.5h8v13l-4-3-4 3z";
const CHECK = "m5 10.5 3.2 3.2L15 7";

/**
 * Round buttons to save a film to the watchlist and mark it as seen, like the save button on
 * Covvvvvers cover pages. Checks the session in the browser so film pages stay static.
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

  if (status === "loading") return <span className="round-button is-loading" aria-hidden="true" />;
  if (status === "signed-out") {
    return (
      <Link className="round-button" href={`/login?next=${encodeURIComponent(path)}`} aria-label="Sign in to save to your watchlist" title="Save to watchlist">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d={BOOKMARK} /></svg>
      </Link>
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

  const saved = status !== "none";
  return (
    <>
      <button type="button" className="round-button" aria-pressed={saved} disabled={busy}
        aria-label={saved ? "Remove from watchlist" : "Save to watchlist"} title={saved ? "On your watchlist" : "Save to watchlist"}
        onClick={() => update(saved ? "none" : "listed")}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d={BOOKMARK} /></svg>
      </button>
      <button type="button" className="round-button" aria-pressed={status === "seen"} disabled={busy}
        aria-label={status === "seen" ? "Mark as not seen" : "Mark as seen"} title={status === "seen" ? "Seen" : "Mark as seen"}
        onClick={() => update(status === "seen" ? "listed" : "seen")}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d={CHECK} /></svg>
      </button>
    </>
  );
}
