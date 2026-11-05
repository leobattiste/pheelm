"use client";

import { useEffect, useState } from "react";

type View = "large" | "small" | "list";

// On desktop: large posters, small posters, list. On phones the same three settings mean
// one poster per row, two per row, and the list.
const DESKTOP: Record<View, { label: string; icon: React.ReactNode }> = {
  large: {
    label: "Large posters",
    icon: <><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></>,
  },
  small: {
    label: "Small posters",
    icon: <>{[3, 8.5, 14].flatMap((y) => [3, 8.5, 14].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="3.5" height="3.5" rx="1" />))}</>,
  },
  list: { label: "List", icon: <>{[4, 9, 14].map((y) => <rect key={y} x="3" y={y} width="14" height="2.2" rx="1.1" />)}</> },
};
const PHONE: Record<View, { label: string; icon: React.ReactNode }> = {
  large: { label: "One per row", icon: <rect x="5" y="2.5" width="10" height="15" rx="2" /> },
  small: { label: "Two per row", icon: <><rect x="2.5" y="4" width="6.5" height="12" rx="1.5" /><rect x="11" y="4" width="6.5" height="12" rx="1.5" /></> },
  list: DESKTOP.list,
};
const ORDER: View[] = ["large", "small", "list"];

/**
 * Sets how posters show everywhere on the site, and remembers it. On phones it lives in the
 * menu (one per row, two per row, list); on desktop it also sits beside each grid.
 */
export default function GridToggle({ inMenu = false }: { inMenu?: boolean }) {
  const [view, setView] = useState<View>("large");

  useEffect(() => {
    const read = () => {
      const v = document.documentElement.dataset.grid;
      setView(v === "small" || v === "list" ? v : "large");
    };
    read();
    // Keep every switch on the page in step.
    window.addEventListener("gridchange", read);
    return () => window.removeEventListener("gridchange", read);
  }, []);

  const choose = (v: View) => {
    setView(v);
    document.documentElement.dataset.grid = v;
    try {
      localStorage.setItem("grid", v);
    } catch {}
    window.dispatchEvent(new Event("gridchange"));
  };

  const set = inMenu ? PHONE : DESKTOP;
  return (
    <div className={`segmented grid-toggle${inMenu ? " in-menu" : ""}`} role="radiogroup" aria-label="How posters show">
      {ORDER.map((v) => (
        <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => choose(v)} title={set[v].label}>
          <svg viewBox="0 0 20 20" aria-hidden="true">{set[v].icon}</svg>
          <span className="visually-hidden">{set[v].label}</span>
        </button>
      ))}
    </div>
  );
}
