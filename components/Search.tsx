"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initials, posterColours } from "@/lib/format";

type FilmHit = { s: string; t: string; o: string | null; y: number; d: string[]; p: string | null };
type DirectorHit = { s: string; n: string; c: string | null; f: number; p: string | null };
type CollectionHit = { s: string; t: string; n: number };
type Index = { films: FilmHit[]; directors: DirectorHit[]; collections?: CollectionHit[] };
type Hit = { kind: "film"; item: FilmHit } | { kind: "director"; item: DirectorHit } | { kind: "collection"; item: CollectionHit };
const GROUP_LABELS = { director: "Directors", film: "Films", collection: "Collections" } as const;
const hrefOf = (h: Hit) => (h.kind === "film" ? `/films/${h.item.s}` : h.kind === "director" ? `/directors/${h.item.s}` : `/collections/${h.item.s}`);

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

let cached: Promise<Index> | null = null;
const loadIndex = () => (cached ??= fetch("/search-index").then((r) => r.json()));

/** Opens the search panel from anywhere: buttons dispatch this event. */
export const openSearch = () => window.dispatchEvent(new Event("open-search"));

/**
 * Instant search over films and directors. Opens with ⌘K, Ctrl+K or "/", and from the
 * search buttons in the header and tab bar.
 */
export default function Search() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState<Index | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const open = useCallback(() => {
    loadIndex().then(setIndex).catch(() => (cached = null));
    if (!dialog.current?.open) dialog.current?.showModal();
    requestAnimationFrame(() => input.current?.select());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-search", open);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-search", open);
    };
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    if (!index) return [];
    const term = plain(q.trim());
    if (!term) return index.films.slice(0, 6).map((item) => ({ kind: "film" as const, item }));
    const words = term.split(/\s+/);
    const match = (text: string) => words.every((w) => text.includes(w));
    const directors = index.directors.filter((d) => match(plain(d.n))).slice(0, 4);
    const films = index.films
      .filter((f) => match(plain(`${f.t} ${f.o ?? ""} ${f.d.join(" ")} ${f.y}`)))
      .sort((a, b) => Number(plain(b.t).startsWith(term)) - Number(plain(a.t).startsWith(term)))
      .slice(0, 8);
    const collections = (index.collections ?? []).filter((c) => match(plain(c.t))).slice(0, 3);
    return [
      ...directors.map((item) => ({ kind: "director" as const, item })),
      ...films.map((item) => ({ kind: "film" as const, item })),
      ...collections.map((item) => ({ kind: "collection" as const, item })),
    ];
  }, [index, q]);

  useEffect(() => setActive(0), [q]);

  const go = (hit: Hit) => {
    dialog.current?.close();
    setQ("");
    router.push(hrefOf(hit));
  };

  return (
    <dialog
      ref={dialog}
      className="search-dialog"
      aria-label="Search"
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close();
      }}
    >
      <div className="search-panel">
        <div className="search-field">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4 4" /></svg>
          <input
            ref={input}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search films and directors"
            aria-label="Search films and directors"
            aria-controls="search-results"
            aria-activedescendant={hits[active] ? `hit-${active}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter" && hits[active]) { e.preventDefault(); go(hits[active]); }
            }}
          />
          <button type="button" className="search-close" onClick={() => dialog.current?.close()}>Close</button>
        </div>
        {!index ? (
          <p className="search-note">Loading…</p>
        ) : hits.length ? (
          <>
            {!q.trim() && <p className="search-note">Recent films</p>}
            <ul id="search-results" role="listbox" className="search-results">
              {hits.map((h, i) => (
                <li key={h.kind + h.item.s} id={`hit-${i}`} role="option" aria-selected={i === active}>
                  {q.trim() && (i === 0 || hits[i - 1].kind !== h.kind) && <p className="search-group" aria-hidden="true">{GROUP_LABELS[h.kind]}</p>}
                  <button type="button" onClick={() => go(h)} onMouseEnter={() => setActive(i)}>
                    {h.kind === "film" ? (
                      <>
                        {h.item.p ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={h.item.p.replace("/w500/", "/w92/")} alt="" className="hit-poster" />
                        ) : (
                          <span className="hit-poster" style={{ background: posterColours(h.item.t).bg }} />
                        )}
                        <span className="hit-text">
                          <span className="hit-title">{h.item.t}</span>
                          <span className="hit-meta">{h.item.d.join(" and ")}, {h.item.y}</span>
                        </span>
                      </>
                    ) : h.kind === "collection" ? (
                      <>
                        <span className="hit-portrait" aria-hidden="true">
                          <svg viewBox="0 0 20 20"><path d="M4 5.5h9v11H4zM7 3.5h9v11" /></svg>
                        </span>
                        <span className="hit-text">
                          <span className="hit-title">{h.item.t}</span>
                          <span className="hit-meta">Collection, {h.item.n} films</span>
                        </span>
                      </>
                    ) : (
                      <>
                        {h.item.p ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={h.item.p} alt="" className="hit-portrait" />
                        ) : (
                          <span className="hit-portrait">{initials(h.item.n)}</span>
                        )}
                        <span className="hit-text">
                          <span className="hit-title">{h.item.n}</span>
                          <span className="hit-meta">Director{h.item.c ? `, ${h.item.c}` : ""}, {h.item.f} {h.item.f === 1 ? "film" : "films"}</span>
                        </span>
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="search-note">Nothing matches &ldquo;{q}&rdquo;. Try a director&rsquo;s surname, or <a href="/submit">suggest the film</a>.</p>
        )}
        <div className="search-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> Move</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>esc</kbd> Close</span>
        </div>
      </div>
    </dialog>
  );
}
