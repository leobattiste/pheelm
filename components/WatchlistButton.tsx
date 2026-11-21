"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import Icon from "./Icon";
import { toast } from "./Toast";
import { isBannedWordMessage } from "@/lib/banned-words";
import { openSignIn } from "./SignInSheet";

type Status = "loading" | "signed-out" | "off" | "on";
type List = { id: string; title: string; count: number; has: boolean; shared?: boolean };
type Row = { id: string; title: string; list_films: { film_id: string }[] };
type Mine = { own: Row[]; shared: Row[] };

/**
 * One copy of the member's watchlists per page, fetched ahead of time (as soon as we know who
 * is signed in), so the picker opens with the lists already there instead of waiting on the
 * database. Every save refreshes it.
 */
const LOAD_MS = 12_000;
let mine: { userId: string; data: Promise<Mine> } | null = null;
function fetchMine(userId: string, fresh = false): Promise<Mine> {
  if (mine && mine.userId === userId && !fresh) return mine.data;
  const data = (async () => {
    const db = getBrowserClient();
    if (!db) throw new Error("offline");
    const work = Promise.all([
      db.from("lists").select("id, title, list_films(film_id)").eq("user_id", userId).order("created_at"),
      db.from("list_members").select("lists(id, title, list_films(film_id))").eq("user_id", userId).eq("status", "active"),
    ]);
    const late = new Promise<never>((_, fail) => setTimeout(() => fail(new Error("timeout")), LOAD_MS));
    const [own, shared] = await Promise.race([work, late]);
    if (own.error || shared.error) throw own.error ?? shared.error;
    const sharedRows = ((shared.data ?? []) as unknown as { lists: Row | null }[]).map(r => r.lists).filter((l): l is Row => !!l);
    return { own: (own.data ?? []) as Row[], shared: sharedRows };
  })();
  const entry = { userId, data };
  mine = entry;
  // A failed load isn't kept, so the next open (or Retry) asks again.
  data.catch(() => { if (mine === entry) mine = null; });
  return data;
}
/** Start loading the member's watchlists in the background. */
export function warmWatchlists(userId: string) { void fetchMine(userId).catch(() => {}); }

type Props = { filmId: string; filmTitle: string; pickerOnly?: boolean; initialUserId?: string; initialSaved?: boolean; onClose?: () => void };
const CHECK = <Icon name="check" />;
const PLUS = <Icon name="plus" />;

/** Opening the picker never writes data. All saves follow an explicit selection. */
export default function WatchlistButton({ filmId, filmTitle, pickerOnly = false, initialUserId, initialSaved = false, onClose }: Props) {
  const path = usePathname();
  const router = useRouter();
  const changed = useRef(false);
  const id = useId();
  const sheet = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>(initialUserId ? initialSaved ? "on" : "off" : "loading");
  const [userId, setUserId] = useState<string | null>(initialUserId ?? null);
  const [lists, setLists] = useState<List[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const shown = useRef(false);
  shown.current = lists !== null;

  useEffect(() => {
    let live = true;
    if (!initialUserId) {
      const db = getBrowserClient();
      if (!db) setStatus("signed-out");
      else void db.auth.getSession().then(async ({ data }) => {
        const uid = data.session?.user.id ?? null;
        if (!live) return;
        setUserId(uid);
        if (!uid) return setStatus("signed-out");
        const { data: row } = await db.from("watchlist").select("film_id").eq("user_id", uid).eq("film_id", filmId).maybeSingle();
        if (live) setStatus(row ? "on" : "off");
      });
    }
    const changed = (event: Event) => {
      const change = (event as CustomEvent<{ filmId?: string; saved?: boolean }>).detail;
      if (change?.filmId === filmId) setStatus(change.saved ? "on" : "off");
    };
    window.addEventListener("watchlistchange", changed);
    return () => { live = false; window.removeEventListener("watchlistchange", changed); };
  }, [filmId, initialUserId]);

  const loadLists = useCallback(async (fresh = false) => {
    if (!userId) return;
    setLoadFailed(false);
    const toList = (l: Row, isShared: boolean): List => ({ id: l.id, title: l.title, count: l.list_films.length, has: l.list_films.some(f => f.film_id === filmId), shared: isShared });
    try {
      const { own, shared } = await fetchMine(userId, fresh);
      setLists([...own.map(l => toList(l, false)), ...shared.map(l => toList(l, true))]);
    } catch {
      // Keep what's on screen; only a first load shows the error.
      if (!shown.current) { setLoadFailed(true); setError("Your watchlists couldn't be loaded. Try again."); }
    }
  }, [filmId, userId]);

  // Fetch ahead of time, so the picker opens ready.
  useEffect(() => { if (userId) warmWatchlists(userId); }, [userId]);

  useEffect(() => {
    if (!pickerOnly || !userId) return;
    sheet.current?.showModal();
    void loadLists();
  }, [pickerOnly, userId, loadLists]);

  const mark = (saved: boolean) => {
    changed.current = true;
    setStatus(saved ? "on" : "off");
    window.dispatchEvent(new CustomEvent("watchlistchange", { detail: { filmId, saved } }));
  };
  const open = () => { setError(""); sheet.current?.showModal(); void loadLists(); };
  const setAll = async (remove: boolean, undo = false) => {
    const db = getBrowserClient();
    if (!db || !userId || busy) return;
    setBusy(true); setError("");
    const result = remove
      ? await db.rpc("remove_film_from_watchlist", { fid: filmId })
      : await db.from("watchlist").upsert({ user_id: userId, film_id: filmId });
    if (result.error) toast.error("Your watchlist couldn’t be updated. Try again.");
    else {
      mark(!remove);
      if (remove) await loadLists(true);
      if (!undo) toast.success(remove ? `Removed ${filmTitle} from your Watchlist` : `Added ${filmTitle} to your Watchlist`, { action: { label: "Undo", run: () => { setBusy(false); return setAll(!remove, true); } } });
      else toast.success("Undone");
    }
    setBusy(false);
  };
  const toggleAll = () => setAll(status === "on");
  const setOnList = async (list: List, add: boolean, undo = false) => {
    const db = getBrowserClient();
    if (!db || busy) return;
    setBusy(true); setError("");
    const result = add
      ? await db.rpc("save_film_to_collection", { fid: filmId, lid: list.id })
      : await db.from("list_films").delete().eq("list_id", list.id).eq("film_id", filmId);
    if (result.error) toast.error("That didn’t save. Try again.");
    else {
      changed.current = true;
      if (add && !list.shared) mark(true);
      await loadLists(true);
      if (!undo) toast.success(add ? `Added to ${list.title}` : `Removed from ${list.title}`, { action: { label: "Undo", run: () => { setBusy(false); return setOnList(list, !add, true); } } });
      else toast.success("Undone");
    }
    setBusy(false);
  };
  const toggleList = (list: List) => setOnList(list, !list.has);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const db = getBrowserClient();
    const title = newTitle.trim().slice(0, 80);
    if (!db || !title || busy) return;
    setBusy(true); setError("");
    const { error } = await db.rpc("save_film_to_collection", { fid: filmId, collection_title: title });
    if (error) toast.error(isBannedWordMessage(error.message) ? error.message : "The watchlist couldn’t be created. Try again.");
    else { mark(true); setNewTitle(""); await loadLists(true); toast.success(`Created “${title}” and added ${filmTitle}`); }
    setBusy(false);
  };

  if (status === "loading") return pickerOnly ? null : (
    <button type="button" className="pill-button" data-action="watchlist" disabled aria-busy="true" aria-label="Loading watchlist">{PLUS}Watchlist</button>
  );
  if (status === "signed-out") return pickerOnly ? null : (
    <Link className="pill-button" data-action="watchlist" href={`/login?next=${encodeURIComponent(path)}`} aria-label="Add to watchlist" title="Add to watchlist"
      onClick={e => { if (openSignIn()) e.preventDefault(); }}>{PLUS}Watchlist</Link>
  );
  return (
    <>
      {!pickerOnly && <button type="button" className="pill-button" data-action="watchlist" aria-pressed={status === "on"} aria-haspopup="dialog" onClick={open} aria-label={status === "on" ? "On your watchlist. Change watchlists" : "Add to watchlist"} title={status === "on" ? "Change watchlists" : "Add to watchlist"}>{status === "on" ? CHECK : PLUS}Watchlist</button>}
      <dialog ref={sheet} className="modal save-sheet watchlist-picker" aria-labelledby={`${id}-title`} onClose={() => { if (changed.current) { router.refresh(); changed.current = false; } onClose?.(); }} onCancel={e => { if (busy) e.preventDefault(); }} onClick={e => { if (!busy && e.target === sheet.current) sheet.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id={`${id}-title`}>Add to Watchlist</h2>
          <button type="button" className="icon-button" onClick={() => sheet.current?.close()} disabled={busy} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body" aria-busy={busy}>
          <ul className="save-lists">
            <li><button type="button" className="save-row" role="checkbox" aria-checked={status === "on"} disabled={busy} onClick={toggleAll}><span className={`save-check${status === "on" ? " is-on" : ""}`} aria-hidden="true">{status === "on" && CHECK}</span><span className="save-name">All</span><span className="save-count">Watchlist</span></button></li>
            {lists === null ? <li className="save-note">{loadFailed ? <button type="button" className="link-button" onClick={() => { setError(""); void loadLists(true); }}>Retry loading watchlists</button> : "Loading your watchlists…"}</li> : lists.map(l => <li key={l.id}><button type="button" className="save-row" role="checkbox" aria-checked={l.has} disabled={busy} onClick={() => void toggleList(l)}><span className={`save-check${l.has ? " is-on" : ""}`} aria-hidden="true">{l.has && CHECK}</span><span className="save-name">{l.title}{l.shared && <span className="tile-icon" title="Shared"><Icon name="users" label="Shared" /></span>}</span></button></li>)}
          </ul>
          <form className="save-new" onSubmit={create}><label className="visually-hidden" htmlFor={`${id}-new`}>New watchlist name</label><input id={`${id}-new`} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="New watchlist, e.g. Date night" maxLength={80} disabled={busy} /><button className="button" type="submit" disabled={busy || !newTitle.trim()}>Create</button></form>
          {error && <p className="notice error" role="alert">{error}</p>}
        </div>
        <div className="modal-foot">{status === "on" && <button type="button" className="button ghost" onClick={toggleAll} disabled={busy}>Remove from watchlist</button>}<button type="button" className="button" onClick={() => sheet.current?.close()} disabled={busy}>Done</button></div>
      </dialog>
    </>
  );
}
