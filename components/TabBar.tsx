"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

  return (
    <nav className="tab-bar" aria-label="Sections">
      <NavProgressLine />
      {tabs.map((t) => (
        <Link key={t.label} href={t.href} className={t.only ? `tab ${t.only}` : "tab"} aria-current={t.on ? "page" : undefined} aria-label={t.label} title={t.label}>
          <Icon name={t.icon} />
        </Link>
      ))}
      <Link href="/login" className="tab visitor-only" aria-current={path === "/login" ? "page" : undefined} aria-label="Sign in" title="Sign in"
        onClick={(e) => { if (openSignIn("signin")) e.preventDefault(); }}>
        <Icon name="login" />
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
