"use client";

import { useEffect, useState } from "react";

type View = "large" | "small" | "list";

const VIEWS: { value: View; label: string; icon: React.ReactNode }[] = [
  {
    value: "large",
    label: "Large posters",
    icon: <><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></>,
  },
  {
    value: "small",
    label: "Small posters",
    icon: <>{[3, 8.5, 14].flatMap((y) => [3, 8.5, 14].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="3.5" height="3.5" rx="1" />))}</>,
  },
  {
    value: "list",
    label: "List",
    icon: <>{[4, 9, 14].map((y) => <rect key={y} x="3" y={y} width="14" height="2.2" rx="1.1" />)}</>,
  },
];

/** Switches every film grid between large posters, small posters and a list, and remembers the choice. */
export default function GridToggle() {
  const [view, setView] = useState<View>("large");

  useEffect(() => {
    const v = document.documentElement.dataset.grid;
    setView(v === "small" || v === "list" ? v : "large");
  }, []);

  const choose = (v: View) => {
    setView(v);
    document.documentElement.dataset.grid = v;
    try {
      localStorage.setItem("grid", v);
    } catch {}
  };

  return (
    <div className="segmented" role="radiogroup" aria-label="View">
      {VIEWS.map((v) => (
        <button key={v.value} type="button" role="radio" aria-checked={view === v.value} onClick={() => choose(v.value)} title={v.label}>
          <svg viewBox="0 0 20 20" aria-hidden="true">{v.icon}</svg>
          <span className="visually-hidden">{v.label}</span>
        </button>
      ))}
    </div>
  );
}
