"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SITE_NAME } from "@/lib/site";
import AccountLink from "./AccountLink";
import { openSearch } from "./Search";
import ThemeToggle from "./ThemeToggle";
import UpdatesDot from "./UpdatesDot";

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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  const current = (href: string) => (pathname === href || pathname.startsWith(href + "/") ? "page" : undefined);

  // Close the menu when the page changes.
  useEffect(() => {
    menu.current?.close();
  }, [pathname]);

  // Over a full-bleed opening the header is see-through until the page scrolls.
  useEffect(() => {
    const root = document.documentElement;
    const onScroll = () => root.toggleAttribute("data-scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const toggle = () => {
    if (menu.current?.open) menu.current.close();
    else {
      menu.current?.showModal();
      setOpen(true);
    }
  };

  return (
    <header className="site-header">
      <Link href="/" className="wordmark">{SITE_NAME}</Link>
      <nav className="header-nav" aria-label="Sections">
        {MAIN.map((l) => (
          <Link key={l.href} href={l.href} aria-current={current(l.href)}>{l.label}</Link>
        ))}
      </nav>
      <div className="header-tools">
        <button type="button" className="icon-button search-trigger" onClick={openSearch} aria-label="Search">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4 4" /></svg>
          <span className="search-trigger-label">Search</span>
          <kbd>⌘K</kbd>
        </button>
        <Link href="/me" className="header-link" aria-current={current("/me")}>Watchlist<UpdatesDot /></Link>
        <span className="header-link"><AccountLink /></span>
        <button type="button" className="icon-button menu-button" aria-expanded={open} aria-controls="menu" aria-label={open ? "Close menu" : "Open menu"} onClick={toggle}>
          <span className="burger" aria-hidden="true"><span /><span /></span>
          <UpdatesDot />
        </button>
      </div>

      <dialog
        ref={menu}
        id="menu"
        className="menu-sheet"
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === menu.current) menu.current?.close(); }}
      >
        <div className="menu-inner">
          <div className="menu-top">
            <Link href="/" className="wordmark">{SITE_NAME}</Link>
            <button type="button" className="icon-button" onClick={() => menu.current?.close()} aria-label="Close menu">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
            </button>
          </div>
          <nav className="menu-main" aria-label="Sections">
            {MAIN.map((l) => (
              <Link key={l.href} href={l.href} aria-current={current(l.href)}>{l.label}</Link>
            ))}
          </nav>
          <nav className="menu-more" aria-label="Your account">
            {MORE.map((l) => (
              <Link key={l.href} href={l.href} aria-current={current(l.href)}>
                {l.label}
                {l.href === "/me" && <UpdatesDot />}
              </Link>
            ))}
            <AccountLink />
          </nav>
          <div className="menu-foot">
            <span>Appearance</span>
            <ThemeToggle />
          </div>
        </div>
      </dialog>
    </header>
  );
}
