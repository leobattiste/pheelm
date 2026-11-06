"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { setProfilePrivate } from "@/app/me/actions";
import { getBrowserClient } from "@/lib/supabase/client";
import { initials } from "@/lib/format";
import SignInForm from "./SignInForm";
import UpdatesDot from "./UpdatesDot";

type Me = { email: string; handle: string | null; name: string | null; isPrivate: boolean | null };

/**
 * Opens the sign-in sheet from anywhere ("Follow", "Save", "Watchlist" when signed out).
 * Returns false when the header isn't on the page, so callers can follow their link instead.
 */
export function openSignIn() {
  if (typeof window === "undefined" || !(window as { __pheelmSignIn?: boolean }).__pheelmSignIn) return false;
  window.dispatchEvent(new Event("open-signin"));
  return true;
}

/**
 * The account button in the header, between search and the menu. Signed out, it opens the sign-in
 * sheet. Signed in, it opens a small pop-up: your profile (view, edit, private), then Watchlist,
 * Settings and Log out.
 */
export default function AccountButton() {
  const path = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const signIn = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

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

  // Let other buttons open the sign-in sheet.
  useEffect(() => {
    (window as { __pheelmSignIn?: boolean }).__pheelmSignIn = true;
    const open = () => signIn.current?.showModal();
    window.addEventListener("open-signin", open);
    return () => { (window as { __pheelmSignIn?: boolean }).__pheelmSignIn = false; window.removeEventListener("open-signin", open); };
  }, []);

  // Close the sheet and the pop-up when the page changes.
  useEffect(() => {
    signIn.current?.close();
    setOpen(false);
  }, [path]);

  // The pop-up closes on a click outside it or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [open]);

  const togglePrivate = async () => {
    if (!me || me.isPrivate === null) return;
    const next = !me.isPrivate;
    setMe({ ...me, isPrivate: next });
    const { ok } = await setProfilePrivate(next).catch(() => ({ ok: false }));
    if (!ok) return setMe((m) => (m ? { ...m, isPrivate: !next } : m));
    if (me.handle && path === `/@${me.handle}`) router.refresh();
  };

  const close = (d: React.RefObject<HTMLDialogElement | null>) => (e: React.MouseEvent) => { if (e.target === d.current) d.current?.close(); };
  const label = me ? (me.name || (me.handle ? `@${me.handle}` : me.email)) : "";

  const profileHref = me?.handle ? `/@${me.handle}` : "/profile";
  const editHref = me?.handle ? `/@${me.handle}?edit` : "/profile";

  return (
    <div className="account-wrap" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="icon-button account-button"
        aria-haspopup={me ? "true" : "dialog"}
        aria-expanded={me ? open : undefined}
        aria-controls={me ? "account-pop" : undefined}
        aria-label={me ? "Your account" : "Sign in"}
        aria-busy={me === undefined}
        onClick={() => (me ? setOpen((o) => !o) : signIn.current?.showModal())}
      >
        {me ? (
          <span className="account-initials" aria-hidden="true">{initials(label.replace(/^@/, ""))}</span>
        ) : (
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7" r="3.2" /><path d="M3.8 16.5c.9-3 3.3-4.6 6.2-4.6s5.3 1.6 6.2 4.6" /></svg>
        )}
        {me && <UpdatesDot />}
      </button>

      <dialog ref={signIn} className="modal signin-sheet" aria-labelledby="signin-title" onClick={close(signIn)}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <span />
          <button type="button" className="icon-button" onClick={() => signIn.current?.close()} aria-label="Close">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <div className="modal-body">
          <SignInForm next={path || "/"} titleId="signin-title" onDone={() => signIn.current?.close()} />
        </div>
      </dialog>

      {me && open && (
        <div id="account-pop" className="account-pop">
          <div className="account-who">
            <span className="account-initials" aria-hidden="true">{initials(label.replace(/^@/, "") || "?")}</span>
            <span className="account-who-text">
              <span className="account-who-name">{label}</span>
              {me.handle && <span className="account-who-handle">@{me.handle}</span>}
            </span>
          </div>
          <nav className="pop-group" aria-label="Your profile">
            <Link href={profileHref} aria-current={me.handle && path === `/@${me.handle}` ? "page" : undefined}>
              {me.handle ? "View profile" : "Create profile"}<UpdatesDot />
            </Link>
            {me.handle && <Link href={editHref}>Edit profile</Link>}
            {me.handle && me.isPrivate !== null && (
              <label className="pop-switch">
                Private profile
                <input type="checkbox" role="switch" className="switch" checked={me.isPrivate} onChange={togglePrivate} />
              </label>
            )}
          </nav>
          <nav className="pop-group" aria-label="Your account">
            <Link href="/me" aria-current={path === "/me" ? "page" : undefined}>Watchlist</Link>
            <Link href="/account" aria-current={path === "/account" ? "page" : undefined}>Settings</Link>
            <form action="/auth/signout" method="post">
              <button type="submit">Log out</button>
            </form>
          </nav>
        </div>
      )}
    </div>
  );
}
