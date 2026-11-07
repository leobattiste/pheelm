"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { createCollection } from "@/app/me/actions";
import Icon from "./Icon";
import { openSignIn } from "./SignInSheet";

export type Show = "all" | "staff" | "community" | "for-you" | "following";
export const SHOWS: { value: Show; label: string; members?: boolean }[] = [
  { value: "all", label: "All collections" },
  { value: "staff", label: "Staff picks" },
  { value: "community", label: "Community" },
  { value: "for-you", label: "For you", members: true },
  { value: "following", label: "Following", members: true },
];
const SORTS = [["popular", "Popular"], ["new", "Newest"]] as const;

/**
 * The Collections page's bar: "Create" (for members) and a Filters sheet to sort, and to show
 * staff picks, the community's, ones picked for you or the ones you follow.
 */
export default function CollectionsToolbar({ signedIn, show, sort }: { signedIn: boolean; show: Show; sort: "popular" | "new" }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const filters = useRef<HTMLDialogElement>(null);
  const create = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const active = (show !== "all" ? 1 : 0) + (sort !== "popular" ? 1 : 0);

  const go = (next: { show?: Show; sort?: string }) => {
    const p = new URLSearchParams(params.toString());
    const s = next.show ?? show;
    const o = next.sort ?? sort;
    if (s === "all") p.delete("show"); else p.set("show", s);
    if (o === "popular") p.delete("sort"); else p.set("sort", o);
    const q = p.toString();
    router.replace(q ? `${path}?${q}` : path, { scroll: false });
  };

  return (
    <div className="toolbar collections-toolbar">
      {signedIn && (
        <button type="button" className="button" aria-haspopup="dialog" onClick={() => create.current?.showModal()}>
          <Icon name="plus" />
          Create
        </button>
      )}
      <button type="button" className="button ghost filter-button" aria-haspopup="dialog" onClick={() => filters.current?.showModal()}>
        <Icon name="filter" />
        <span className="filter-label">Filters</span>
        {active > 0 && <span className="badge">{active}</span>}
      </button>

      <dialog ref={filters} className="modal" aria-labelledby="cfilters-title" onClick={(e) => { if (e.target === filters.current) filters.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id="cfilters-title">Filters</h2>
          <button type="button" className="icon-button" onClick={() => filters.current?.close()} aria-label="Close filters">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <fieldset className="choice-group">
            <legend>Sort by</legend>
            <div className="chip-row">
              {SORTS.map(([v, l]) => (
                <button key={v} type="button" className="chip" aria-pressed={sort === v} onClick={() => go({ sort: v })}>{l}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="choice-group">
            <legend>Show</legend>
            <div className="chip-row">
              {SHOWS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className="chip"
                  aria-pressed={show === o.value}
                  onClick={() => {
                    if (o.members && !signedIn) { filters.current?.close(); openSignIn(); return; }
                    go({ show: o.value });
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {!signedIn && <p className="hint">Sign in to see collections picked for you and the ones you follow.</p>}
          </fieldset>
        </div>
        <div className="modal-foot">
          <button type="button" className="button ghost" onClick={() => go({ show: "all", sort: "popular" })} disabled={!active}>Reset</button>
          <button type="button" className="button" onClick={() => filters.current?.close()}>Show collections</button>
        </div>
      </dialog>

      {signedIn && (
        <dialog ref={create} className="modal" aria-labelledby="create-title" onClick={(e) => { if (e.target === create.current) create.current?.close(); }}>
          <div className="modal-head">
            <span className="sheet-handle" aria-hidden="true" />
            <h2 id="create-title">New collection</h2>
            <button type="button" className="icon-button" onClick={() => create.current?.close()} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <form action={createCollection} className="form profile-form" onSubmit={() => setBusy(true)}>
            <div className="modal-body">
              <label className="field">
                Name
                <input name="title" maxLength={80} required placeholder="e.g. Black love on screen" autoComplete="off" />
              </label>
              <p className="hint">It starts private. Add films from any film&rsquo;s Watchlist button, write a description, then make it public when it&rsquo;s ready.</p>
            </div>
            <div className="modal-foot">
              <button type="button" className="button ghost" onClick={() => create.current?.close()}>Cancel</button>
              <button type="submit" className="button" disabled={busy}>{busy ? "Creating…" : "Create"}</button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
