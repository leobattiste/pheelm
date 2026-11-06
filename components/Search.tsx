"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initials, posterColours } from "@/lib/format";

type FilmHit = { s: string; t: string; o: string | null; y: number; d: string[]; k?: string[]; p: string | null };
type DirectorHit = { s: string; n: string; c: string | null; f: number; p: string | null };
type PersonHit = { s: string; n: string; r: string; f: number; p: string | null };
type CollectionHit = { s: string; t: string; n: number };
type Index = { films: FilmHit[]; directors: DirectorHit[]; people?: PersonHit[]; collections?: CollectionHit[] };

type Action = { id: string; label: string; hint: string; icon: string; words: string; run: () => void };
type Hit =
  | { kind: "film"; item: FilmHit; via?: string }
  | { kind: "director"; item: DirectorHit }
  | { kind: "person"; item: PersonHit }
  | { kind: "collection"; item: CollectionHit }
  | { kind: "action"; item: Action }
  | { kind: "recent"; item: string };

const GROUP_LABELS: Record<Hit["kind"], string> = {
  recent: "Recent searches",
  action: "Quick actions",
  director: "Directors",
  film: "Films",
  person: "Cast and crew",
  collection: "Collections",
};

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const RECENT_KEY = "recent-searches";

let cached: Promise<Index> | null = null;
const loadIndex = () => (cached ??= fetch("/search-index").then((r) => r.json()));

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}
function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {}
}

/** Opens the search panel from anywhere: buttons dispatch this event. */
export const openSearch = () => window.dispatchEvent(new Event("open-search"));

/**
 * Instant search over films, directors, cast and crew, and collections, with recent searches
 * and quick actions when the box is empty. Opens with ⌘K, Ctrl+K or "/".
 */
export default function Search() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState<Index | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  const open = useCallback(() => {
    loadIndex().then(setIndex).catch(() => (cached = null));
    setRecent(readRecent());
    if (!dialog.current?.open) dialog.current?.showModal();
    requestAnimationFrame(() => input.current?.select());
  }, []);
  const close = () => dialog.current?.close();

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

  const navigate = (href: string) => {
    close();
    setQ("");
    router.push(href);
  };

  const actions = useMemo<Action[]>(() => {
    const isDark = () => document.documentElement.dataset.theme !== "light";
    return [
      {
        id: "random", label: "Random film", hint: "Surprise me", icon: "M3 7h3.5c2.5 0 3.7 1.2 5 3.5l1 1.8c1.3 2.3 2.5 3.7 5 3.7H21M3 17h3.5c1.5 0 2.5-.5 3.4-1.4M14.1 8.4c.9-.9 1.9-1.4 3.4-1.4H21M18 4l3 3-3 3M18 14l3 3-3 3",
        words: "random shuffle surprise lucky",
        run: () => {
          const films = index?.films ?? [];
          if (films.length) navigate(`/films/${films[Math.floor(Math.random() * films.length)].s}`);
        },
      },
      { id: "watchlist", label: "Go to my watchlist", hint: "All and your collections", icon: "M6 3.5h8v13l-4-3-4 3z", words: "watchlist saved my films account collections", run: () => navigate("/me") },
      { id: "films", label: "Browse all films", hint: "Filter by decade, country, genre", icon: "M3.5 5h13v10h-13zM3.5 8.5h13M7 5v3.5M13 5v3.5", words: "films browse all filter", run: () => navigate("/films") },
      { id: "directors", label: "Browse directors", hint: "By country and era, or on a map", icon: "M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c.6-3.2 3-5 6-5s5.4 1.8 6 5", words: "directors map country", run: () => navigate("/directors") },
      { id: "collections", label: "Browse collections", hint: "Movements, themes and more", icon: "M4 5.5h9v11H4zM7 3.5h9v11", words: "collections movements themes", run: () => navigate("/collections") },
      {
        id: "theme", label: "Switch light or dark mode", hint: "Appearance", icon: "M10 3a7 7 0 1 0 7 7 5.5 5.5 0 0 1-7-7z",
        words: "theme dark light mode appearance",
        run: () => {
          const next = isDark() ? "light" : "dark";
          document.documentElement.dataset.theme = next;
          try {
            localStorage.setItem("theme", next);
          } catch {}
          window.dispatchEvent(new Event("themechange"));
          close();
        },
      },
      { id: "submit", label: "Submit a film", hint: "Suggest something we're missing", icon: "M10 4v12M4 10h12", words: "submit suggest add missing", run: () => navigate("/submit") },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const hits = useMemo<Hit[]>(() => {
    const term = plain(q.trim());
    if (!term) {
      return [
        ...recent.map((item) => ({ kind: "recent" as const, item })),
        ...actions.map((item) => ({ kind: "action" as const, item })),
      ];
    }
    if (!index) return [];
    const words = term.split(/\s+/);
    const match = (text: string) => words.every((w) => text.includes(w));

    const directors = index.directors.filter((d) => match(plain(d.n))).slice(0, 4);
    const people = (index.people ?? []).filter((p) => match(plain(p.n))).sort((a, b) => b.f - a.f).slice(0, 4);
    const films: { item: FilmHit; via?: string }[] = [];
    for (const f of index.films) {
      if (match(plain(`${f.t} ${f.o ?? ""} ${f.d.join(" ")} ${f.y}`))) films.push({ item: f });
      else {
        // Found through someone in the cast or crew: say who.
        const who = (f.k ?? []).find((n) => match(plain(n)));
        if (who) films.push({ item: f, via: who });
      }
    }
    films.sort((a, b) => Number(!!a.via) - Number(!!b.via) || Number(plain(b.item.t).startsWith(term)) - Number(plain(a.item.t).startsWith(term)));
    const collections = (index.collections ?? []).filter((c) => match(plain(c.t))).slice(0, 3);
    const matchedActions = actions.filter((a) => match(plain(`${a.label} ${a.words}`))).slice(0, 2);

    return [
      ...directors.map((item) => ({ kind: "director" as const, item })),
      ...films.slice(0, 8).map(({ item, via }) => ({ kind: "film" as const, item, via })),
      ...people.map((item) => ({ kind: "person" as const, item })),
      ...collections.map((item) => ({ kind: "collection" as const, item })),
      ...matchedActions.map((item) => ({ kind: "action" as const, item })),
    ];
  }, [index, q, recent, actions]);

  useEffect(() => setActive(0), [q]);

  const remember = () => {
    const term = q.trim();
    if (!term) return;
    const next = [term, ...recent.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(0, 5);
    setRecent(next);
    saveRecent(next);
  };

  const go = (hit: Hit) => {
    if (hit.kind === "recent") {
      setQ(hit.item);
      input.current?.focus();
      return;
    }
    if (hit.kind === "action") {
      hit.item.run();
      return;
    }
    remember();
    const href =
      hit.kind === "film" ? `/films/${hit.item.s}`
      : hit.kind === "director" ? `/directors/${hit.item.s}`
      : hit.kind === "person" ? `/people/${hit.item.s}`
      : `/collections/${hit.item.s}`;
    navigate(href);
  };

  const clearRecent = () => {
    setRecent([]);
    saveRecent([]);
  };

  return (
    <dialog ref={dialog} className="search-dialog" aria-label="Search" onClick={(e) => { if (e.target === dialog.current) close(); }}>
      <div className="search-panel">
        <div className="search-field">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4 4" /></svg>
          <input
            ref={input}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search films, directors and cast"
            aria-label="Search films, directors, cast and crew"
            aria-controls="search-results"
            aria-activedescendant={hits[active] ? `hit-${active}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter" && hits[active]) { e.preventDefault(); go(hits[active]); }
            }}
          />
          <button type="button" className="search-close" onClick={close}>Close</button>
        </div>

        {q.trim() && !index ? (
          <p className="search-note">Loading…</p>
        ) : hits.length ? (
          <ul id="search-results" role="listbox" className="search-results">
            {hits.map((h, i) => (
              <li key={`${h.kind}-${typeof h.item === "string" ? h.item : "s" in h.item ? h.item.s : h.item.id}`} id={`hit-${i}`} role="option" aria-selected={i === active}>
                {(i === 0 || hits[i - 1].kind !== h.kind) && (
                  <p className="search-group">
                    <span>{GROUP_LABELS[h.kind]}</span>
                    {h.kind === "recent" && <button type="button" className="link-button" onClick={clearRecent}>Clear</button>}
                  </p>
                )}
                <button type="button" onClick={() => go(h)} onMouseEnter={() => setActive(i)}>
                  <HitRow hit={h} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="search-note">Nothing matches &ldquo;{q}&rdquo;. Try a surname, or <a href="/submit">suggest the film</a>.</p>
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

function Icon({ d }: { d: string }) {
  return (
    <span className="hit-portrait" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d={d} /></svg>
    </span>
  );
}

function HitRow({ hit }: { hit: Hit }) {
  switch (hit.kind) {
    case "recent":
      return (
        <>
          <Icon d="M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" />
          <span className="hit-text"><span className="hit-title">{hit.item}</span></span>
        </>
      );
    case "action":
      return (
        <>
          <Icon d={hit.item.icon} />
          <span className="hit-text">
            <span className="hit-title">{hit.item.label}</span>
            <span className="hit-meta">{hit.item.hint}</span>
          </span>
        </>
      );
    case "film":
      return (
        <>
          {hit.item.p ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hit.item.p.replace(/\/t\/p\/[^/]+\//, "/t/p/w92/")} alt="" className="hit-poster" />
          ) : (
            <span className="hit-poster" style={{ background: posterColours(hit.item.t).bg }} />
          )}
          <span className="hit-text">
            <span className="hit-title">{hit.item.t}</span>
            <span className="hit-meta">
              {hit.item.d.join(" and ")} • {hit.item.y}
              {hit.via && <> • with {hit.via}</>}
            </span>
          </span>
        </>
      );
    case "collection":
      return (
        <>
          <Icon d="M4 5.5h9v11H4zM7 3.5h9v11" />
          <span className="hit-text">
            <span className="hit-title">{hit.item.t}</span>
            <span className="hit-meta">Collection, {hit.item.n} films</span>
          </span>
        </>
      );
    default: {
      const p = hit.item as DirectorHit | PersonHit;
      const meta =
        hit.kind === "director"
          ? `Director${(p as DirectorHit).c ? `, ${(p as DirectorHit).c}` : ""}, ${p.f} ${p.f === 1 ? "film" : "films"}`
          : `${(p as PersonHit).r}, ${p.f} ${p.f === 1 ? "film" : "films"}`;
      return (
        <>
          {p.p ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.p} alt="" className="hit-portrait" />
          ) : (
            <span className="hit-portrait">{initials(p.n)}</span>
          )}
          <span className="hit-text">
            <span className="hit-title">{p.n}</span>
            <span className="hit-meta">{meta}</span>
          </span>
        </>
      );
    }
  }
}
