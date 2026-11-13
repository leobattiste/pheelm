"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DONATE_URL, INSTAGRAM_URL, SITE_NAME, THREADS_URL, WORDMARK } from "@/lib/site";
import AccountMenu from "./AccountMenu";
import FeedbackLink from "./FeedbackLink";
import Icon, { type IconName } from "./Icon";
import SignInSheet, { openSignIn } from "./SignInSheet";

const MAIN: { href: string; label: string; icon: IconName }[] = [
  { href: "/home", label: "Home", icon: "explore" },
  { href: "/films", label: "Films", icon: "film" },
  { href: "/watchlists", label: "Watchlists", icon: "stack" },
  { href: "/directors", label: "Directors", icon: "users2" },
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

  // The ⋯ tab on phones opens this same menu.
  useEffect(() => {
    const open = () => { if (!menu.current?.open) { menu.current?.showModal(); setOpen(true); } };
    window.addEventListener("pheelm:menu", open);
    return () => window.removeEventListener("pheelm:menu", open);
  }, []);

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
      {/* Visitors (early access): just Sign in. Which set shows is decided before paint (data-auth). */}
      <div className="header-tools visitor-only">
        <button type="button" className="header-signin" onClick={(e) => { if (!openSignIn("signin")) location.href = "/login"; (e.currentTarget as HTMLButtonElement).blur(); }}>
          Sign in
        </button>
      </div>
      <div className="header-tools member-only">
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
          <AccountMenu onNavigate={() => menu.current?.close()}>
          <nav className="menu-more menu-support" aria-label="Support Pheelm">
            {DONATE_URL ? (
              <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" onClick={() => menu.current?.close()}><Icon name="heart" />Donate</a>
            ) : (
              <Link href="/donate" aria-current={current("/donate")}><Icon name="heart" />Donate</Link>
            )}
            <Link href="/submit" aria-current={current("/submit")}><Icon name="plus" />Suggest a film</Link>
            <FeedbackLink className="" onNavigate={() => menu.current?.close()}><Icon name="comment" />Give feedback</FeedbackLink>
          </nav>
          </AccountMenu>
          {/* On pages with the tab bar there's no footer, so what it holds lives here. */}
          <div className="menu-site">
            <nav className="menu-links" aria-label={SITE_NAME}>
              <Link href="/about">About</Link>
              <Link href="/help" aria-current={current("/help")}>Help</Link>
              <Link href="/partnerships">Partnership</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/legal">Legal</Link>
              {INSTAGRAM_URL && <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="platform-link" aria-label="Pheelm on Instagram" title="Instagram"><Icon name="instagram" /></a>}
              {THREADS_URL && <a href={THREADS_URL} target="_blank" rel="noopener noreferrer" className="platform-link" aria-label="Pheelm on Threads" title="Threads"><Icon name="threads" /></a>}
            </nav>
            <p className="menu-legal">
              &copy; {new Date().getFullYear()} {SITE_NAME}. A project by Leo Battiste with the courtesy of TMDB.
            </p>
          </div>
        </div>
      </dialog>
      <SignInSheet />
    </header>
  );
}
