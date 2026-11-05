"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SITE_NAME } from "@/lib/site";
import AccountLink from "./AccountLink";
import ThemeToggle from "./ThemeToggle";

const MAIN = [
  { href: "/films", label: "Films" },
  { href: "/directors", label: "Directors" },
  { href: "/collections", label: "Collections" },
  { href: "/journal", label: "Journal" },
];

const MORE = [
  { href: "/me", label: "Watchlist" },
  { href: "/submit", label: "Submit a film" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const current = (href: string) => (pathname === href || pathname.startsWith(href + "/") ? "page" : undefined);

  return (
    <header className="site-header">
      <div className="header-bar" ref={wrap}>
        <Link href="/" className="wordmark">
          {SITE_NAME}
        </Link>
        <nav className="header-nav" aria-label="Sections">
          {MAIN.map((l) => (
            <Link key={l.href} href={l.href} aria-current={current(l.href)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <button type="button" className="menu-button" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(!open)}>
            <span className="burger" aria-hidden="true">
              <span />
              <span />
            </span>
            <span className="menu-label">{open ? "Close" : "Menu"}</span>
          </button>
          <nav id="menu" className="menu-sheet" aria-label="Main" hidden={!open}>
            <div className="menu-main">
              {MAIN.map((l) => (
                <Link key={l.href} href={l.href} aria-current={current(l.href)}>
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="menu-more">
              {MORE.map((l) => (
                <Link key={l.href} href={l.href} aria-current={current(l.href)}>
                  {l.label}
                </Link>
              ))}
              <AccountLink />
            </div>
            <div className="menu-theme">
              <span>Appearance</span>
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
