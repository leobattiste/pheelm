"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Icon from "@/components/Icon";

/**
 * A "⋯" button that opens a small menu of actions. The actions stay mounted while the menu is
 * closed (it's only hidden), so an action that opens a sheet keeps it open after the menu closes.
 * The menu closes on an outside click, Escape, or once an action is pressed.
 */
export default function MoreMenu({ label = "More actions", children, corner = false }: { label?: string; children: ReactNode; corner?: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      // Clicks inside a sheet an action opened don't count as outside.
      if (wrap.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) { setOpen(false); button.current?.focus(); }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    // Focus the first action, as menus do.
    wrap.current?.querySelector<HTMLElement>(".more-panel :is(a, button)")?.focus();
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [open]);

  return (
    <div className={`more-menu${corner ? " is-corner" : ""}`} ref={wrap}>
      <button
        ref={button}
        type="button"
        className="round-button more-button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="more" />
      </button>
      <div
        id={id}
        className="more-panel"
        data-open={open || undefined}
        // Close once an action is pressed (after it has run), unless it was inside a sheet.
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("dialog, [data-keep-menu-open]")) return;
          if (t.closest("a, button")) setTimeout(() => setOpen(false), 0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
