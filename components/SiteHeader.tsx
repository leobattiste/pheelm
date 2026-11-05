"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SITE_NAME } from "@/lib/site";
import AccountLink from "./AccountLink";
import { openSearch } from "./Search";

const MAIN = [
  { href: "/films", label: "Films", icon: "M3.5 5h13v10h-13zM3.5 8.5h13M7 5v3.5M13 5v3.5" },
  { href: "/directors", label: "Directors", icon: "M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c.6-3.2 3-5 6-5s5.4 1.8 6 5" },
  { href: "/collections", label: "Collections", icon: "M4 5.5h9v11H4zM7 3.5h9v11" },
  { href: "/journal", label: "Journal", icon: "M4.5 4h11v12h-11zM7.5 7.5h5M7.5 10.5h5M7.5 13.5h3" },
];

const SEARCH_ICON = (
  <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4 4" /></svg>
);

export default function SiteHeader() {
  const pathname = usePathname();
  const current = (href: string) => (pathname === href || pathname.startsWith(href + "/") ? "page" : undefined);

  // Over a full-bleed opening the header is see-through until the page scrolls.
  useEffect(() => {
    const root = document.documentElement;
    const onScroll = () => root.toggleAttribute("data-scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <>
      <header className="site-header">
        <Link href="/" className="wordmark">{SITE_NAME}</Link>
        <nav className="header-nav" aria-label="Sections">
          {MAIN.map((l) => (
            <Link key={l.href} href={l.href} aria-current={current(l.href)}>{l.label}</Link>
          ))}
        </nav>
        <div className="header-tools">
          <button type="button" className="search-trigger" onClick={openSearch}>
            {SEARCH_ICON}
            <span className="search-trigger-label">Search films and directors</span>
            <kbd>⌘K</kbd>
          </button>
          <Link href="/me" className="header-link" aria-current={current("/me")}>Watchlist</Link>
          <span className="header-link"><AccountLink /></span>
        </div>
      </header>

      {/* On phones, sections live in a tab bar within thumb reach. */}
      <nav className="tab-bar" aria-label="Sections">
        {MAIN.slice(0, 3).map((l) => (
          <Link key={l.href} href={l.href} aria-current={current(l.href)}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d={l.icon} /></svg>
            {l.label}
          </Link>
        ))}
        <button type="button" onClick={openSearch}>
          {SEARCH_ICON}
          Search
        </button>
        <Link href="/me" aria-current={current("/me")}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3.5h8v13l-4-3-4 3z" /></svg>
          Watchlist
        </Link>
      </nav>
    </>
  );
}
