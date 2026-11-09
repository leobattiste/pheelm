"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { SORTS, FEEDS, collectionsHref, type Feed, type Sort } from "@/lib/collection-sorts";
import Icon from "./Icon";
import { openSignIn } from "./SignInSheet";

export type { Feed } from "@/lib/collection-sorts";

/** The Collections page's bar: the feed (All, Featured, Following) and a sheet to sort it. */
export default function CollectionsToolbar({ signedIn, feed, sort }: { signedIn: boolean; feed: Feed; sort: Sort }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const sheet = useRef<HTMLDialogElement>(null);

  const feedTabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedTabs.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [feed]);
  const href = (next: { feed?: Feed; sort?: Sort }) => collectionsHref(path, params.toString(), { feed: next.feed ?? feed, sort: next.sort ?? sort });
  const go = (next: { sort: Sort }) => router.push(href(next), { scroll: false });

  return (
    <div className="toolbar collections-toolbar">
      <div className="feed-tabs" ref={feedTabs} role="navigation" aria-label="Collections to show">
        {FEEDS.map((o) => (
          <Link
            key={o.value}
            href={href({ feed: o.value })}
            className="chip"
            aria-current={feed === o.value ? "page" : undefined}
            scroll={false}
            onClick={(event) => {
              if (o.value === "following" && !signedIn && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                if (openSignIn("signin")) event.preventDefault();
                else { event.preventDefault(); router.push(`/login?next=${encodeURIComponent(href({ feed: o.value }))}`); }
              }
            }}
          >
            {o.label}
          </Link>
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
