"use client";

import { useEffect, useState } from "react";

type Size = "large" | "small";

/** Switches every film grid between large and small posters, and remembers the choice. */
export default function GridToggle() {
  const [size, setSize] = useState<Size>("large");

  useEffect(() => {
    setSize(document.documentElement.dataset.grid === "small" ? "small" : "large");
  }, []);

  const choose = (s: Size) => {
    setSize(s);
    document.documentElement.dataset.grid = s;
    try {
      localStorage.setItem("grid", s);
    } catch {}
  };

  return (
    <div className="segmented" role="radiogroup" aria-label="Poster size">
      <button type="button" role="radio" aria-checked={size === "large"} onClick={() => choose("large")} title="Large posters">
        <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></svg>
        <span className="visually-hidden">Large</span>
      </button>
      <button type="button" role="radio" aria-checked={size === "small"} onClick={() => choose("small")} title="Small posters">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          {[3, 8.5, 14].flatMap((y) => [3, 8.5, 14].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="3.5" height="3.5" rx="1" />))}
        </svg>
        <span className="visually-hidden">Small</span>
      </button>
    </div>
  );
}
