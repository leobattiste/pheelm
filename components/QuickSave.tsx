"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import Icon from "./Icon";
import WatchlistButton, { warmWatchlists } from "./WatchlistButton";
import { myIds } from "@/lib/my-rows";

// One look-up of the member's Watchlist for every card on the page.
let authListenerReady = false;
let saved: Promise<{ userId: string; ids: Set<string> } | null> | null = null;
function load() {
  const client = getBrowserClient();
  if (client && !authListenerReady) {
    authListenerReady = true;
    client.auth.onAuthStateChange(event => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      saved = null;
      // After the shared copy (lib/my-rows) has forgotten the old member too.
      setTimeout(() => window.dispatchEvent(new Event("watchlistchange")), 0);
    });
  }
  if (!saved) {
    // Shared with the film page's Watchlist button; a read that fails or runs out of time
    // hides the + (as signed out) and is asked again next time.
    const ask: Promise<{ userId: string; ids: Set<string> } | null> = myIds("watchlist").then(
      me => { if (me) warmWatchlists(me.userId); return me; },
      () => { if (saved === ask) saved = null; return null; },
    );
    saved = ask;
  }
  return saved;
}

/** The poster action opens the shared picker; opening or dismissing never saves a film. */
export default function QuickSave({ filmId, title }: { filmId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ userId: string; on: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    const refresh = () => void load().then(me => { if (live) setState(me ? { userId: me.userId, on: me.ids.has(filmId) } : null); });
    const changed = (event: Event) => {
      const change = (event as CustomEvent<{ filmId?: string; saved?: boolean }>).detail;
      if (change?.filmId) {
        void load().then(me => {
          if (!me) return;
          if (change.saved) me.ids.add(change.filmId!); else me.ids.delete(change.filmId!);
          if (live && change.filmId === filmId) setState({ userId: me.userId, on: !!change.saved });
        });
      } else refresh();
    };
    refresh();
    window.addEventListener("watchlistchange", changed);
    return () => { live = false; window.removeEventListener("watchlistchange", changed); };
  }, [filmId]);

  if (!state) return null;

  return (
    <>
      <button type="button" className="quick-save" aria-pressed={state.on} aria-haspopup="dialog" onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        aria-label={state.on ? `Change watchlists for ${title}` : `Save ${title} to your Watchlist`} title="Choose watchlists">
        <Icon name={state.on ? "check" : "plus"} />
      </button>
      {open && <WatchlistButton filmId={filmId} filmTitle={title} pickerOnly initialUserId={state.userId} initialSaved={state.on} onClose={() => setOpen(false)} />}
    </>
  );
}
