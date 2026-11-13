"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

/**
 * Less-used actions behind one ⋯ button (or a labelled button), so each page shows a single main
 * action. Closes on a click outside, on Escape and when the page changes.
 */
export default function AdminMenu({ label = "More actions", text, align = "right", children }: { label?: string; text?: ReactNode; align?: "left" | "right"; children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => { if (menu.current) menu.current.open = false; }, [path]);
  useEffect(() => {
    const close = (e: Event) => {
      const el = menu.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);
  return (
    <details ref={menu} className={`admin-menu is-${align}`}>
      <summary className={text ? "button ghost" : "button ghost icon-only"} aria-label={label} title={label}>
        {text ? <span className="admin-menu-text">{text}</span> : <Icon name="more" />}{text && <Icon name="arrowDown" />}
      </summary>
      <div className="admin-menu-list" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) menu.current!.open = false; }}>{children}</div>
    </details>
  );
}
