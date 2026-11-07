"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

type Filter = { name: string; label: string; value: string; options: { value: string; label: string }[] };

/** The public browsers' search bar and filter sheet, using server-side GET filters. */
export default function AdminBrowserToolbar({ action, query = "", placeholder, filters = [] }: {
  action: string; query?: string; placeholder: string; filters?: Filter[];
}) {
  const modal = useRef<HTMLDialogElement>(null);
  const title = useId();
  const active = filters.filter(f => f.value && f.value !== f.options[0]?.value);
  const without = (name: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    for (const f of filters) if (f.name !== name && f.value) params.set(f.name, f.value);
    return `${action}?${params}`;
  };
  return (
    <div className="admin-browser-tools">
      <form action={action} method="get" className="toolbar" role="search">
        <label className="search-bar"><Icon name="search" /><span className="visually-hidden">{placeholder}</span>
          <input type="search" name="q" defaultValue={query} placeholder={placeholder} />
        </label>
        {filters.map(f => <input key={f.name} type="hidden" name={f.name} value={f.value} />)}
        <button type="submit" className="icon-button" aria-label="Search"><Icon name="arrowRight" /></button>
        {!!filters.length && <button type="button" className="button ghost filter-button" aria-haspopup="dialog" onClick={() => modal.current?.showModal()}>
          <Icon name="filter" /><span className="filter-label">Filters</span>{!!active.length && <span className="badge">{active.length}</span>}
        </button>}
      </form>
      {!!active.length && <ul className="chip-list admin-active-filters">
        {active.map(f => <li key={f.name}><Link className="chip" href={without(f.name)} aria-label={`Remove ${f.label.toLowerCase()} filter`}>
          {f.options.find(o => o.value === f.value)?.label ?? f.value}<Icon name="close" className="x" />
        </Link></li>)}
        <li><Link className="link-button" href={`${action}${query ? `?q=${encodeURIComponent(query)}` : ""}`}>Clear filters</Link></li>
      </ul>}
      {!!filters.length && <dialog ref={modal} className="modal" aria-labelledby={title} onClick={e => { if (e.target === modal.current) modal.current?.close(); }}>
        <div className="modal-head"><span className="sheet-handle" aria-hidden="true" /><h2 id={title}>Filters</h2>
          <button type="button" className="icon-button" aria-label="Close filters" onClick={() => modal.current?.close()}><Icon name="close" /></button>
        </div>
        <form action={action} method="get" className="admin-filter-form">
          <input type="hidden" name="q" value={query} />
          <div className="modal-body">{filters.map(f => <label key={f.name} className="field filter-field">{f.label}
            <select name={f.name} defaultValue={f.value}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </label>)}</div>
          <div className="modal-foot"><Link className="button ghost" href={`${action}${query ? `?q=${encodeURIComponent(query)}` : ""}`}>Reset</Link><button className="button" type="submit">Show results</button></div>
        </form>
      </dialog>}
    </div>
  );
}
