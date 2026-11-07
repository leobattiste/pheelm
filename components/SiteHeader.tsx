"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DONATE_URL, SITE_NAME, WORDMARK } from "@/lib/site";
import AccountMenu from "./AccountMenu";
import FeedbackLink from "./FeedbackLink";
import Icon, { type IconName } from "./Icon";
import SignInSheet from "./SignInSheet";
import { openSearch } from "./Search";
import GridToggle from "./GridToggle";
import ThemeToggle from "./ThemeToggle";

const MAIN: { href: string; label: string; icon: IconName }[] = [
  { href: "/films", label: "Films", icon: "film" },
  { href: "/collections", label: "Collections", icon: "stack" },
  { href: "/directors", label: "Directors", icon: "clapper" },
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

  const toggle = () => {
    if (menu.current?.open) menu.current.close();
    else {
      menu.current?.showModal();
      setOpen(true);
    }
  };

  return (
    <header className="site-header">
      <Link href="/" className="wordmark wordmark-type" aria-label={`${SITE_NAME}, home`}>{WORDMARK}</Link>
      <div className="header-tools">
        {/* A film at random. A plain link, so each press picks again. */}
        <a href="/random" className="icon-button random-trigger" aria-label="Random film" title="Random film" rel="nofollow">
          <Icon name="shuffle" />
        </a>
        <button type="button" className="icon-button search-trigger" onClick={openSearch} aria-label="Search">
          <Icon name="search" />
          <span className="search-trigger-label">Search</span>
          <kbd>⌘K</kbd>
        </button>
        <button type="button" className="icon-button menu-button" aria-expanded={open} aria-controls="menu" aria-label={open ? "Close menu" : "Open menu"} onClick={toggle}>
          <span className="burger" aria-hidden="true"><span /><span /></span>
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
        {/* Focus lands on the menu itself when it opens, so no link shows a focus ring. */}
        <div className="menu-inner" tabIndex={-1} autoFocus>
          <div className="menu-top">
            <Link href="/" className="wordmark wordmark-type" aria-label={`${SITE_NAME}, home`}>{WORDMARK}</Link>
            <button type="button" className="icon-button" onClick={() => menu.current?.close()} aria-label="Close menu">
              <Icon name="close" />
            </button>
          </div>
          <nav className="menu-main" aria-label="Sections">
            {MAIN.map((l) => (
              <Link key={l.href} href={l.href} aria-current={current(l.href)}><Icon name={l.icon} />{l.label}</Link>
            ))}
          </nav>
          <AccountMenu onNavigate={() => menu.current?.close()} />
          <nav className="menu-more menu-support" aria-label="Support Pheelm">
            {DONATE_URL ? (
              <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" onClick={() => menu.current?.close()}><Icon name="heart" />Donate</a>
            ) : (
              <Link href="/donate" aria-current={current("/donate")}><Icon name="heart" />Donate</Link>
            )}
            <Link href="/submit" aria-current={current("/submit")}><Icon name="plus" />Suggest a film</Link>
            <FeedbackLink className="" onNavigate={() => menu.current?.close()}><Icon name="comment" />Give feedback</FeedbackLink>
          </nav>
          <div className="menu-foot">
            <div className="menu-setting">
              <span>Grid</span>
              <GridToggle />
            </div>
            <div className="menu-setting">
              <span>Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </dialog>
      <SignInSheet />
    </header>
  );
}
