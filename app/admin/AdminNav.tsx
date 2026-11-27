"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Icon, { type IconName } from "@/components/Icon";
import type { AdminCounts } from "@/lib/admin-counts";
import NavProgressLine from "@/components/NavProgressLine";

type Section = {
  label: string; href: string; icon: IconName; badges?: (keyof AdminCounts)[]; routes: string[];
  /** Where it sits in the sidebar. */
  group: "main" | "catalog" | "community" | "settings";
  /** Shown in the phone tab bar; the rest live behind More. */
  phone?: boolean;
};

/**
 * One level of navigation. On wide screens, a sidebar in groups (Catalog, Community). On phones,
 * five labelled tabs: Home, Films, Directors, Inbox and More, which opens the other sections and
 * the tools. `routes` lists the other pages that belong to a section, so it stays selected on them.
 */
export const ADMIN_SECTIONS: Section[] = [
  { label: "Home", href: "/admin", icon: "dashboardSettings", routes: ["/admin/analytics"], group: "main", phone: true },
  { label: "Inbox", href: "/admin/inbox", icon: "mail", badges: ["inbox"], routes: [], group: "main", phone: true },
  { label: "Films", href: "/admin/films", icon: "film", badges: ["submissions"], routes: ["/admin/submissions", "/admin/quality", "/admin/automation", "/admin/editorial", "/admin/searches"], group: "catalog", phone: true },
  { label: "Directors", href: "/admin/people", icon: "users", routes: [], group: "catalog", phone: true },
  { label: "Watchlists", href: "/admin/community/watchlists", icon: "stack", badges: ["reports"], routes: ["/admin/community/comments"], group: "community" },
  { label: "Members", href: "/admin/members", icon: "user", routes: [], group: "community" },
  { label: "Settings", href: "/admin/settings", icon: "gear", routes: ["/admin/community/banned-words", "/admin/community/moderation", "/admin/activity"], group: "settings" },
];

const GROUPS: { key: Section["group"]; label?: string }[] = [
  { key: "main" }, { key: "catalog", label: "Catalog" }, { key: "community", label: "Community" }, { key: "settings" },
];

/** Tools reached from More on phones (and from each section's page on desktop). */
const TOOLS: { label: string; href: string; icon: IconName }[] = [
  { label: "Automation", href: "/admin/automation", icon: "sparkle" },
  { label: "Content quality", href: "/admin/quality", icon: "check" },
  { label: "Suggestions from members", href: "/admin/submissions", icon: "send" },
  { label: "Reports", href: "/admin/community", icon: "flag" },
  { label: "Activity log", href: "/admin/activity", icon: "clock" },
  { label: "Analytics", href: "/admin/analytics", icon: "dashboardSettings" },
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

const badge = (value: number) => value ? <span className="admin-count" aria-label={`${value} waiting`}>{value > 99 ? "99+" : value}</span> : null;

/** The sidebar, or the tab bar on phones. */
export default function AdminSidebar({ counts = NONE, who, owner }: { counts?: AdminCounts; who: string; owner: boolean }) {
  const path = usePathname();
  const section = sectionFor(path);
  const more = useRef<HTMLDialogElement>(null);
  useEffect(() => { more.current?.close(); }, [path]);
  const waiting = (s: Section) => (s.badges ?? []).reduce((sum, key) => sum + counts[key], 0);
  const inMore = ADMIN_SECTIONS.filter((s) => !s.phone);
  const moreWaiting = inMore.reduce((sum, s) => sum + waiting(s), 0);

  return (
    <aside className="admin-sidebar">
      <NavProgressLine />
      <Link href="/admin" className="admin-brand" aria-label="Pheelm admin, home"><span className="wordmark-type">pheelm</span><span className="admin-brand-tag">Admin</span></Link>
      <nav className="admin-sections" aria-label="Admin sections">
        {GROUPS.map((g) => (
          <div key={g.key} className={`admin-nav-group is-${g.key}`}>
            {g.label && <p className="admin-nav-label">{g.label}</p>}
            {ADMIN_SECTIONS.filter((s) => s.group === g.key).map((s) => (
              <Link key={s.href} href={s.href} className={`admin-section-link${s.phone ? " is-phone" : ""}`} aria-current={s === section ? "page" : undefined}>
                <Icon name={s.icon} />
                <span className="admin-section-label">{s.label}</span>
                {badge(waiting(s))}
              </Link>
            ))}
          </div>
        ))}
        <button type="button" className={`admin-section-link admin-more-tab${!section.phone ? " is-active" : ""}`} onClick={() => more.current?.showModal()} aria-haspopup="dialog">
          <Icon name="more" />
          <span className="admin-section-label">More</span>
          {badge(moreWaiting)}
        </button>
      </nav>
      <div className="admin-sidebar-foot">
        <Link href="/" className="admin-foot-link"><Icon name="external" />View site</Link>
        <p className="admin-who"><span className="admin-who-email">{who}</span><span className="admin-role">{owner ? "Owner" : "Admin"}</span></p>
      </div>

      {/* Phones: the sections that don't fit in the tab bar, and the tools. */}
      <dialog ref={more} className="modal admin-more-sheet" aria-labelledby="admin-more-title" onClick={(e) => { if (e.target === more.current) more.current?.close(); }}>
        <div className="modal-head">
          <h2 id="admin-more-title">More</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={() => more.current?.close()}><Icon name="close" /></button>
        </div>
        <div className="modal-body admin-more-body">
          <div className="admin-more-list">
            {inMore.map((s) => (
              <Link key={s.href} href={s.href} className={s === section ? "is-active" : undefined}>
                <Icon name={s.icon} /><span>{s.label}</span>{badge(waiting(s))}
              </Link>
            ))}
          </div>
          <p className="admin-nav-label">Tools</p>
          <div className="admin-more-list">
            {TOOLS.map((t) => <Link key={t.href} href={t.href}><Icon name={t.icon} /><span>{t.label}</span></Link>)}
            <Link href="/"><Icon name="external" /><span>View site</span></Link>
          </div>
          <p className="admin-more-who">{who} · {owner ? "Owner" : "Admin"}</p>
        </div>
      </dialog>
    </aside>
  );
}
