"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

/**
 * Less-used actions behind one ⋯ button (or a labelled button), so each page shows a single main
 * action. Closes on a click outside, on its X (as a sheet on phones), on Escape and when the page changes.
 */
export default function AdminMenu({ label = "More actions", text, align = "right", children }: { label?: string; text?: ReactNode; align?: "left" | "right"; children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => { if (menu.current) menu.current.open = false; }, [path]);
  useEffect(() => {
    const close = (e: Event) => {
      const el = menu.current;
      if (!el?.open) return;
      // On phones the menu opens as a sheet over a dimmed backdrop. The backdrop belongs to the menu
      // (it is drawn by the menu itself), so a tap on it lands on the menu element: that closes too.
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node) || e.target === el) el.open = false;
    };
    // Near the bottom of the screen, open upwards so the whole list stays in view.
    const el = menu.current;
    const place = () => {
      if (!el?.open) return;
      el.classList.remove("is-up");
      const list = el.querySelector<HTMLElement>(".admin-menu-list");
      if (list && list.getBoundingClientRect().bottom > innerHeight - 8 && el.getBoundingClientRect().top > list.offsetHeight + 16) el.classList.add("is-up");
    };
    el?.addEventListener("toggle", place);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { el?.removeEventListener("toggle", place); document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);
  return (
    <details ref={menu} className={`admin-menu is-${align}`}>
      <summary className={text ? "button ghost" : "button ghost icon-only"} aria-label={label} title={label}>
        {text ? <span className="admin-menu-text">{text}</span> : <Icon name="more" />}{text && <Icon name="arrowDown" />}
      </summary>
      <div className="admin-menu-list" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) menu.current!.open = false; }}>
        <div className="admin-menu-head">
          <span>{typeof text === "string" ? text : label}</span>
          <button type="button" className="icon-button" aria-label="Close" onClick={() => { if (menu.current) menu.current.open = false; }}><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </details>
  );
}
