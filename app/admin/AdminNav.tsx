"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";
import type { AdminCounts } from "@/lib/admin-counts";

type Section = { label: string; href: string; icon: IconName; badges?: (keyof AdminCounts)[]; routes: string[] };

/**
 * One level of navigation, like a social app's professional dashboard: a sidebar on wide screens
 * and a bar of icons at the bottom on phones. Each section is one page; anything else a section
 * needs (adding films, reports, logs) is a button or menu on that page, never a second row of tabs.
 * `routes` lists the other pages that belong to a section, so it stays selected on them.
 */
export const ADMIN_SECTIONS: Section[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboardSettings", routes: ["/admin/analytics"] },
  { label: "Films", href: "/admin/films", icon: "film", badges: ["submissions"], routes: ["/admin/submissions", "/admin/quality", "/admin/automation", "/admin/editorial"] },
  { label: "Directors", href: "/admin/people", icon: "users", routes: [] },
  { label: "Watchlists", href: "/admin/community/watchlists", icon: "stack", badges: ["reports"], routes: ["/admin/community/comments"] },
  { label: "Members", href: "/admin/members", icon: "user", routes: [] },
  { label: "Inbox", href: "/admin/inbox", icon: "mail", badges: ["inbox"], routes: [] },
  { label: "Settings", href: "/admin/settings", icon: "gear", routes: ["/admin/community/banned-words", "/admin/community/moderation", "/admin/activity"] },
];

const NONE: AdminCounts = { inbox: 0, reports: 0, submissions: 0, contact: 0, feedback: 0, partnerships: 0, press: 0 };
const under = (path: string, href: string) => href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/");

/** The section a page belongs to: the address that matches most of the path. Reports (/admin/community) belong to Watchlists. */
export function sectionFor(path: string) {
  let best: { section: Section; length: number } | null = null;
  for (const section of ADMIN_SECTIONS) {
    for (const href of [section.href, ...section.routes, ...(section.label === "Watchlists" ? ["/admin/community"] : [])]) {
      if (under(path, href) && (!best || href.length > best.length)) best = { section, length: href.length };
    }
  }
  return best?.section ?? ADMIN_SECTIONS[0];
}

const count = (value: number) => value ? <span className="admin-count" aria-label={`${value} waiting`}>{value > 99 ? "99+" : value}</span> : null;

/** The sidebar, or the bottom bar on phones: one entry per section. */
export default function AdminSidebar({ counts = NONE, who, owner }: { counts?: AdminCounts; who: string; owner: boolean }) {
  const section = sectionFor(usePathname());
  return (
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand" aria-label="Pheelm admin, dashboard"><span className="wordmark-type">pheelm</span><span className="admin-brand-tag">Admin</span></Link>
      <nav className="admin-sections" aria-label="Admin sections">
        {ADMIN_SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className={`admin-section-link${s.label === "Settings" ? " is-settings" : ""}`} aria-current={s === section ? "page" : undefined} title={s.label}>
            <Icon name={s.icon} />
            <span className="admin-section-label">{s.label}</span>
            {count((s.badges ?? []).reduce((sum, key) => sum + counts[key], 0))}
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar-foot">
        <Link href="/" className="admin-foot-link"><Icon name="external" />View site</Link>
        <p className="admin-who"><span className="admin-who-email">{who}</span><span className="admin-role">{owner ? "Owner" : "Admin"}</span></p>
      </div>
    </aside>
  );
}
