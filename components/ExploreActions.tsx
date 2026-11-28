"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { openSignIn } from "@/components/SignInSheet";
import { useSessionEmail } from "@/lib/session-email";

type Item = { href: string; icon: IconName; title: string; external?: boolean };

/**
 * The "Join in" list. It reads the signed-in account on this device, so a visitor is asked to
 * join, and a member is sent to their own profile and their own lists instead.
 */
export default function ExploreActions({ commentsHref, commentsTitle, instagram }: { commentsHref?: string; commentsTitle?: string; instagram?: string }) {
  const email = useSessionEmail();
  const [handle, setHandle] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const seen = (window as { __pheelmMe?: { handle: string | null } }).__pheelmMe;
    if (seen) setHandle(seen.handle);
    const on = (e: Event) => setHandle((e as CustomEvent<{ handle: string | null }>).detail.handle);
    window.addEventListener("pheelm:me", on);
    return () => window.removeEventListener("pheelm:me", on);
  }, []);

  const member = !!email;
  const items: Item[] = [
    ...(member
      ? [{ href: handle ? `/@${handle}` : "/profile", icon: "userAccount" as IconName, title: handle ? "Visit your profile" : "Finish your profile" }]
      : []),
    { href: "/me#new-collection", icon: "stack", title: "Create a watchlist" },
    { href: "/films", icon: "film", title: "Mark the films you’ve watched" },
    ...(commentsHref ? [{ href: commentsHref, icon: "comment" as IconName, title: commentsTitle ?? "Join the conversation" }] : []),
    { href: "/directors", icon: "users2", title: "Follow directors" },
    { href: "/submit", icon: "plus", title: "Suggest a film" },
    ...(instagram ? [{ href: instagram, icon: "instagram" as IconName, title: "Follow Pheelm on Instagram", external: true }] : []),
  ];

  return (
    <ul className="explore-actions">
      {!member && (
        <li>
          <button type="button" onClick={() => { if (!openSignIn("signup")) location.href = "/login"; }}>
            <Icon name="login" />
            <span>Create your free account</span>
            <Icon name="arrowRight" />
          </button>
        </li>
      )}
      {items.map((a) => (
        <li key={a.title}>
          <Link href={a.href} {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            <Icon name={a.icon} />
            <span>{a.title}</span>
            <Icon name="arrowRight" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
