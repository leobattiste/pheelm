"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminCounts } from "@/lib/admin-counts";

type Child = { label: string; href: string; badge?: keyof AdminCounts };
type Group = { label: string; href: string; routes: string[]; badges?: (keyof AdminCounts)[]; children?: Child[] };

/**
 * Six sections, each with its own pages. The URL decides what's selected, so history and deep
 * links work. Badges show what's waiting.
 */
export const ADMIN_GROUPS: Group[] = [
  { label: "Overview", href: "/admin", routes: ["/admin"] },
  { label: "Catalog", href: "/admin/films", routes: ["/admin/films", "/admin/people", "/admin/editorial", "/admin/quality", "/admin/automation"],
    children: [
      { label: "Films", href: "/admin/films" },
      { label: "Directors", href: "/admin/people" },
      { label: "Editorial", href: "/admin/editorial" },
      { label: "Content quality", href: "/admin/quality" },
      { label: "Automation", href: "/admin/automation" },
    ] },
  { label: "Inbox", href: "/admin/inbox", routes: ["/admin/inbox"], badges: ["inbox"],
    children: [
      { label: "All", href: "/admin/inbox", badge: "inbox" },
      { label: "Contact", href: "/admin/inbox/contact", badge: "contact" },
      { label: "Feedback", href: "/admin/inbox/feedback", badge: "feedback" },
      { label: "Partnerships", href: "/admin/inbox/partnerships", badge: "partnerships" },
      { label: "Press and privacy", href: "/admin/inbox/press", badge: "press" },
      { label: "Newsletter", href: "/admin/inbox/newsletter" },
    ] },
  { label: "Community", href: "/admin/community", routes: ["/admin/community", "/admin/submissions"], badges: ["reports", "submissions"],
    children: [
      { label: "Reports and watchlists", href: "/admin/community", badge: "reports" },
      { label: "Submissions", href: "/admin/submissions", badge: "submissions" },
    ] },
  { label: "Members", href: "/admin/members", routes: ["/admin/members"] },
  { label: "Insights", href: "/admin/analytics", routes: ["/admin/analytics", "/admin/activity"],
    children: [
      { label: "Analytics", href: "/admin/analytics" },
      { label: "Activity log", href: "/admin/activity" },
    ] },
];

const matches = (path: string, route: string) => path === route || path.startsWith(route + "/");
const badge = (value: number) => value ? <span className="admin-count" aria-label={`${value} waiting`}>{value > 99 ? "99+" : value}</span> : null;

export default function AdminNav({ counts }: { counts: AdminCounts }) {
  const path = usePathname();
  const main = useRef<HTMLElement>(null);
  const secondary = useRef<HTMLElement>(null);
  const activeGroup = ADMIN_GROUPS.find((g) => g.routes.some((route) => route === "/admin" ? path === route : matches(path, route)));
  const activeChild = activeGroup?.children?.filter((c) => matches(path, c.href)).sort((a, b) => b.href.length - a.href.length)[0];

  useEffect(() => {
    for (const nav of [main.current, secondary.current]) {
      const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      if (nav && active) nav.scrollLeft = Math.max(0, active.offsetLeft + active.offsetWidth / 2 - nav.clientWidth / 2);
    }
  }, [path]);

  return (
    <div className="admin-navigation">
      <nav ref={main} className="profile-tabs admin-nav admin-main-tabs" aria-label="Admin sections">
        {ADMIN_GROUPS.map((group) => (
          <Link key={group.href} href={group.href} className="chip" aria-current={activeGroup?.href === group.href ? "page" : undefined}>
            <span>{group.label}</span>
            {badge((group.badges ?? []).reduce((sum, key) => sum + counts[key], 0))}
          </Link>
        ))}
      </nav>
      {activeGroup?.children && (
        <nav ref={secondary} className="admin-subtabs" aria-label={activeGroup.label + " pages"}>
          {activeGroup.children.map((child) => (
            <Link key={child.href} href={child.href} aria-current={child === activeChild ? "page" : undefined}>
              <span>{child.label}</span>
              {child.badge && badge(counts[child.badge])}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
