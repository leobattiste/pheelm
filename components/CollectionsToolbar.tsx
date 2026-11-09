"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { SORTS, type Sort } from "@/lib/collection-sorts";
import Icon from "./Icon";
import { openSignIn } from "./SignInSheet";

export type Feed = "all" | "featured" | "following";
export const FEEDS: { value: Feed; label: string }[] = [
  { value: "all", label: "All" },
  { value: "featured", label: "Featured" },
  { value: "following", label: "Following" },
];

/** The Collections page's bar: the feed (All, Featured, Following) and a sheet to sort it. */
export default function CollectionsToolbar({ signedIn, feed, sort }: { signedIn: boolean; feed: Feed; sort: Sort }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const sheet = useRef<HTMLDialogElement>(null);

  const go = (next: { feed?: Feed; sort?: Sort }) => {
    const p = new URLSearchParams(params.toString());
    const f = next.feed ?? feed;
    const o = next.sort ?? sort;
    if (f === "all") p.delete("feed"); else p.set("feed", f);
    if (o === "popular") p.delete("sort"); else p.set("sort", o);
    p.delete("show");
    const q = p.toString();
    router.replace(q ? `${path}?${q}` : path, { scroll: false });
  };

  return (
    <div className="toolbar collections-toolbar">
      <div className="feed-tabs" role="group" aria-label="Collections to show">
        {FEEDS.map((o) => (
          <button
            key={o.value}
            type="button"
            className="chip"
            aria-pressed={feed === o.value}
            onClick={() => {
              if (o.value === "following" && !signedIn) { openSignIn("signup"); return; }
              go({ feed: o.value });
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <button type="button" className="button ghost filter-button" aria-haspopup="dialog" onClick={() => sheet.current?.showModal()}>
        <Icon name="sort" />
        <span className="filter-label">{SORTS.find(([v]) => v === sort)?.[1] ?? "Sort"}</span>
      </button>

      <dialog ref={sheet} className="modal" aria-labelledby="csort-title" onClick={(e) => { if (e.target === sheet.current) sheet.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id="csort-title">Sort by</h2>
          <button type="button" className="icon-button" onClick={() => sheet.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <div className="chip-row" role="group" aria-label="Sort by">
            {SORTS.map(([v, l]) => (
              <button key={v} type="button" className="chip" aria-pressed={sort === v} onClick={() => { go({ sort: v }); sheet.current?.close(); }}>{l}</button>
            ))}
          </div>
        </div>
      </dialog>
    </div>
  );
}
