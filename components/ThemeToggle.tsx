"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** The theme on screen: the one picked, or the device's until something is picked. */
const current = (): Theme => {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // Every toggle on the page (menu and footer) stays in step, and follows the device until picked.
  useEffect(() => {
    const read = () => setTheme(current());
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    window.addEventListener("themechange", read);
    return () => {
      mq.removeEventListener("change", read);
      window.removeEventListener("themechange", read);
    };
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem("theme", t);
    } catch {}
    document.documentElement.dataset.theme = t;
    window.dispatchEvent(new Event("themechange"));
  };

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={theme === o.value} onClick={() => choose(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
