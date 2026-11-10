"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";

type Filter = { name: string; label: string; value: string; options: { value: string; label: string }[] };

/** Reuses the public Films/Directors search and filter visual language. */
export default function AdminBrowserToolbar({ action, query = "", placeholder, filters = [], pageSize = "40" }: {
  action: string; query?: string; placeholder: string; filters?: Filter[]; pageSize?: string;
}) {
  const modal = useRef<HTMLDialogElement>(null);
  const title = useId();
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState(query);
  const active = filters.filter((filter) => filter.value && filter.value !== filter.options[0]?.value);

  useEffect(() => { setTerm(query); }, [query]);
  const go = (text: string) => {
    const p = new URLSearchParams(window.location.search);
    if (text.trim()) p.set("q", text.trim()); else p.delete("q");
    p.delete("page"); p.delete("updated"); p.delete("error");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };
  useEffect(() => {
    if (term.trim() === query) return;
    const timer = window.setTimeout(() => go(term), 350);
    return () => window.clearTimeout(timer);
    // A new query from navigation is reflected by the separate query effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, query, pathname, router]);

  const without = (name: string) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (pageSize !== "40") p.set("limit", pageSize);
    for (const filter of filters) if (filter.name !== name && filter.value) p.set(filter.name, filter.value);
    return `${action}?${p.toString()}`;
  };

  return (
    <div className="admin-browser-tools browser">
      <div className="toolbar catalog-toolbar">
        <form action={action} method="get" role="search" className="catalog-search-control" onSubmit={(e) => { e.preventDefault(); go(term); }}>
          <div className="search-bar">
            <Icon name="search" />
            <label className="visually-hidden" htmlFor={title + "-search"}>{placeholder}</label>
            <input type="search" name="q" id={title + "-search"} autoComplete="off" value={term} onChange={(e) => setTerm(e.currentTarget.value)} placeholder={placeholder} maxLength={100} />
            {term && <button type="button" className="catalog-clear-query" aria-label="Clear search" onClick={() => { setTerm(""); go(""); }}><Icon name="close" /></button>}
          </div>
        </form>
        {filters.length > 0 && <button type="button" className={`button ghost filter-button${active.length ? " has-count" : ""}`} aria-haspopup="dialog" onClick={() => modal.current?.showModal()}>
          <Icon name="filter" /><span className="filter-label">Filters</span>{active.length > 0 && <span className="badge" aria-label={`${active.length} active filters`}>{active.length}</span>}
        </button>}
      </div>
      {active.length > 0 && <ul className="chip-list catalog-active-filters" aria-label="Active filters">
        {active.map((filter) => <li key={filter.name}><Link className="chip" href={without(filter.name)} aria-label={`Remove ${filter.label} filter`}>
          {filter.options.find((option) => option.value === filter.value)?.label ?? filter.value}<Icon name="close" className="x" />
        </Link></li>)}
        <li><Link className="link-button" href={`${action}?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(pageSize !== "40" ? { limit: pageSize } : {}) })}`}>Clear filters</Link></li>
      </ul>}
      {filters.length > 0 && <dialog ref={modal} className="modal catalog-filter-dialog" aria-labelledby={title} onClick={(e) => { if (e.target === modal.current) modal.current?.close(); }}>
        <div className="modal-head"><span className="sheet-handle" aria-hidden="true" /><h2 id={title}>Filters</h2><button type="button" className="icon-button" aria-label="Close filters" onClick={() => modal.current?.close()}><Icon name="close" /></button></div>
        <form action={action} method="get" className="admin-filter-form">
          <input type="hidden" name="q" value={term} />
          {pageSize !== "40" && <input type="hidden" name="limit" value={pageSize} />}
          <div className="modal-body">
            {filters.map((filter) => <label className="field filter-field" key={filter.name}>{filter.label}
              <select aria-label={filter.label} className={filter.name === "sort" ? "primary-select" : undefined} name={filter.name} defaultValue={filter.value} key={filter.name + ":" + filter.value}>
                {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>)}
          </div>
          <div className="modal-foot">
            <Link className="button ghost" href={`${action}?${new URLSearchParams({ ...(term ? { q: term } : {}), ...(pageSize !== "40" ? { limit: pageSize } : {}) })}`} onClick={() => modal.current?.close()}>Reset</Link>
            <button className="button" type="submit">Show results</button>
          </div>
        </form>
      </dialog>}
    </div>
  );
}
