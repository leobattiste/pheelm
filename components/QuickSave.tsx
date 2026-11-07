"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import Icon from "./Icon";

// One look-up of the member's Watchlist for every card on the page.
let saved: Promise<{ userId: string; ids: Set<string> } | null> | null = null;
function load() {
  if (!saved) {
    saved = (async () => {
      const db = getBrowserClient();
      if (!db) return null;
      const { data } = await db.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return null;
      const { data: rows } = await db.from("watchlist").select("film_id").eq("user_id", userId);
      return { userId, ids: new Set(((rows ?? []) as { film_id: string }[]).map((r) => r.film_id)) };
    })();
  }
  return saved;
}

/** The small + on a film card: saves it to your Watchlist (or takes it off) without opening it. */
export default function QuickSave({ filmId, title }: { filmId: string; title: string }) {
  const [state, setState] = useState<{ userId: string; on: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    void load().then((me) => { if (live && me) setState({ userId: me.userId, on: me.ids.has(filmId) }); });
    return () => { live = false; };
  }, [filmId]);

  if (!state) return null;

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const db = getBrowserClient();
    if (!db) return;
    const on = !state.on;
    setState({ ...state, on });
    const me = await load();
    if (on) me?.ids.add(filmId); else me?.ids.delete(filmId);
    const { error } = on
      ? await db.from("watchlist").insert({ user_id: state.userId, film_id: filmId })
      : await db.from("watchlist").delete().eq("user_id", state.userId).eq("film_id", filmId);
    if (error && !/duplicate/i.test(error.message)) setState({ ...state, on: !on });
  };

  return (
    <button type="button" className="quick-save" aria-pressed={state.on} onClick={toggle}
      aria-label={state.on ? `Remove ${title} from your Watchlist` : `Save ${title} to your Watchlist`}>
      <Icon name={state.on ? "check" : "plus"} />
    </button>
  );
}
