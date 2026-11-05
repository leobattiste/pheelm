"use client";

import { useEffect, useRef, useState } from "react";

type Tab = { id: string; label: string; count?: number; content: React.ReactNode };

/**
 * Tabs for long pages. Every panel is in the page (for search engines and find-in-page);
 * only the chosen one shows. The address remembers the tab, so a link can open on it.
 */
export default function Tabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (tabs.some((t) => t.id === fromHash)) setActive(fromHash);
  }, [tabs]);

  const choose = (id: string, focus = false) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
    if (focus) list.current?.querySelector<HTMLButtonElement>(`#tab-${id}`)?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    if (e.key === "ArrowRight") choose(tabs[(i + 1) % tabs.length].id, true);
    if (e.key === "ArrowLeft") choose(tabs[(i - 1 + tabs.length) % tabs.length].id, true);
  };

  return (
    <div className="tabs-wrap">
      <div className="tab-list" role="tablist" aria-label={label} ref={list} onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => choose(t.id)}
          >
            {t.label}
            {t.count !== undefined && <span className="count">{t.count}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="tab-panel">
          {t.content}
        </div>
      ))}
    </div>
  );
}
