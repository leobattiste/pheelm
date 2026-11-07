"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/films", label: "Films" },
  { href: "/admin/quality", label: "Content quality" },
  { href: "/admin/automation", label: "Automation" },
  { href: "/admin/editorial", label: "Editorial" },
  { href: "/admin/people", label: "Directors & people" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/community", label: "Community" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/activity", label: "Activity" },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={(l.href === "/admin" ? path === l.href : path.startsWith(l.href + "/") || path === l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
