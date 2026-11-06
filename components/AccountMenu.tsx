"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { setProfilePrivate } from "@/app/me/actions";
import { initials } from "@/lib/format";
import { getBrowserClient } from "@/lib/supabase/client";
import { openSignIn } from "./SignInSheet";
import UpdatesDot from "./UpdatesDot";

type Me = { email: string; handle: string | null; name: string | null; isPrivate: boolean | null };

/**
 * The account part of the menu. Signed out: Sign in. Signed in: who you are, your profile (view,
 * edit, private), then Watchlist, Settings and Log out.
 */
export default function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) return setMe(null);
    let active = true;
    const load = async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) return active && setMe(null);
      const { data: p } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
      const profile = (p ?? {}) as { handle?: string | null; display_name?: string | null; is_private?: boolean };
      if (active) setMe({ email: user.email ?? "", handle: profile.handle ?? null, name: profile.display_name ?? null, isPrivate: "is_private" in profile ? !!profile.is_private : null });
    };
    void load().catch(() => active && setMe(null));
    // Don't query inside the auth callback itself: it can deadlock the client mid-change.
    const { data } = db.auth.onAuthStateChange(() => { setTimeout(() => { if (active) void load().catch(() => {}); }, 0); });
    const onProfile = () => void load().catch(() => {});
    window.addEventListener("profilechange", onProfile);
    return () => { active = false; data.subscription.unsubscribe(); window.removeEventListener("profilechange", onProfile); };
  }, []);

  const togglePrivate = async () => {
    if (!me || me.isPrivate === null) return;
    const next = !me.isPrivate;
    setMe({ ...me, isPrivate: next });
    const { ok } = await setProfilePrivate(next).catch(() => ({ ok: false }));
    if (!ok) return setMe((m) => (m ? { ...m, isPrivate: !next } : m));
    if (me.handle && path === `/@${me.handle}`) router.refresh();
  };

  if (me === undefined) return <div className="menu-more menu-account" aria-busy="true" />;

  if (!me) {
    return (
      <nav className="menu-more menu-account" aria-label="Account">
        <button type="button" className="menu-more-button" onClick={() => { onNavigate(); openSignIn(); }}>Sign in</button>
        <p className="menu-note">Save films, follow directors and make collections.</p>
      </nav>
    );
  }

  const label = me.name || (me.handle ? `@${me.handle}` : me.email);
  const current = (href: string) => (path === href ? "page" : undefined);

  return (
    <nav className="menu-more menu-account" aria-label="Your account">
      <div className="account-who">
        <span className="account-initials" aria-hidden="true">{initials(label.replace(/^@/, "") || "?")}</span>
        <span className="account-who-text">
          <span className="account-who-name">{label}</span>
          {me.handle && <span className="account-who-handle">@{me.handle}</span>}
        </span>
      </div>
      <Link href={me.handle ? `/@${me.handle}` : "/profile"} aria-current={me.handle ? current(`/@${me.handle}`) : undefined}>
        {me.handle ? "View profile" : "Create profile"}<UpdatesDot />
      </Link>
      {me.handle && <Link href={`/@${me.handle}?edit`}>Edit profile</Link>}
      {me.handle && me.isPrivate !== null && (
        <label className="menu-switch">
          Private profile
          <input type="checkbox" role="switch" className="switch" checked={me.isPrivate} onChange={togglePrivate} />
        </label>
      )}
      <Link href="/me" aria-current={current("/me")}>Watchlist</Link>
      <Link href="/account" aria-current={current("/account")}>Settings</Link>
      <form action="/auth/signout" method="post">
        <button type="submit" className="menu-more-button">Log out</button>
      </form>
    </nav>
  );
}
