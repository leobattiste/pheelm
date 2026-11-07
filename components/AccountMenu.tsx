"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import Icon from "./Icon";
import { openSignIn } from "./SignInSheet";

type Me = { email: string; handle: string | null; name: string | null; isPrivate: boolean | null; unread: number };

/**
 * The account part of the menu. Signed out: Sign in. Signed in: Profile, Notifications (with a
 * count of new ones), Watchlist, Settings and
 * Log out.
 */
export default function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  const path = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) return setMe(null);
    let active = true;
    const load = async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) return active && setMe(null);
      const [{ data: p }, unread] = await Promise.all([
        db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
      ]);
      const profile = (p ?? {}) as { handle?: string | null; display_name?: string | null; is_private?: boolean };
      const next = { email: user.email ?? "", handle: profile.handle ?? null, name: profile.display_name ?? null, isPrivate: "is_private" in profile ? !!profile.is_private : null, unread: unread.error ? 0 : unread.count ?? 0 };
      if (!active) return;
      setMe(next);
      // The tab bar on phones shows your profile and the unread count too.
      (window as { __pheelmMe?: unknown }).__pheelmMe = { handle: next.handle, unread: next.unread };
      window.dispatchEvent(new CustomEvent("pheelm:me", { detail: { handle: next.handle, unread: next.unread } }));
    };
    void load().catch(() => active && setMe(null));
    // Don't query inside the auth callback itself: it can deadlock the client mid-change.
    const { data } = db.auth.onAuthStateChange(() => { setTimeout(() => { if (active) void load().catch(() => {}); }, 0); });
    const onProfile = () => void load().catch(() => {});
    window.addEventListener("profilechange", onProfile);
    window.addEventListener("notificationschange", onProfile);
    return () => {
      active = false;
      data.subscription.unsubscribe();
      window.removeEventListener("profilechange", onProfile);
      window.removeEventListener("notificationschange", onProfile);
    };
  }, []);

  if (me === undefined) return <div className="menu-more menu-account" aria-busy="true" />;

  if (!me) {
    return (
      <nav className="menu-more menu-account" aria-label="Account">
        <button type="button" className="menu-more-button" onClick={() => { onNavigate(); openSignIn(); }}><Icon name="login" />Sign in</button>
        <p className="menu-note">Save films, make collections and follow directors.</p>
      </nav>
    );
  }

  const current = (href: string) => (path === href ? "page" : undefined);

  return (
    <nav className="menu-more menu-account" aria-label="Your account">
      <Link href={me.handle ? `/@${me.handle}` : "/profile"} aria-current={me.handle ? current(`/@${me.handle}`) : undefined}>
        <Icon name="user" />{me.handle ? "Profile" : "Create profile"}
      </Link>
      <Link href="/notifications" aria-current={current("/notifications")}>
        <Icon name="bell" />Notifications
        {me.unread > 0 && <span className="badge" aria-label={`${me.unread} new`}>{me.unread > 9 ? "9+" : me.unread}</span>}
      </Link>
      <Link href="/me" aria-current={current("/me")}><Icon name="bookmark" />Watchlist</Link>
      <Link href="/account" aria-current={current("/account")}><Icon name="gear" />Settings</Link>
      <form action="/auth/signout" method="post">
        <button type="submit" className="menu-more-button"><Icon name="logout" />Log out</button>
      </form>
    </nav>
  );
}
