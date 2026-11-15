"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "./Icon";
import { chromeFor } from "@/lib/chrome";
import { openSignIn } from "./SignInSheet";
import NavProgressLine from "./NavProgressLine";

type Me = { handle: string | null; unread: number };

/**
 * The menu bar on every page but the landing page, a floating pill of icons: Films, Watchlists,
 * Directors, your profile (Sign in for visitors), and ⋯ for everything else (search, notifications,
 * Watchlist, settings, support, and what the footer holds). Which fourth tab shows is decided before
 * paint (data-auth), so it never flashes.
 */
export default function TabBar() {
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  // Which kind of page this is (set before paint on the first load, then on every navigation).
  useEffect(() => { document.documentElement.dataset.chrome = chromeFor(path); }, [path]);

  useEffect(() => {
    const seen = (window as { __pheelmMe?: Me }).__pheelmMe;
    if (seen) setMe(seen);
    const on = (e: Event) => setMe((e as CustomEvent<Me>).detail);
    window.addEventListener("pheelm:me", on);
    return () => window.removeEventListener("pheelm:me", on);
  }, []);

  const profile = me?.handle ? `/@${me.handle}` : "/profile";
  const at = (href: string) => path === href || path.startsWith(`${href}/`);
  const tabs: { href: string; label: string; icon: IconName; on: boolean; only?: string }[] = [
    { href: "/films", label: "Films", icon: "film", on: at("/films") },
    { href: "/watchlists", label: "Watchlists", icon: "stack", on: at("/watchlists") || path.startsWith("/c/") },
    { href: "/directors", label: "Directors", icon: "users2", on: at("/directors") || path.startsWith("/people/") },
    { href: profile, label: "Profile", icon: "userCircle", on: at(profile) || path === "/profile", only: "member-only" },
  ];

  // The outline sits over the open page's tab: 0 Films, 1 Watchlists, 2 Directors, 3 Profile or Sign in.
  const open = tabs.findIndex((t) => t.on);
  const ring = open >= 0 ? open : path === "/login" ? 3 : -1;
  // It slides between tabs, but when it first appears (a page with no open tab, or your profile
  // before we know your handle) it just fades in at the right tab instead of sliding from the left.
  const was = useRef(ring);
  const fresh = was.current < 0 && ring >= 0;
  useEffect(() => { was.current = ring; }, [ring]);

  // Like iOS, the lens swells while you touch the bar, and you can drag it to another tab: it follows your
  // finger and opens the tab it's let go over.
  const bar = useRef<HTMLElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const nav = bar.current, el = lens.current;
    if (!nav || !el) return;
    let start = -1, dragged = false, swallow = false, slot = 0, at = 0;
    const tabsShown = () => [...nav.querySelectorAll<HTMLElement>(".tab")].filter((t) => t.offsetParent !== null);
    const follow = (x: number) => {
      const r = nav.getBoundingClientRect(), gap = el.offsetLeft;
      slot = el.offsetWidth;
      at = Math.min(Math.max(x - r.left - gap - slot / 2, 0), slot * 4);
      el.style.transform = `translate(${at}px, -50%)`;
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button > 0) return;
      start = e.clientX; dragged = false;
      nav.dataset.press = "";
    };
    const move = (e: PointerEvent) => {
      if (start < 0 || !e.isPrimary) return;
      if (!dragged && Math.abs(e.clientX - start) < 8) return;
      if (!dragged) { dragged = true; el.dataset.drag = ""; el.dataset.on = "true"; }
      follow(e.clientX);
    };
    const up = () => {
      if (start < 0) return;
      start = -1; delete nav.dataset.press;
      if (!dragged) return;
      const target = tabsShown()[Math.round(at / slot)];
      delete el.dataset.drag; el.style.transform = "";
      swallow = true;
      setTimeout(() => { swallow = false; target?.click(); }, 0);
    };
    const click = (e: MouseEvent) => { if (swallow) { e.preventDefault(); e.stopPropagation(); } };
    const cancel = () => { start = -1; dragged = false; delete nav.dataset.press; delete el.dataset.drag; el.style.transform = ""; };
    // A link would otherwise start being dragged itself, which cancels the pointer.
    const noDrag = (e: DragEvent) => e.preventDefault();
    nav.addEventListener("dragstart", noDrag);
    nav.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    nav.addEventListener("pointercancel", cancel);
    nav.addEventListener("click", click, true);
    return () => {
      nav.removeEventListener("dragstart", noDrag);
      nav.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      nav.removeEventListener("pointercancel", cancel);
      nav.removeEventListener("click", click, true);
    };
  }, []);

  return (
    <nav ref={bar} className="tab-bar" aria-label="Sections" style={{ "--tab-i": Math.max(ring, 0) } as React.CSSProperties}>
      <NavProgressLine />
      <span ref={lens} className="tab-ring" data-on={ring >= 0} data-fresh={fresh} aria-hidden="true" />
      {tabs.map((t) => (
        <Link key={t.label} href={t.href} className={t.only ? `tab ${t.only}` : "tab"} aria-current={t.on ? "page" : undefined} aria-label={t.label} title={t.label}>
          <Icon name={t.icon} />
        </Link>
      ))}
      {/* Signed out, the profile tab signs you in. Getting early access is only on the landing page. */}
      <Link href="/login" className="tab visitor-only" aria-current={path === "/login" ? "page" : undefined} aria-label="Sign in" title="Sign in"
        onClick={(e) => { if (openSignIn("signin")) e.preventDefault(); }}>
        <Icon name="userCircle" />
      </Link>
      <button type="button" className="tab" aria-haspopup="dialog" aria-label={me?.unread ? `More, ${me.unread} new notifications` : "More"} title="More"
        onClick={() => window.dispatchEvent(new Event("pheelm:menu"))}>
        <span className="tab-icon">
          <Icon name="moreCircle" />
          {!!me?.unread && <span className="tab-dot" aria-hidden="true" />}
        </span>
      </button>
    </nav>
  );
}
