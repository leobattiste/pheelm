"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import Icon from "./Icon";
import { openSignIn } from "./SignInSheet";
import GridToggle from "./GridToggle";
import ThemeToggle from "./ThemeToggle";

/** Theme and poster view, each option its own round button, with a line above and below. */
const VIEW_SETTINGS = (
  <div className="menu-more menu-view-settings" role="group" aria-label="Display">
    <div className="menu-setting"><span>Theme</span><ThemeToggle /></div>
    <div className="menu-setting"><span>Grid</span><GridToggle /></div>
  </div>
);

type Me = { email: string; handle: string | null; name: string | null; isPrivate: boolean | null; unread: number };

/**
 * The account part of the menu. Signed out: Sign in. Signed in: Notifications (with a
 * count of new ones), Watchlists, Settings, then Theme and Grid, then Log out. Profile is in
 * the tab bar and the footer.
 */
export default function AccountMenu({ onNavigate, children }: { onNavigate: () => void; children?: ReactNode }) {
  const path = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) return setMe(null);
    let active = true;
    const load = async () => {
      // From the session on this device: asking the sign-in service each time failed whenever it
      // was busy, and the menu then showed Sign in to a signed-in member.
      const { data: { session } } = await db.auth.getSession();
      const user = session?.user;
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

  if (me === undefined) return <><div className="menu-more menu-account" aria-busy="true" />{children}</>;

  if (!me) {
    return (
      <><nav className="menu-more menu-account" aria-label="Account">
        <button type="button" className="menu-more-button" onClick={() => { onNavigate(); openSignIn("signin"); }}><Icon name="login" />Sign in</button>
        <p className="menu-note">Save films, make watchlists and follow directors.</p>
      </nav>{children}{VIEW_SETTINGS}</>
    );
  }

  const current = (href: string) => (path === href ? "page" : undefined);

  return (
    <><nav className="menu-more menu-account" aria-label="Your account">
      <Link href="/notifications" aria-current={current("/notifications")}>
        <Icon name="bell" />Notifications
        {me.unread > 0 && <span className="badge" aria-label={`${me.unread} new`}>{me.unread > 9 ? "9+" : me.unread}</span>}
      </Link>
      <Link href="/me" aria-current={current("/me")}><Icon name="bookmark" />Watchlists</Link>
      <Link href="/account" aria-current={current("/account")}><Icon name="gear" />Settings</Link>
    </nav>
    {children}
    {VIEW_SETTINGS}
    <nav className="menu-more menu-account menu-signout" aria-label="Session">
      <form action="/auth/signout" method="post">
        <button type="submit" className="menu-more-button menu-logout"><Icon name="logout" />Log out</button>
      </form>
    </nav></>
  );
}
