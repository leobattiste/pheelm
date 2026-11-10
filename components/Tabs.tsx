"use client";

import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "./Icon";

/**
 * Tabs for a profile: a row of pills, one panel showing at a time. The open tab is kept in the
 * address (#about), so a link or the back button returns to it. Arrow keys move between tabs.
 */
export default function Tabs({ tabs, showIcons = false }: { showIcons?: boolean; tabs: { id: string; label: string; icon?: IconName; panel: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () => {
      const id = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === id)) setActive(id);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [tabs]);

  const choose = (id: string, focus = false) => {
    setActive(id);
    history.replaceState(null, "", id === tabs[0].id ? window.location.pathname : `#${id}`);
    const button = list.current?.querySelector<HTMLButtonElement>(`#tab-${id}`);
    if (focus) button?.focus({ preventScroll: true });
    if (button && list.current) {
      const item = button.getBoundingClientRect(), strip = list.current.getBoundingClientRect();
      if (item.left < strip.left) list.current.scrollLeft += item.left - strip.left;
      else if (item.right > strip.right) list.current.scrollLeft += item.right - strip.right;
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    choose(tabs[(next + tabs.length) % tabs.length].id, true);
  };

  return (
    <div className="tabs-block">
      <div className="profile-tabs" role="tablist" ref={list} onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            className="chip"
            aria-selected={t.id === active}
            aria-pressed={t.id === active}
            aria-controls={`panel-${t.id}`}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => choose(t.id)}
          >
            {showIcons && t.icon && <Icon name={t.icon} />}
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={t.id !== active} className="tab-panel">
          {t.panel}
        </div>
      ))}
    </div>
  );
}
