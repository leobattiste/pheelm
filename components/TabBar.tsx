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
 * Directors, your profile (Sign in for visitors), and ⋯ for everything else (notifications,
 * Watchlist, settings, support, and what the footer holds). Which fourth tab shows is decided
 * before paint (data-auth), so it never flashes.
 */
export default function TabBar() {
  const path = decodeURIComponent(usePathname());
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
  const tabs: { href: string; label: string; icon: IconName; on: boolean; only?: string; heavy?: boolean }[] = [
    { heavy: true, href: "/films", label: "Films", icon: "film", on: at("/films") },
    { heavy: true, href: "/watchlists", label: "Watchlists", icon: "stack", on: at("/watchlists") || path.startsWith("/c/") },
    { heavy: true, href: "/directors", label: "Directors", icon: "userMultiple", on: at("/directors") || path.startsWith("/people/") },
    { href: profile, label: "Profile", icon: "userAccount", on: at(profile) || path === "/profile", only: "member-only" },
  ];

  // The outline sits over the open page's tab: 0 Films, 1 Watchlists, 2 Directors, 3 Profile or Sign in.
  const open = tabs.findIndex((t) => t.on);
  const ring = open >= 0 ? open : path === "/login" ? 3 : -1;
  // It slides between tabs, but when it first appears (a page with no open tab, or your profile
  // before we know your handle) it just fades in at the right tab instead of sliding from the left.
  const was = useRef(ring);
  const fresh = was.current < 0 && ring >= 0;
  useEffect(() => { was.current = ring; }, [ring]);

  return (
    <nav className="tab-bar" aria-label="Sections" style={{ "--tab-i": Math.max(ring, 0) } as React.CSSProperties}>
      <NavProgressLine />
      <span className="tab-ring" data-on={ring >= 0} data-fresh={fresh} aria-hidden="true" />
      {tabs.map((t) => (
        // The catalogue pages are large and static, so Next would fetch each one in full on every
        // page view, whether or not anyone taps them. They load on tap instead, behind a skeleton.
        <Link key={t.label} href={t.href} prefetch={t.heavy || t.on ? false : undefined} className={t.only ? `tab ${t.only}` : "tab"} aria-current={t.on ? "page" : undefined} aria-label={t.label} title={t.label}>
          <Icon name={t.icon} />
        </Link>
      ))}
      {/* Signed out, the profile tab signs you in. Getting early access is only on the landing page. */}
      <Link href="/login" className="tab visitor-only" aria-current={path === "/login" ? "page" : undefined} aria-label="Sign in" title="Sign in"
        onClick={(e) => { if (openSignIn("signin")) e.preventDefault(); }}>
        <Icon name="userAccount" />
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
