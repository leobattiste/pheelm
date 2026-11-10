"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";

/**
 * Same pill-tab language as Settings. The URL (rather than hidden mounted panels)
 * controls which admin screen is active, preserving browser history and deep links.
 */
const groups: {
  label: string; href: string; icon: IconName;
  routes: string[]; children?: { label: string; href: string; icon: IconName }[];
}[] = [
  { label: "Overview", href: "/admin", icon: "stack", routes: ["/admin"] },
  { label: "Films", href: "/admin/films", icon: "film", routes: ["/admin/films", "/admin/quality", "/admin/automation"],
    children: [
      { label: "All films", href: "/admin/films", icon: "film" },
      { label: "Content quality", href: "/admin/quality", icon: "check" },
      { label: "Automation", href: "/admin/automation", icon: "sparkle" },
    ] },
  { label: "Directors", href: "/admin/people", icon: "users2", routes: ["/admin/people"] },
  { label: "Editorial", href: "/admin/editorial", icon: "pencil", routes: ["/admin/editorial"] },
  { label: "Community", href: "/admin/community", icon: "comment", routes: ["/admin/community", "/admin/submissions"],
    children: [
      { label: "Collections & reports", href: "/admin/community", icon: "stack" },
      { label: "Submissions", href: "/admin/submissions", icon: "flag" },
    ] },
  { label: "Members", href: "/admin/members", icon: "user", routes: ["/admin/members"] },
  { label: "Inbox", href: "/admin/inbox", icon: "mail", routes: ["/admin/inbox"] },
  { label: "Insights", href: "/admin/analytics", icon: "sort", routes: ["/admin/analytics", "/admin/activity"],
    children: [
      { label: "Analytics", href: "/admin/analytics", icon: "sort" },
      { label: "Activity log", href: "/admin/activity", icon: "clock" },
    ] },
];

const matches = (path: string, route: string) => path === route || path.startsWith(route + "/");

export default function AdminNav() {
  const path = usePathname();
  const main = useRef<HTMLElement>(null);
  const secondary = useRef<HTMLElement>(null);
  const activeGroup = groups.find((g) => g.routes.some((route) => route === "/admin" ? path === route : matches(path, route)));

  useEffect(() => {
    for (const nav of [main.current, secondary.current]) {
      if (!nav) continue;
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (active) {
        const target = active.offsetLeft + active.offsetWidth / 2 - nav.clientWidth / 2;
        nav.scrollLeft = Math.max(0, target);
      }
    }
  }, [path]);

  return (
    <div className="admin-navigation">
      <nav ref={main} className="profile-tabs admin-nav admin-main-tabs" aria-label="Admin sections">
        {groups.map((group) => {
          const active = activeGroup?.href === group.href;
          return (
            <Link key={group.href} href={group.href} className="chip" aria-current={active ? "page" : undefined}>
              <Icon name={group.icon} />
              <span>{group.label}</span>
            </Link>
          );
        })}
      </nav>
      {activeGroup?.children && (
        <nav ref={secondary} className="admin-subtabs" aria-label={activeGroup.label + " pages"}>
          {activeGroup.children.map((child) => {
            const active = matches(path, child.href);
            return (
              <Link key={child.href} href={child.href} aria-current={active ? "page" : undefined}>
                <Icon name={child.icon} />
                <span>{child.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
