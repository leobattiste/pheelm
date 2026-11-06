"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { openSignIn } from "./SignInSheet";

type Status = "loading" | "signed-out" | "off" | "on";
type List = { id: string; title: string; count: number; has: boolean };

// A plus (cross) before the film is saved, a checkmark once it is.
const PLUS = <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>;
const CHECK = <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>;

/**
 * Saves the film to the visitor's watchlist ("All"), then opens a sheet to sort it into their
 * own collections or start a new one. Checks the session in the browser so film pages stay static.
 */
export default function WatchlistButton({ filmId, filmTitle }: { filmId: string; filmTitle: string }) {
  const path = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [lists, setLists] = useState<List[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");
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

  const loadLists = async () => {
    const db = getBrowserClient();
    if (!db || !userId) return;
    const { data } = await db.from("lists").select("id, title, list_films(film_id)").eq("user_id", userId).order("created_at");
    setLists(
      (data ?? []).map((l: { id: string; title: string; list_films: { film_id: string }[] }) => ({
        id: l.id,
        title: l.title,
        count: l.list_films.length,
        has: l.list_films.some((f) => f.film_id === filmId),
      })),
    );
  };

  if (status === "signed-out" || status === "loading") {
    return (
      <Link className="pill-button" data-action="watchlist" href={`/login?next=${encodeURIComponent(path)}`} aria-busy={status === "loading"}
        onClick={(e) => { if (status === "signed-out" && openSignIn()) e.preventDefault(); }}>
        {PLUS}
        Watchlist
      </Link>
    );
  }

  const db = getBrowserClient()!;

  const open = async () => {
    setError("");
    if (status === "off") {
      // Saving puts the film in All straight away; the sheet is for sorting it further.
      setStatus("on");
      const { error } = await db.from("watchlist").upsert({ user_id: userId, film_id: filmId });
      if (error) {
        setStatus("off");
        return;
      }
    }
    sheet.current?.showModal();
    loadLists();
  };

  const toggleList = async (list: List) => {
    setLists((ls) => ls?.map((l) => (l.id === list.id ? { ...l, has: !l.has, count: l.count + (l.has ? -1 : 1) } : l)) ?? null);
    const { error } = list.has
      ? await db.from("list_films").delete().eq("list_id", list.id).eq("film_id", filmId)
      : await db.from("list_films").insert({ list_id: list.id, film_id: filmId });
    if (error) {
      setError("That didn't save. Try again.");
      loadLists();
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim().slice(0, 80);
    if (!title) return;
    setBusy(true);
    setError("");
    const { data, error } = await db.from("lists").insert({ user_id: userId, title }).select("id, title").single();
    if (error || !data) {
      setBusy(false);
      setError(/relation|does not exist|schema cache/i.test(error?.message ?? "") ? "Collections aren't set up yet: the site owner needs to run supabase/member-collections.sql." : "The collection couldn't be created. Try again.");
      return;
    }
    await db.from("list_films").insert({ list_id: data.id, film_id: filmId });
    setLists((ls) => [...(ls ?? []), { id: data.id, title: data.title, count: 1, has: true }]);
    setNewTitle("");
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    // Leaving All also takes the film out of every collection it's in.
    const ids = (lists ?? []).filter((l) => l.has).map((l) => l.id);
    if (ids.length) await db.from("list_films").delete().eq("film_id", filmId).in("list_id", ids);
    const { error } = await db.from("watchlist").delete().eq("user_id", userId).eq("film_id", filmId);
    setBusy(false);
    if (!error) {
      setStatus("off");
      sheet.current?.close();
    }
  };

  return (
    <>
      <button type="button" className="pill-button" data-action="watchlist" aria-pressed={status === "on"} aria-haspopup="dialog" onClick={open}
        aria-label={status === "on" ? "On your watchlist. Change collections" : "Add to watchlist"}>
        {status === "on" ? CHECK : PLUS}
        Watchlist
      </button>

      <dialog ref={sheet} className="modal save-sheet" aria-labelledby="save-title" onClick={(e) => { if (e.target === sheet.current) sheet.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id="save-title">Saved to All</h2>
          <button type="button" className="icon-button" onClick={() => sheet.current?.close()} aria-label="Close">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <div className="modal-body">
          <p className="save-intro">
            <strong>{filmTitle}</strong> is on your watchlist. Add it to one of your collections too.
          </p>
          <ul className="save-lists">
            <li>
              <span className="save-row is-fixed">
                <span className="save-check is-on" aria-hidden="true">{CHECK}</span>
                <span className="save-name">All</span>
                <span className="save-count">Watchlist</span>
              </span>
            </li>
            {lists === null ? (
              <li className="save-note">Loading your collections…</li>
            ) : (
              lists.map((l) => (
                <li key={l.id}>
                  <button type="button" className="save-row" role="checkbox" aria-checked={l.has} onClick={() => toggleList(l)}>
                    <span className={`save-check${l.has ? " is-on" : ""}`} aria-hidden="true">{l.has && CHECK}</span>
                    <span className="save-name">{l.title}</span>
                    <span className="save-count">{l.count} {l.count === 1 ? "film" : "films"}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <form className="save-new" onSubmit={create}>
            <label className="visually-hidden" htmlFor="new-collection">New collection name</label>
            <input id="new-collection" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New collection, e.g. Date night" maxLength={80} />
            <button className="button ghost" type="submit" disabled={busy || !newTitle.trim()}>Create</button>
          </form>
          {error && <p className="notice error" role="alert">{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="button ghost" onClick={remove} disabled={busy}>Remove from watchlist</button>
          <button type="button" className="button" onClick={() => sheet.current?.close()}>Done</button>
        </div>
      </dialog>
    </>
  );
}
