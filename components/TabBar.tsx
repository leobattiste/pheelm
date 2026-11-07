"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "./Icon";

type Me = { handle: string | null; unread: number };

/**
 * Members' tab bar on phones: Films, Collections, Directors, your profile, and ⋯ for everything
 * else in the menu (notifications, Watchlist, settings, support, grid and theme).
 */
export default function TabBar() {
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const seen = (window as { __pheelmMe?: Me }).__pheelmMe;
    if (seen) setMe(seen);
    const on = (e: Event) => setMe((e as CustomEvent<Me>).detail);
    window.addEventListener("pheelm:me", on);
    return () => window.removeEventListener("pheelm:me", on);
  }, []);

  const profile = me?.handle ? `/@${me.handle}` : "/profile";
  const at = (href: string) => path === href || path.startsWith(`${href}/`);
  const tabs: { href: string; label: string; icon: IconName; on: boolean }[] = [
    { href: "/films", label: "Films", icon: "film", on: at("/films") },
    { href: "/collections", label: "Collections", icon: "stack", on: at("/collections") || path.startsWith("/c/") },
    { href: "/directors", label: "Directors", icon: "users", on: at("/directors") || path.startsWith("/people/") },
    { href: profile, label: "Profile", icon: "userCircle", on: at(profile) || path === "/profile" },
  ];

  return (
    <nav className="tab-bar member-only" aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.label} href={t.href} className="tab" aria-current={t.on ? "page" : undefined}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </Link>
      ))}
      <button type="button" className="tab" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event("pheelm:menu"))}>
        <span className="tab-icon">
          <Icon name="moreCircle" />
          {!!me?.unread && <span className="tab-dot" aria-label={`${me.unread} new notifications`} />}
        </span>
        <span>More</span>
      </button>
    </nav>
  );
}
